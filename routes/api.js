/**
 * API Routes
 * Handles all REST endpoints for the restaurant ordering system
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { getDatabase } = require('../config/database');
const { RESTAURANT_ID } = require('../db/seed');
const osrmService = require('../services/osrmService');
const paymentService = require('../services/paymentService');
const ntfyService = require('../services/ntfyService');
const { validateOrder, validatePayment, validateStatusUpdate } = require('../middleware/validation');

const TAX_RATE = parseFloat(process.env.TAX_RATE) || 0.05;
const DELIVERY_FEE_BASE_KM = parseFloat(process.env.DELIVERY_FEE_BASE_KM) || 3;
const DELIVERY_FEE_BASE_AMOUNT = parseFloat(process.env.DELIVERY_FEE_BASE_AMOUNT) || 30;
const DELIVERY_FEE_PER_KM = parseFloat(process.env.DELIVERY_FEE_PER_KM) || 10;
const FREE_DELIVERY_MIN_ORDER = parseFloat(process.env.FREE_DELIVERY_MIN_ORDER) || 500;
const MAX_DELIVERY_KM = parseFloat(process.env.MAX_DELIVERY_KM) || 8;

// =====================
// RESTAURANT ENDPOINTS
// =====================

/**
 * GET /api/restaurants
 * List all restaurants
 */
router.get('/restaurants', (req, res) => {
  const db = getDatabase();
  const restaurants = db.prepare('SELECT * FROM restaurants WHERE is_active = 1').all();
  res.json({ restaurants });
});

/**
 * GET /api/restaurants/:id
 * Get restaurant details
 */
router.get('/restaurants/:id', (req, res) => {
  const db = getDatabase();
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.params.id);
  if (!restaurant) {
    return res.status(404).json({ error: 'Restaurant not found' });
  }
  res.json({ restaurant });
});

/**
 * GET /api/restaurants/:id/menu
 * Get menu for a restaurant, with optional category and diet filters
 */
router.get('/restaurants/:id/menu', (req, res) => {
  const db = getDatabase();
  const { category, diet, search } = req.query;

  let query = 'SELECT * FROM menu_items WHERE restaurant_id = ?';
  const params = [req.params.id];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (diet && ['veg', 'nonveg'].includes(diet)) {
    query += ' AND diet = ?';
    params.push(diet);
  }
  if (search) {
    query += ' AND (name LIKE ? OR description LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm);
  }

  query += ' ORDER BY is_bestseller DESC, name ASC';

  const items = db.prepare(query).all(...params);
  res.json({ items, total: items.length });
});

// =====================
// CART VALIDATION
// =====================

/**
 * POST /api/cart/validate
 * Validate cart items against backend prices and availability
 * NEVER trust client-side prices
 */
router.post('/cart/validate', (req, res) => {
  const db = getDatabase();
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  const validatedItems = [];
  let subtotal = 0;

  for (const item of items) {
    const menuItem = db.prepare('SELECT * FROM menu_items WHERE id = ? AND is_available = 1').get(item.menuItemId);

    if (!menuItem) {
      return res.status(400).json({
        error: `Item "${item.menuItemId}" is not available`,
        unavailableItemId: item.menuItemId,
      });
    }

    const quantity = Math.min(Math.max(parseInt(item.quantity) || 1, 1), 99);
    const itemTotal = menuItem.price * quantity;
    subtotal += itemTotal;

    validatedItems.push({
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.price, // Backend price, not client price
      quantity,
      itemTotal,
    });
  }

  res.json({
    items: validatedItems,
    subtotal,
    taxRate: TAX_RATE,
    tax: Math.round(subtotal * TAX_RATE),
  });
});

// =====================
// ROUTING / DELIVERY
// =====================

/**
 * POST /api/route
 * Calculate delivery route using OSRM
 */
router.post('/route', async (req, res) => {
  const { customerLat, customerLng } = req.body;

  if (!customerLat || !customerLng) {
    return res.status(400).json({ error: 'Customer coordinates required' });
  }

  const restaurant = getDatabase().prepare('SELECT * FROM restaurants WHERE id = ?').get(RESTAURANT_ID);

  try {
    const route = await osrmService.getRouteWithFallback(
      restaurant.longitude, restaurant.latitude,
      customerLng, customerLat
    );

    // Calculate delivery fee
    let deliveryFee = 0;
    if (route.distanceKm > DELIVERY_FEE_BASE_KM) {
      const extraKm = route.distanceKm - DELIVERY_FEE_BASE_KM;
      deliveryFee = DELIVERY_FEE_BASE_AMOUNT + Math.ceil(extraKm) * DELIVERY_FEE_PER_KM;
    } else {
      deliveryFee = DELIVERY_FEE_BASE_AMOUNT;
    }

    res.json({
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      deliveryFee,
      geometry: route.geometry,
      steps: route.steps,
      fallback: route.fallback || false,
    });
  } catch (err) {
    res.status(502).json({ error: 'Unable to calculate route', details: err.message });
  }
});

