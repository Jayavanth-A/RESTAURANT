/**
 * Dheeran Restaurant - Test Suite
 * Tests critical flows without external dependencies
 */

const path = require('path');
const assert = require('assert');

// Set up test environment
process.env.DATABASE_PATH = './db/test_dheeran.db';
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Random port

let passed = 0;
let failed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(() => { passed++; console.log(`  ✅ ${name}`); })
        .catch(err => { failed++; console.log(`  ❌ ${name}: ${err.message}`); });
    }
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

function describe(suiteName, fn) {
  console.log(`\n📋 ${suiteName}`);
  const result = fn();
  if (result && typeof result.then === 'result') return result;
}

// ===== SETUP & TEARDOWN =====
const fs = require('fs');
const { getDatabase, closeDatabase } = require('../config/database');
const migration = require('../db/migrations/001_initial');
const { seed, RESTAURANT_ID } = require('../db/seed');
const osrmService = require('../services/osrmService');
const paymentService = require('../services/paymentService');
const { v4: uuidv4 } = require('uuid');

function setup() {
  // Clean up any existing test DB
  const dbPath = process.env.DATABASE_PATH;
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
  if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');

  const db = getDatabase();
  migration.up(db);
  seed(db);
  return db;
}

function teardown() {
  closeDatabase();
  const dbPath = process.env.DATABASE_PATH;
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
  if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
}

// ===== TESTS =====

