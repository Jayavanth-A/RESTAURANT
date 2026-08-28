/**
 * Dheeran — Shared Application Utilities
 * Supabase-powered data operations, cart management, toasts, helpers
 */

// =====================
// SUPABASE HELPERS
// =====================

const DB = {
  getClient() {
    return getSupabase();
  },

  async getMenu(restaurantId, { category, diet, search } = {}) {
    const sb = this.getClient();
    if (!sb) throw new Error('Supabase not initialized');
    let query = sb.from('menu_items').select('*').eq('restaurant_id', restaurantId).eq('is_available', true);
    if (category) query = query.eq('category', category);
    if (diet && ['veg', 'nonveg'].includes(diet)) query = query.eq('diet', diet);
    if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    query = query.order('is_bestseller', { ascending: false }).order('name');
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getRestaurant(id) {
    const sb = this.getClient();
    const { data, error } = await sb.from('restaurants').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async getOrders(restaurantId, status) {
    const sb = this.getClient();
    let query = sb.from('orders').select('*, order_items(*)').eq('restaurant_id', restaurantId);
    if (status) query = query.eq('order_status', status);
    query = query.order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getOrder(orderId) {
    const sb = this.getClient();
    const { data: order, error: e1 } = await sb.from('orders').select('*').eq('id', orderId).single();
    if (e1) throw e1;
    const { data: items, error: e2 } = await sb.from('order_items').select('*').eq('order_id', orderId);
    if (e2) throw e2;
    return { ...order, items: items || [] };
  },

  async createOrder(orderData) {
    const sb = this.getClient();
    // Insert order
    const { data: order, error: e1 } = await sb.from('orders').insert({
      restaurant_id: orderData.restaurantId,
      customer_name: orderData.customerName,
      customer_phone: orderData.customerPhone,
      delivery_address: orderData.deliveryAddress || null,
      delivery_latitude: orderData.customerLat || null,
      delivery_longitude: orderData.customerLng || null,
      delivery_mode: orderData.deliveryMode || 'delivery',
      distance_km: orderData.distanceKm || null,
      estimated_minutes: orderData.estimatedMinutes || null,
      subtotal: orderData.subtotal,
      delivery_fee: orderData.deliveryFee || 0,
      tax: orderData.tax || 0,
      discount: orderData.discount || 0,
      total_amount: orderData.totalAmount,
      payment_status: 'paid',
      payment_method: orderData.paymentMethod || 'demo',
      payment_id: orderData.paymentId,
      order_status: 'pending',
      special_instructions: orderData.specialInstructions || null,
    }).select().single();
    if (e1) throw e1;

    // Insert order items
    const items = orderData.items.map(i => ({
      order_id: order.id,
      menu_item_id: i.menuItemId,
      item_name: i.name,
      quantity: i.quantity,
      price: i.price,
      subtotal: i.price * i.quantity,
    }));
    const { error: e2 } = await sb.from('order_items').insert(items);
    if (e2) throw e2;

    return order;
  },

  async updateOrderStatus(orderId, newStatus) {
    const sb = this.getClient();
    const { data, error } = await sb.from('orders').update({ order_status: newStatus }).eq('id', orderId).select().single();
    if (error) throw error;
    return data;
  },

  async getDashboardStats(restaurantId) {
    const sb = this.getClient();
    const { data: total } = await sb.from('orders').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId);
    const { data: paid } = await sb.from('orders').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId).eq('payment_status', 'paid');
    const { data: preparing } = await sb.from('orders').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId).eq('order_status', 'preparing');
    const { data: todayOrders } = await sb.from('orders').select('total_amount').eq('restaurant_id', restaurantId).eq('payment_status', 'paid').gte('created_at', new Date().toISOString().split('T')[0]);
    const revenueToday = (todayOrders || []).reduce((s, o) => s + (o.total_amount || 0), 0);
    return {
      totalOrders: total?.length || 0,
      paidOrders: paid?.length || 0,
      preparingOrders: preparing?.length || 0,
      deliveredToday: todayOrders?.length || 0,
      revenueToday,
    };
  },
};

// =====================
// SERVER API (ntfy, OSRM)
// =====================

const ServerAPI = {
  async post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
    return data;
  },

  async notifyOrder(order) {
    return this.post('/api/ntfy/order', { order });
  },

  async notifyStatus(order_number, customer_name, total_amount, new_status) {
    return this.post('/api/ntfy/status', { order_number, customer_name, total_amount, new_status });
  },

  async getRoute(customerLat, customerLng, restaurantLat, restaurantLng) {
    return this.post('/api/route', { customerLat, customerLng, restaurantLat, restaurantLng });
  },
};

// =====================
// CART MANAGEMENT
// =====================

const Cart = {
  KEY: 'dheeran_cart',

  get() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
    catch { return []; }
  },

  save(items) { localStorage.setItem(this.KEY, JSON.stringify(items)); },

  add(menuItem) {
    const items = this.get();
    const existing = items.find(i => i.menuItemId === menuItem.id);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + 1, 99);
    } else {
      items.push({
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        diet: menuItem.diet,
        quantity: 1,
      });
    }
    this.save(items);
    this.updateBadge();
    return items;
  },

  updateQuantity(menuItemId, delta) {
    const items = this.get();
    const idx = items.findIndex(i => i.menuItemId === menuItemId);
    if (idx === -1) return items;
    items[idx].quantity += delta;
    if (items[idx].quantity <= 0) items.splice(idx, 1);
    this.save(items);
    this.updateBadge();
    return items;
  },

  remove(menuItemId) {
    this.save(this.get().filter(i => i.menuItemId !== menuItemId));
    this.updateBadge();
    return this.get();
  },

  clear() { localStorage.removeItem(this.KEY); this.updateBadge(); },
  getCount() { return this.get().reduce((s, i) => s + i.quantity, 0); },
  getSubtotal() { return this.get().reduce((s, i) => s + i.price * i.quantity, 0); },

  updateBadge() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    const count = this.getCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
    if (count > 0) { badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump'); }
  },
};

// =====================
// TOASTS
// =====================

function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  toast.innerHTML = `<span>${type === 'error' ? '⚠️' : '✓'}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// =====================
// HELPERS
// =====================

function formatCurrency(amount) { return `₹${Math.round(amount).toLocaleString('en-IN')}`; }

function getOrderStatusEmoji(status) {
  return { pending: '📝', accepted: '👨‍🍳', preparing: '🔥', ready: '📦', out_for_delivery: '🛵', delivered: '✅', cancelled: '❌' }[status] || '📋';
}

function showLoading(msg = 'Loading...') {
  let overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<div class="spinner"></div><p>${msg}</p>`;
  overlay.style.display = 'flex';
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

function getParam(name) { return new URLSearchParams(window.location.search).get(name); }

// Geolocation helper
async function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(new Error(err.code === 1 ? 'Location permission denied' : 'Unable to get location')),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// Reverse geocode using Nominatim
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
    const data = await res.json();
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

document.addEventListener('DOMContentLoaded', () => Cart.updateBadge());
