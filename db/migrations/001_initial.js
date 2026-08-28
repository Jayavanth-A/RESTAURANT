/**
 * Migration 001: Create initial schema
 * Tables: users, restaurants, menu_items, orders, order_items, payments
 */

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS restaurants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      image_url TEXT,
      category TEXT NOT NULL,
      diet TEXT CHECK(diet IN ('veg', 'nonveg')) NOT NULL,
      is_available INTEGER DEFAULT 1,
      prep_time_min INTEGER DEFAULT 10,
      is_bestseller INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number INTEGER,
      user_id TEXT NOT NULL,
      restaurant_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      delivery_address TEXT,
      customer_latitude REAL,
      customer_longitude REAL,
      delivery_mode TEXT CHECK(delivery_mode IN ('dinein', 'takeaway', 'delivery')) NOT NULL DEFAULT 'delivery',
      distance_km REAL,
      estimated_minutes INTEGER,
      subtotal REAL NOT NULL DEFAULT 0,
      delivery_fee REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      payment_id TEXT,
      payment_status TEXT CHECK(payment_status IN ('pending', 'success', 'failed', 'refunded')) DEFAULT 'pending',
      order_status TEXT CHECK(order_status IN ('placed', 'paid', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled')) DEFAULT 'placed',
      special_instructions TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      menu_item_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      item_total REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      payment_method TEXT CHECK(payment_method IN ('demo_card', 'demo_upi', 'cod')) NOT NULL,
      amount REAL NOT NULL,
      status TEXT CHECK(status IN ('processing', 'success', 'failed')) DEFAULT 'processing',
      payment_reference TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      verified_at TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
  `);

  console.log('✅ Migration 001: Schema created successfully');
}

function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS payments;
    DROP TABLE IF EXISTS order_items;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS menu_items;
    DROP TABLE IF EXISTS restaurants;
    DROP TABLE IF EXISTS users;
  `);
  console.log('⚠️ Migration 001: Schema dropped');
}

module.exports = { up, down };