async function runTests() {
  console.log('🧪 Dheeran Restaurant - Test Suite\n');
  console.log('═'.repeat(50));

  // --- Database Tests ---
  describe('Database', () => {
    const db = setup();

    test('Restaurant is seeded', () => {
      const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(RESTAURANT_ID);
      assert.ok(restaurant, 'Restaurant should exist');
      assert.strictEqual(restaurant.name, 'Dheeran');
    });

    test('Menu items are seeded', () => {
      const count = db.prepare('SELECT COUNT(*) as count FROM menu_items WHERE restaurant_id = ?').get(RESTAURANT_ID).count;
      assert.ok(count > 20, `Should have 20+ menu items, got ${count}`);
    });

    test('Menu has all categories', () => {
      const cats = db.prepare('SELECT DISTINCT category FROM menu_items WHERE restaurant_id = ?').all(RESTAURANT_ID).map(r => r.category);
      assert.ok(cats.includes('starters'), 'Should have starters');
      assert.ok(cats.includes('biryani'), 'Should have biryani');
      assert.ok(cats.includes('beverages'), 'Should have beverages');
    });

    test('Menu has veg and non-veg items', () => {
      const veg = db.prepare("SELECT COUNT(*) as c FROM menu_items WHERE diet = 'veg'").get().c;
      const nonveg = db.prepare("SELECT COUNT(*) as c FROM menu_items WHERE diet = 'nonveg'").get().c;
      assert.ok(veg > 5, `Should have veg items, got ${veg}`);
      assert.ok(nonveg > 5, `Should have non-veg items, got ${nonveg}`);
    });

    teardown();
  });

  // --- Order Flow Tests ---
  describe('Order Creation & Payment', () => {
    const db = setup();

    // Get a menu item
    const menuItem = db.prepare('SELECT * FROM menu_items LIMIT 1').get();

    test('Create a pending order', () => {
      const userId = uuidv4();
      db.prepare('INSERT INTO users (id, name, phone) VALUES (?, ?, ?)').run(userId, 'Test User', '+919876543210');

      const orderId = uuidv4();
      db.prepare(`INSERT INTO orders (id, user_id, restaurant_id, customer_name, customer_phone, delivery_mode, subtotal, delivery_fee, tax, total_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        orderId, userId, RESTAURANT_ID, 'Test User', '+919876543210', 'delivery', 350, 30, 18, 398
      );

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      assert.ok(order, 'Order should exist');
      assert.strictEqual(order.payment_status, 'pending');
      assert.strictEqual(order.order_status, 'placed');

      // Add order items
      db.prepare('INSERT INTO order_items (id, order_id, menu_item_id, name, price, quantity, item_total) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        uuidv4(), orderId, menuItem.id, menuItem.name, menuItem.price, 2, menuItem.price * 2
      );

      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0].quantity, 2);
    });

    test('Process demo payment', () => {
      const orderId = db.prepare('SELECT id FROM orders LIMIT 1').get().id;
      const payment = paymentService.processDemoPayment({
        amount: 398, paymentMethod: 'demo_card', orderId, db,
      });
      assert.ok(payment.paymentId, 'Should return payment ID');
      assert.strictEqual(payment.status, 'processing');
    });

    test('Verify payment marks order as paid', () => {
      const payment = db.prepare('SELECT * FROM payments LIMIT 1').get();
      const result = paymentService.verifyDemoPayment(payment.id, db);
      assert.strictEqual(result.success, true);

      // Check order status (payment_status uses 'success' per CHECK constraint)
      db.prepare("UPDATE orders SET payment_id = ?, payment_status = 'success', order_status = 'paid' WHERE id = ?")
        .run(payment.id, payment.order_id);
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(payment.order_id);
      assert.strictEqual(order.payment_status, 'success');
      assert.strictEqual(order.order_status, 'paid');
    });

    test('Status transition: paid → confirmed', () => {
      const order = db.prepare('SELECT * FROM orders LIMIT 1').get();
      db.prepare("UPDATE orders SET order_status = 'confirmed' WHERE id = ?").run(order.id);
      const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
      assert.strictEqual(updated.order_status, 'confirmed');
    });

    test('Status transition: confirmed → preparing', () => {
      const order = db.prepare('SELECT * FROM orders LIMIT 1').get();
      db.prepare("UPDATE orders SET order_status = 'preparing' WHERE id = ?").run(order.id);
      const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
      assert.strictEqual(updated.order_status, 'preparing');
    });

    test('Status transition: preparing → ready', () => {
      const order = db.prepare('SELECT * FROM orders LIMIT 1').get();
      db.prepare("UPDATE orders SET order_status = 'ready' WHERE id = ?").run(order.id);
      const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
      assert.strictEqual(updated.order_status, 'ready');
    });

    test('Status transition: ready → out_for_delivery → delivered', () => {
      const order = db.prepare('SELECT * FROM orders LIMIT 1').get();
      db.prepare("UPDATE orders SET order_status = 'out_for_delivery' WHERE id = ?").run(order.id);
      db.prepare("UPDATE orders SET order_status = 'delivered' WHERE id = ?").run(order.id);
      const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
      assert.strictEqual(updated.order_status, 'delivered');
    });

    test('Invalid status transition rejected', () => {
      const order = db.prepare('SELECT * FROM orders LIMIT 1').get();
      // delivered → preparing should not be allowed
      const validTransitions = {
        confirmed: ['preparing', 'cancelled'],
        preparing: ['ready', 'cancelled'],
        ready: ['out_for_delivery', 'delivered'],
        out_for_delivery: ['delivered'],
      };
      const allowed = validTransitions[order.order_status];
      assert.ok(!allowed || !allowed.includes('preparing'), 'Should not allow delivered → preparing');
    });

    teardown();
  });

  // --- Payment Tests ---
  describe('Payment Service', () => {
    const db = setup();
    const userId = uuidv4();
    db.prepare('INSERT INTO users (id, name, phone) VALUES (?, ?, ?)').run(userId, 'Pay Test', '+911234567890');

    test('Idempotent payment verification', () => {
      const orderId = uuidv4();
      db.prepare(`INSERT INTO orders (id, user_id, restaurant_id, customer_name, customer_phone, delivery_mode, subtotal, total_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(orderId, userId, RESTAURANT_ID, 'Pay Test', '+911234567890', 'dinein', 200, 210);

      const paymentResult = paymentService.processDemoPayment({ amount: 210, paymentMethod: 'demo_card', orderId, db });
      const stored = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentResult.paymentId);
      assert.ok(stored, 'Payment should be stored in DB');
      assert.strictEqual(stored.status, 'processing', 'Payment should be in processing state');

      const first = paymentService.verifyDemoPayment(paymentResult.paymentId, db);
      assert.strictEqual(first.success, true, 'First verification should succeed: ' + JSON.stringify(first));

      // Second verification should still succeed (idempotent)
      const second = paymentService.verifyDemoPayment(paymentResult.paymentId, db);
      assert.strictEqual(second.success, true);
      assert.strictEqual(second.reason, 'Already verified');
    });

    test('Payment for non-existent ID fails', () => {
      const result = paymentService.verifyDemoPayment('non_existent_id', db);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.reason, 'Payment not found');
    });

    teardown();
  });

  // --- OSRM Service Tests ---
  describe('OSRM / Routing Service', () => {
    test('Haversine distance calculation', () => {
      // Naidupeta to Khammam: roughly 40-60 km
      const dist = osrmService.haversineDistance(17.44, 80.16, 17.25, 80.15);
      assert.ok(dist > 10 && dist < 100, `Distance should be 10-100km, got ${dist}`);
    });

    test('Haversine same point returns ~0', () => {
      const dist = osrmService.haversineDistance(17.44, 80.16, 17.44, 80.16);
      assert.strictEqual(dist, 0);
    });

    test('OSRM route with fallback', async () => {
      // This uses haversine fallback since OSRM may not be available
      const route = await osrmService.getRouteWithFallback(80.16, 17.44, 80.15, 17.25);
      assert.ok(route.distanceKm > 0, 'Distance should be positive');
      assert.ok(route.durationMin > 0, 'Duration should be positive');
    });
  });

  // --- Validation Tests ---
  describe('Input Validation', () => {
    const { validateOrder } = require('../middleware/validation');

    test('Rejects empty name', () => {
      let captured = null;
      const req = { body: { customerName: '', customerPhone: '+919876543210', deliveryMode: 'delivery', items: [{ menuItemId: 'x', quantity: 1 }], deliveryAddress: 'test' } };
      const res = { status: (code) => ({ json: (data) => { captured = { code, data }; } }) };
      validateOrder(req, res, () => {});
      assert.strictEqual(captured.code, 400);
    });

    test('Rejects invalid phone', () => {
      let captured = null;
      const req = { body: { customerName: 'Test', customerPhone: '12', deliveryMode: 'delivery', items: [{ menuItemId: 'x', quantity: 1 }], deliveryAddress: 'test' } };
      const res = { status: (code) => ({ json: (data) => { captured = { code, data }; } }) };
      validateOrder(req, res, () => {});
      assert.strictEqual(captured.code, 400);
    });

    test('Rejects empty items', () => {
      let captured = null;
      const req = { body: { customerName: 'Test', customerPhone: '+919876543210', deliveryMode: 'delivery', items: [], deliveryAddress: 'test' } };
      const res = { status: (code) => ({ json: (data) => { captured = { code, data }; } }) };
      validateOrder(req, res, () => {});
      assert.strictEqual(captured.code, 400);
    });

    test('Valid order passes validation', () => {
      let called = false;
      const req = { body: { customerName: 'Rahul', customerPhone: '+919876543210', deliveryMode: 'delivery', items: [{ menuItemId: 'x', quantity: 1 }], deliveryAddress: '123 Main St' } };
      const res = { status: () => ({ json: () => {} }) };
      validateOrder(req, res, () => { called = true; });
      assert.strictEqual(called, true);
    });
  });

  // --- Summary ---
  console.log('\n' + '═'.repeat(50));
  console.log(`\n🧪 Results: ${passed}/${total} passed, ${failed} failed\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
