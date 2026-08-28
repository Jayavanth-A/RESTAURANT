/**
 * Supabase Schema Setup Script
 * Run this once to create all tables: node setup-supabase.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey || supabaseKey === 'your-anon-key-here') {
  console.error('❌ Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

console.log(`Connecting to Supabase: ${supabaseUrl}`);
const sb = createClient(supabaseUrl, supabaseKey);

const SQL = `
-- Restaurants
CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL DEFAULT 17.44,
  longitude DOUBLE PRECISION NOT NULL DEFAULT 80.16,
  phone TEXT,
  image_url TEXT,
  owner_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DOUBLE PRECISION NOT NULL,
  image_url TEXT,
  category TEXT NOT NULL,
  diet TEXT CHECK(diet IN ('veg', 'nonveg')) NOT NULL DEFAULT 'veg',
  is_available BOOLEAN DEFAULT true,
  is_bestseller BOOLEAN DEFAULT false,
  prep_time_min INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number SERIAL,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_address TEXT,
  delivery_latitude DOUBLE PRECISION,
  delivery_longitude DOUBLE PRECISION,
  delivery_mode TEXT CHECK(delivery_mode IN ('dinein', 'takeaway', 'delivery')) DEFAULT 'delivery',
  distance_km DOUBLE PRECISION,
  estimated_minutes INTEGER,
  subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
  delivery_fee DOUBLE PRECISION NOT NULL DEFAULT 0,
  tax DOUBLE PRECISION NOT NULL DEFAULT 0,
  discount DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  payment_status TEXT CHECK(payment_status IN ('pending', 'paid', 'failed', 'refunded')) DEFAULT 'pending',
  payment_method TEXT,
  payment_id TEXT,
  order_status TEXT CHECK(order_status IN ('pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled')) DEFAULT 'pending',
  special_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price DOUBLE PRECISION NOT NULL,
  subtotal DOUBLE PRECISION NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_menu_rest ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_cat ON menu_items(category);
CREATE INDEX IF NOT EXISTS idx_orders_rest ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_updated ON orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read restaurants" ON restaurants;
DROP POLICY IF EXISTS "Public read menu" ON menu_items;
DROP POLICY IF EXISTS "Anyone insert orders" ON orders;
DROP POLICY IF EXISTS "Anyone read orders" ON orders;
DROP POLICY IF EXISTS "Anyone update orders" ON orders;
DROP POLICY IF EXISTS "Anyone insert order_items" ON order_items;
DROP POLICY IF EXISTS "Anyone read order_items" ON order_items;

CREATE POLICY "Public read restaurants" ON restaurants FOR SELECT USING (true);
CREATE POLICY "Public read menu" ON menu_items FOR SELECT USING (true);
CREATE POLICY "Anyone insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone read orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Anyone update orders" ON orders FOR UPDATE USING (true);
CREATE POLICY "Anyone insert order_items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone read order_items" ON order_items FOR SELECT USING (true);
`;

const SEED = `
INSERT INTO restaurants (id, name, description, address, latitude, longitude, phone) VALUES
('dheeran-001', 'Dheeran', 'Andhra • Chinese • Biryani • North Indian. Serving Naidupeta since 2012.', 'Naidupeta, Dammapeta Mandal, Khammam District, Telangana 507306', 17.44, 80.16, '+918885621649')
ON CONFLICT (id) DO NOTHING;

INSERT INTO menu_items (id, restaurant_id, name, description, price, category, diet, is_bestseller, prep_time_min) VALUES
('m001','dheeran-001','Paneer 65','Crisp, tangy, Andhra-style cottage cheese',280,'starters','veg',false,10),
('m002','dheeran-001','Gobi Manchurian','Crispy cauliflower in tangy Manchurian sauce',270,'starters','veg',false,10),
('m003','dheeran-001','Veg Spring Rolls','Crunchy, stuffed with seasoned vegetables',240,'starters','veg',false,8),
('m004','dheeran-001','Paneer Pakoda','Golden-fried cottage cheese fritters',260,'starters','veg',false,10),
('m005','dheeran-001','Chilli Chicken','Wok-tossed, spicy Indo-Chinese classic',320,'starters','nonveg',true,12),
('m006','dheeran-001','Chicken Lollipop','Deep-fried drumettes, house masala dip',350,'starters','nonveg',true,14),
('m007','dheeran-001','Chicken 65','Iconic Andhra deep-fried spiced chicken',340,'starters','nonveg',true,12),
('m008','dheeran-001','Fish Fry','Marinated river fish, shallow-fried crisp',380,'starters','nonveg',false,15),
('m009','dheeran-001','Prawns Fry','Spicy Andhra-style shallow-fried prawns',420,'starters','nonveg',false,14),
('m010','dheeran-001','Dal Tadka','Slow-cooked lentils, ghee tempering',210,'mains','veg',false,10),
('m011','dheeran-001','Paneer Bhurji','Scrambled paneer, onion, tomatoes, spices',260,'mains','veg',false,10),
('m012','dheeran-001','Paneer Butter Masala','Rich tomato gravy, creamy paneer cubes',280,'mains','veg',false,12),
('m013','dheeran-001','Veg Kurma','Mixed vegetables in coconut-based gravy',230,'mains','veg',false,12),
('m014','dheeran-001','Andhra Chicken Curry','Fiery, home-style Andhra masala chicken',300,'mains','nonveg',true,16),
('m015','dheeran-001','Chicken Kheema with Egg Fry','Minced chicken curry with fried egg on top',310,'mains','nonveg',false,14),
('m016','dheeran-001','Mutton Rogan Josh','Slow-cooked Kashmiri-style mutton curry',420,'mains','nonveg',false,20),
('m017','dheeran-001','Egg Curry','Boiled eggs in spicy Andhra masala',200,'mains','nonveg',false,10),
('m018','dheeran-001','Chicken Boneless Biryani','Dum-cooked, served with raita & shorba',350,'biryani','nonveg',true,18),
('m019','dheeran-001','Mutton Biryani','Slow dum, aromatic long-grain basmati',420,'biryani','nonveg',true,22),
('m020','dheeran-001','Veg Biryani','Garden-fresh vegetables, dum-cooked',250,'biryani','veg',false,15),
('m021','dheeran-001','Veg Fried Rice','Wok-tossed, Indo-Chinese style',220,'biryani','veg',false,8),
('m022','dheeran-001','Egg Fried Rice','Classic street-style favourite',230,'biryani','nonveg',false,8),
('m023','dheeran-001','Chicken Fried Rice','Loaded with boneless chicken pieces',280,'biryani','nonveg',false,10),
('m024','dheeran-001','Jeera Rice','Fluffy basmati, cumin-infused',160,'biryani','veg',false,6),
('m025','dheeran-001','Butter Naan','Tandoor-fresh, brushed with ghee',60,'breads','veg',false,5),
('m026','dheeran-001','Garlic Naan','Loaded with fresh garlic & butter',70,'breads','veg',false,5),
('m027','dheeran-001','Roti','Whole-wheat tandoor bread',20,'breads','veg',false,4),
('m028','dheeran-001','Kulcha','Stuffed, pan-tossed, served hot',65,'breads','veg',false,6),
('m029','dheeran-001','Parotta','Flaky, layered South Indian bread',40,'breads','veg',false,5),
('m030','dheeran-001','Hot & Sour Soup','Chilli-forward, veg or chicken',150,'soups','veg',false,6),
('m031','dheeran-001','Sweet Corn Soup','Comfort classic, veg or chicken',150,'soups','veg',false,6),
('m032','dheeran-001','Manchow Soup','Crispy noodles on top, tangy base',160,'soups','veg',false,6),
('m033','dheeran-001','Chicken Soup','Peppery clear broth with shredded chicken',170,'soups','nonveg',false,7),
('m034','dheeran-001','Masala Chai','Spiced, milky, kadak',40,'beverages','veg',false,3),
('m035','dheeran-001','Fresh Lime Soda','Sweet or salt, fizzy',50,'beverages','veg',false,2),
('m036','dheeran-001','Mango Lassi','Thick, chilled, Alphonso-style',80,'beverages','veg',true,3),
('m037','dheeran-001','Cold Coffee','Iced, blended, topped with cream',90,'beverages','veg',false,4),
('m038','dheeran-001','Buttermilk (Chaas)','Cool, salty, cumin-spiked',40,'beverages','veg',false,2),
('m039','dheeran-001','Coke','Chilled 300ml bottle',40,'beverages','veg',false,1),
('m040','dheeran-001','Thums Up','Chilled 300ml bottle',40,'beverages','veg',false,1)
ON CONFLICT (id) DO NOTHING;
`;

async function setup() {
  console.log('📝 Creating tables...');
  
  // Try using rpc to execute SQL
  const { data, error } = await sb.rpc('exec_sql', { query: SQL }).catch(() => ({ data: null, error: { message: 'rpc not available' } }));
  
  if (error && error.message !== 'rpc not available') {
    console.log('⚠️  RPC approach failed:', error.message);
  }
  
  // Alternative: Try direct table creation via REST
  console.log('🔍 Checking if tables exist...');
  const { data: test, error: testErr } = await sb.from('restaurants').select('id').limit(1);
  
  if (testErr && testErr.message.includes('Could not find the table')) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('⚠️  Tables do not exist yet in your Supabase project.');
    console.log('');
    console.log('Please run the SQL manually:');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Go to SQL Editor');
    console.log('4. Paste and run the contents of supabase/schema.sql');
    console.log('5. Then paste and run supabase/seed.sql');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    
    // Write SQL to a combined file for easy copy-paste
    const fs = require('fs');
    fs.writeFileSync('supabase/combined-setup.sql', SQL + '\n\n' + SEED);
    console.log('📄 Combined SQL written to: supabase/combined-setup.sql');
    console.log('   Copy the entire file contents into the Supabase SQL Editor.');
    return;
  }
  
  if (testErr) {
    console.log('⚠️  Error checking tables:', testErr.message);
    return;
  }
  
  console.log('✅ Tables exist! Checking data...');
  
  // Check if seed data exists
  const { data: restaurants } = await sb.from('restaurants').select('id').limit(1);
  if (restaurants && restaurants.length > 0) {
    console.log('✅ Restaurant data exists');
  } else {
    console.log('📝 Seeding restaurant data...');
    const { error: seedErr } = await sb.from('restaurants').insert({
      id: 'dheeran-001', name: 'Dheeran',
      description: 'Andhra • Chinese • Biryani • North Indian. Serving Naidupeta since 2012.',
      address: 'Naidupeta, Dammapeta Mandal, Khammam District, Telangana 507306',
      latitude: 17.44, longitude: 80.16, phone: '+918885621649'
    });
    if (seedErr) console.log('Restaurant seed:', seedErr.message);
    else console.log('✅ Restaurant seeded');
  }
  
  const { data: menuItems } = await sb.from('menu_items').select('id').limit(1);
  if (menuItems && menuItems.length > 0) {
    console.log('✅ Menu items exist');
  } else {
    console.log('⚠️  Menu items need to be seeded via SQL. Run supabase/seed.sql');
  }
  
  console.log('\n✅ Setup complete!');
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
