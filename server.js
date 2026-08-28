/**
 * Dheeran Restaurant — Thin Express Server
 *
 * This server ONLY handles:
 * 1. ntfy notifications (server-side secret)
 * 2. OSRM route proxy (avoids CORS issues)
 * 3. Static file serving
 *
 * All database operations go directly to Supabase from the frontend.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// In production, also serve the old root index.html as fallback
const fs = require('fs');

const NTFY_SERVER_URL = process.env.NTFY_SERVER_URL || 'https://ntfy.sh';
const NTFY_TOPIC = process.env.NTFY_TOPIC || 'restaurant-orders-8f72x91k';
const OSRM_BASE_URL = process.env.OSRM_BASE_URL || 'http://router.project-osrm.org';

// =====================
// MIDDLEWARE
// =====================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.tile.openstreetmap.org", "https://*.supabase.co", "https://unpkg.com", "https://cdn.jsdelivr.net"],
      connectSrc: ["'self'", "https://*.tile.openstreetmap.org", "https://*.supabase.co", "https://ntfy.sh", "http://router.project-osrm.org", "https://router.project-osrm.org", "https://nominatim.openstreetmap.org"],
    },
  },
}));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// =====================
// NTfy NOTIFICATION ENDPOINT
// =====================

app.post('/api/ntfy/order', apiLimiter, async (req, res) => {
  const { order } = req.body;
  if (!order || !order.order_number || !order.customer_name) {
    return res.status(400).json({ error: 'Invalid order data' });
  }

  const itemsList = (order.items || [])
    .map(i => `${i.quantity} × ${i.item_name}`)
    .join('\n');

  const message = `🍔 NEW PAID ORDER

Order #${order.order_number}

Customer:
${order.customer_name}
${order.customer_phone || ''}

Items:
${itemsList || 'N/A'}

Total:
₹${order.total_amount}

Delivery:
${order.delivery_address || 'N/A'}
${order.distance_km ? `Distance: ${order.distance_km} km` : ''}
${order.estimated_minutes ? `ETA: ~${order.estimated_minutes} min` : ''}

Payment:
Demo Payment — PAID ✓

Status:
NEW ORDER`;

  try {
    const response = await fetch(`${NTFY_SERVER_URL}/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Title': `🍕 New Order #${order.order_number}`,
        'Tags': 'warning,star',
        'Priority': 'high',
      },
      body: message,
    });

    if (!response.ok) {
      console.error(`ntfy failed: HTTP ${response.status}`);
      return res.status(502).json({ error: 'Notification delivery failed' });
    }

    console.log(`✅ ntfy sent for Order #${order.order_number}`);
    res.json({ success: true });
  } catch (err) {
    console.error('ntfy error:', err.message);
    res.status(502).json({ error: 'Notification service unavailable' });
  }
});

// Status update notification
app.post('/api/ntfy/status', apiLimiter, async (req, res) => {
  const { order_number, customer_name, total_amount, new_status } = req.body;
  if (!order_number || !new_status) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const emoji = { accepted: '👨‍🍳', preparing: '🔥', ready: '📦', out_for_delivery: '🛵', delivered: '✅', cancelled: '❌' };

  try {
    await fetch(`${NTFY_SERVER_URL}/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Title': `${emoji[new_status] || '📋'} Order #${order_number}: ${new_status}`,
        'Tags': 'white_check_mark',
      },
      body: `Order #${order_number} → ${new_status.toUpperCase()}\nCustomer: ${customer_name || 'N/A'}\nTotal: ₹${total_amount || 0}`,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('ntfy status error:', err.message);
    res.json({ success: false, error: err.message }); // Don't fail the request
  }
});

// =====================
// OSRM ROUTE PROXY
// =====================

app.post('/api/route', apiLimiter, async (req, res) => {
  const { customerLat, customerLng, restaurantLat, restaurantLng } = req.body;
  if (!customerLat || !customerLng) {
    return res.status(400).json({ error: 'Customer coordinates required' });
  }

  const rLat = restaurantLat || 17.44;
  const rLng = restaurantLng || 80.16;
  const coordinates = `${rLng},${rLat};${customerLng},${customerLat}`;
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OSRM HTTP ${response.status}`);
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes?.length) {
      // Fallback to haversine
      const dist = haversineDistance(rLat, rLng, customerLat, customerLng);
      return res.json({
        distanceKm: dist,
        durationMin: Math.ceil(dist * 2.5),
        deliveryFee: dist <= 3 ? 30 : 30 + Math.ceil(dist - 3) * 10,
        geometry: null,
        fallback: true,
      });
    }

    const route = data.routes[0];
    const distKm = Math.round(route.distance / 1000 * 10) / 10;
    const durMin = Math.ceil(route.duration / 60);
    let fee = distKm <= 3 ? 30 : 30 + Math.ceil(distKm - 3) * 10;

    res.json({
      distanceKm: distKm,
      durationMin: durMin,
      deliveryFee: fee,
      geometry: route.geometry,
      fallback: false,
    });
  } catch (err) {
    // Haversine fallback
    const dist = haversineDistance(rLat, rLng, customerLat, customerLng);
    res.json({
      distanceKm: dist,
      durationMin: Math.ceil(dist * 2.5),
      deliveryFee: dist <= 3 ? 30 : 30 + Math.ceil(dist - 3) * 10,
      geometry: null,
      fallback: true,
    });
  }
});

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

// =====================
// HEALTH CHECK
// =====================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), demo: true, backend: 'supabase' });
});

// =====================
// SPA ROUTES
// =====================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/menu', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages', 'menu.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages', 'checkout.html')));
app.get('/order/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages', 'order.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages', 'dashboard.html')));

app.get('/{*splat}', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// =====================
// START
// =====================
const server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   🍕 Dheeran Restaurant — Supabase Mode     ║
║   Running on http://localhost:${PORT}            ║
║   DB: Supabase (client-side)                ║
║   Server: ntfy + OSRM proxy only            ║
║   Mode: DEMO - No real money charged        ║
╚══════════════════════════════════════════════╝
  `);
});

process.on('SIGINT', () => { server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });

module.exports = app;