// =====================
// ORDERS
// =====================

/**
 * POST /api/orders
 * Create a new pending order
 * Flow: Create PENDING order → Process Payment → Verify → Confirm
 */
router.post('/orders', validateOrder, async (req, res) => {
  const db = getDatabase();
  const {
    customerName, customerPhone, deliveryAddress,
    customerLat, customerLng,
    deliveryMode, items, specialInstructions,
  } = req.body;

  // Validate all items against backend and calculate totals
  const validatedItems = [];
  let subtotal = 0;

  for (const item of items) {
    const menuItem = db.prepare('SELECT * FROM menu_items WHERE id = ? AND is_available = 1').get(item.menuItemId);
    if (!menuItem) {
      return res.status(400).json({ error: `Item ${item.menuItemId} is not available` });
    }
    const qty = Math.min(Math.max(parseInt(item.quantity) || 1, 1), 99);
    validatedItems.push({ ...menuItem, quantity: qty, itemTotal: menuItem.price * qty });
    subtotal += menuItem.price * qty;
  }

  // Calculate delivery fee and distance
  let distanceKm = null;
  let estimatedMinutes = null;
  let deliveryFee = 0;

  if (deliveryMode === 'delivery' && customerLat && customerLng) {
    const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(RESTAURANT_ID);
    try {
      const route = await osrmService.getRouteWithFallback(
        restaurant.longitude, restaurant.latitude,
        customerLng, customerLat
      );
      distanceKm = route.distanceKm;
      estimatedMinutes = route.durationMin;
    } catch (err) {
      console.warn('Route calculation failed:', err.message);
    }

    if (distanceKm && distanceKm > MAX_DELIVERY_KM) {
      return res.status(400).json({ error: `Delivery not available beyond ${MAX_DELIVERY_KM} km. Distance: ${distanceKm} km` });
    }

    // Calculate fee
    if (distanceKm > DELIVERY_FEE_BASE_KM) {
      const extraKm = distanceKm - DELIVERY_FEE_BASE_KM;
      deliveryFee = DELIVERY_FEE_BASE_AMOUNT + Math.ceil(extraKm) * DELIVERY_FEE_PER_KM;
    } else {
      deliveryFee = DELIVERY_FEE_BASE_AMOUNT;
    }

    // Free delivery for large orders
    if (subtotal >= FREE_DELIVERY_MIN_ORDER) {
      deliveryFee = 0;
    }
  }

  const tax = Math.round(subtotal * TAX_RATE);
  const totalAmount = subtotal + deliveryFee + tax;

  // Create order in a transaction
  const orderId = uuidv4();
  const insertOrder = db.prepare(`
    INSERT INTO orders (id, user_id, restaurant_id, customer_name, customer_phone,
      delivery_address, customer_latitude, customer_longitude,
      delivery_mode, distance_km, estimated_minutes,
      subtotal, delivery_fee, tax, total_amount, special_instructions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO order_items (id, order_id, menu_item_id, name, price, quantity, item_total)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Create a user record
  const userId = uuidv4();
  db.prepare('INSERT INTO users (id, name, phone) VALUES (?, ?, ?)').run(userId, customerName, customerPhone);

  const createOrder = db.transaction(() => {
    // Generate sequential order number
    const lastOrder = db.prepare('SELECT order_number FROM orders ORDER BY order_number DESC LIMIT 1').get();
    const orderNumber = (lastOrder?.order_number || 1000) + 1;

    insertOrder.run(
      orderId, userId, RESTAURANT_ID, customerName, customerPhone,
      deliveryAddress, customerLat || null, customerLng || null,
      deliveryMode, distanceKm, estimatedMinutes,
      subtotal, deliveryFee, tax, totalAmount, specialInstructions || null
    );

    for (const item of validatedItems) {
      insertItem.run(uuidv4(), orderId, item.id, item.name, item.price, item.quantity, item.itemTotal);
    }

    // Update the order number
    db.prepare('UPDATE orders SET order_number = ? WHERE id = ?').run(orderNumber, orderId);

    return orderNumber;
  });

  try {
    const orderNumber = createOrder();

    res.status(201).json({
      orderId,
      orderNumber,
      subtotal,
      deliveryFee,
      tax,
      discount: 0,
      totalAmount,
      distanceKm,
      estimatedMinutes,
      items: validatedItems.map(i => ({
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        itemTotal: i.itemTotal,
      })),
    });
  } catch (err) {
    console.error('Order creation failed:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

/**
 * GET /api/orders/:id
 * Get order details with items and payment
 */
router.get('/orders/:id', (req, res) => {
  const db = getDatabase();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
  const payment = db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1').get(req.params.id);

  res.json({ order, items, payment });
});

// =====================
// PAYMENTS
// =====================

/**
 * POST /api/payments/demo
 * Process a demo payment
 */
router.post('/payments/demo', validatePayment, (req, res) => {
  const db = getDatabase();
  const { paymentId, orderId } = req.body;

  // Idempotency: check if this payment is already processed
  const existingPayment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
  if (existingPayment && existingPayment.status === 'success') {
    return res.json({ success: true, paymentId, status: 'success', message: 'Payment already verified' });
  }
  if (existingPayment && existingPayment.status === 'failed') {
    return res.json({ success: false, paymentId, status: 'failed', message: 'Payment already failed' });
  }

  // Backend verification - THIS IS THE SOURCE OF TRUTH
  const result = paymentService.verifyDemoPayment(paymentId, db);

  if (result.success) {
    // Mark order as paid
    db.prepare("UPDATE orders SET payment_id = ?, payment_status = 'paid', order_status = 'paid', updated_at = datetime('now') WHERE id = ?")
      .run(paymentId, orderId);

    // Load full order for notification
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

    // Mark as confirmed
    db.prepare("UPDATE orders SET order_status = 'confirmed', updated_at = datetime('now') WHERE id = ?")
      .run(orderId);

    // Send ntfy notification ONLY after backend verification
    ntfyService.sendNewOrderNotification({
      ...order,
      items: orderItems,
    }).catch(err => console.error('ntfy failed (order still confirmed):', err.message));

    return res.json({ success: true, paymentId, status: 'success' });
  } else {
    // Payment failed - mark order as failed
    db.prepare("UPDATE orders SET payment_status = 'failed', order_status = 'cancelled', updated_at = datetime('now') WHERE id = ?")
      .run(orderId);

    return res.json({ success: false, paymentId, status: 'failed', reason: result.reason });
  }
});

/**
 * GET /api/payments/:id
 * Get payment details
 */
router.get('/payments/:id', (req, res) => {
  const db = getDatabase();
  const payment = paymentService.getPayment(req.params.id, db);
  if (!payment) {
    return res.status(404).json({ error: 'Payment not found' });
  }
  res.json({ payment });
});

// =====================
// ORDER STATUS (Restaurant Dashboard)
// =====================

/**
 * PATCH /api/orders/:id/status
 * Update order status (restaurant owner action)
 */
router.patch('/orders/:id/status', validateStatusUpdate, (req, res) => {
  const db = getDatabase();
  const { status } = req.body;
  const orderId = req.params.id;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // Validate status transition
  const validTransitions = {
    confirmed: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['out_for_delivery', 'delivered'],
    out_for_delivery: ['delivered'],
  };

  const allowed = validTransitions[order.order_status];
  if (!allowed || !allowed.includes(status)) {
    return res.status(400).json({
      error: `Cannot transition from "${order.order_status}" to "${status}"`,
      allowedTransitions: allowed || [],
    });
  }

  db.prepare("UPDATE orders SET order_status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, orderId);

  // Send status update notification
  ntfyService.sendStatusUpdateNotification({ ...order, order_number: order.order_number }, status)
    .catch(err => console.error('ntfy status update failed:', err.message));

  res.json({ success: true, orderId, newStatus: status });
});

// =====================
// RESTAURANT DASHBOARD
// =====================

/**
 * GET /api/dashboard/orders
 * Get all orders for the restaurant, filterable by status
 */
router.get('/dashboard/orders', (req, res) => {
  const db = getDatabase();
  const { status } = req.query;

  let query = 'SELECT * FROM orders WHERE restaurant_id = ?';
  const params = [RESTAURANT_ID];

  if (status) {
    query += ' AND order_status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  const orders = db.prepare(query).all(...params);

  // Attach items to each order
  const ordersWithItems = orders.map(order => {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    return { ...order, items };
  });

  res.json({ orders: ordersWithItems });
});

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics
 */
router.get('/dashboard/stats', (req, res) => {
  const db = getDatabase();

  const stats = {
    totalOrders: db.prepare('SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ?').get(RESTAURANT_ID).count,
    paidOrders: db.prepare("SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ? AND payment_status = 'paid'").get(RESTAURANT_ID).count,
    preparingOrders: db.prepare("SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ? AND order_status = 'preparing'").get(RESTAURANT_ID).count,
    deliveredToday: db.prepare("SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ? AND order_status = 'delivered' AND date(created_at) = date('now')").get(RESTAURANT_ID).count,
    revenueToday: db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE restaurant_id = ? AND payment_status = 'paid' AND date(created_at) = date('now')").get(RESTAURANT_ID).total,
  };

  res.json({ stats });
});

module.exports = router;
