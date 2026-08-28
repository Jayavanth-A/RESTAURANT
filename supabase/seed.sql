-- =============================================
-- DHEERAN RESTAURANT — SEED DATA
-- Run after schema.sql in the Supabase SQL Editor
-- =============================================

-- Restaurant
INSERT INTO restaurants (id, name, description, address, latitude, longitude, phone)
VALUES (
  'dheeran-001',
  'Dheeran',
  'Andhra • Chinese • Biryani • North Indian. Serving Naidupeta since 2012.',
  'Naidupeta, Dammapeta Mandal, Khammam District, Telangana 507306',
  17.44,
  80.16,
  '+918885621649'
) ON CONFLICT (id) DO NOTHING;

-- Menu Items
INSERT INTO menu_items (id, restaurant_id, name, description, price, category, diet, is_bestseller, prep_time_min) VALUES
-- Starters - Veg
('m001', 'dheeran-001', 'Paneer 65', 'Crisp, tangy, Andhra-style cottage cheese', 280, 'starters', 'veg', false, 10),
('m002', 'dheeran-001', 'Gobi Manchurian', 'Crispy cauliflower in tangy Manchurian sauce', 270, 'starters', 'veg', false, 10),
('m003', 'dheeran-001', 'Veg Spring Rolls', 'Crunchy, stuffed with seasoned vegetables', 240, 'starters', 'veg', false, 8),
('m004', 'dheeran-001', 'Paneer Pakoda', 'Golden-fried cottage cheese fritters', 260, 'starters', 'veg', false, 10),
-- Starters - Non-Veg
('m005', 'dheeran-001', 'Chilli Chicken', 'Wok-tossed, spicy Indo-Chinese classic', 320, 'starters', 'nonveg', true, 12),
('m006', 'dheeran-001', 'Chicken Lollipop', 'Deep-fried drumettes, house masala dip', 350, 'starters', 'nonveg', true, 14),
('m007', 'dheeran-001', 'Chicken 65', 'Iconic Andhra deep-fried spiced chicken', 340, 'starters', 'nonveg', true, 12),
('m008', 'dheeran-001', 'Fish Fry', 'Marinated river fish, shallow-fried crisp', 380, 'starters', 'nonveg', false, 15),
('m009', 'dheeran-001', 'Prawns Fry', 'Spicy Andhra-style shallow-fried prawns', 420, 'starters', 'nonveg', false, 14),
-- Main Course - Veg
('m010', 'dheeran-001', 'Dal Tadka', 'Slow-cooked lentils, ghee tempering', 210, 'mains', 'veg', false, 10),
('m011', 'dheeran-001', 'Paneer Bhurji', 'Scrambled paneer, onion, tomatoes, spices', 260, 'mains', 'veg', false, 10),
('m012', 'dheeran-001', 'Paneer Butter Masala', 'Rich tomato gravy, creamy paneer cubes', 280, 'mains', 'veg', false, 12),
('m013', 'dheeran-001', 'Veg Kurma', 'Mixed vegetables in coconut-based gravy', 230, 'mains', 'veg', false, 12),
-- Main Course - Non-Veg
('m014', 'dheeran-001', 'Andhra Chicken Curry', 'Fiery, home-style Andhra masala chicken', 300, 'mains', 'nonveg', true, 16),
('m015', 'dheeran-001', 'Chicken Kheema with Egg Fry', 'Minced chicken curry with fried egg on top', 310, 'mains', 'nonveg', false, 14),
('m016', 'dheeran-001', 'Mutton Rogan Josh', 'Slow-cooked Kashmiri-style mutton curry', 420, 'mains', 'nonveg', false, 20),
('m017', 'dheeran-001', 'Egg Curry', 'Boiled eggs in spicy Andhra masala', 200, 'mains', 'nonveg', false, 10),
-- Rice & Biryani
('m018', 'dheeran-001', 'Chicken Boneless Biryani', 'Dum-cooked, served with raita & shorba', 350, 'biryani', 'nonveg', true, 18),
('m019', 'dheeran-001', 'Mutton Biryani', 'Slow dum, aromatic long-grain basmati', 420, 'biryani', 'nonveg', true, 22),
('m020', 'dheeran-001', 'Veg Biryani', 'Garden-fresh vegetables, dum-cooked', 250, 'biryani', 'veg', false, 15),
('m021', 'dheeran-001', 'Veg Fried Rice', 'Wok-tossed, Indo-Chinese style', 220, 'biryani', 'veg', false, 8),
('m022', 'dheeran-001', 'Egg Fried Rice', 'Classic street-style favourite', 230, 'biryani', 'nonveg', false, 8),
('m023', 'dheeran-001', 'Chicken Fried Rice', 'Loaded with boneless chicken pieces', 280, 'biryani', 'nonveg', false, 10),
('m024', 'dheeran-001', 'Jeera Rice', 'Fluffy basmati, cumin-infused', 160, 'biryani', 'veg', false, 6),
-- Breads
('m025', 'dheeran-001', 'Butter Naan', 'Tandoor-fresh, brushed with ghee', 60, 'breads', 'veg', false, 5),
('m026', 'dheeran-001', 'Garlic Naan', 'Loaded with fresh garlic & butter', 70, 'breads', 'veg', false, 5),
('m027', 'dheeran-001', 'Roti', 'Whole-wheat tandoor bread', 20, 'breads', 'veg', false, 4),
('m028', 'dheeran-001', 'Kulcha', 'Stuffed, pan-tossed, served hot', 65, 'breads', 'veg', false, 6),
('m029', 'dheeran-001', 'Parotta', 'Flaky, layered South Indian bread', 40, 'breads', 'veg', false, 5),
-- Soups
('m030', 'dheeran-001', 'Hot & Sour Soup', 'Chilli-forward, veg or chicken', 150, 'soups', 'veg', false, 6),
('m031', 'dheeran-001', 'Sweet Corn Soup', 'Comfort classic, veg or chicken', 150, 'soups', 'veg', false, 6),
('m032', 'dheeran-001', 'Manchow Soup', 'Crispy noodles on top, tangy base', 160, 'soups', 'veg', false, 6),
('m033', 'dheeran-001', 'Chicken Soup', 'Peppery clear broth with shredded chicken', 170, 'soups', 'nonveg', false, 7),
-- Beverages
('m034', 'dheeran-001', 'Masala Chai', 'Spiced, milky, kadak', 40, 'beverages', 'veg', false, 3),
('m035', 'dheeran-001', 'Fresh Lime Soda', 'Sweet or salt, fizzy', 50, 'beverages', 'veg', false, 2),
('m036', 'dheeran-001', 'Mango Lassi', 'Thick, chilled, Alphonso-style', 80, 'beverages', 'veg', true, 3),
('m037', 'dheeran-001', 'Cold Coffee', 'Iced, blended, topped with cream', 90, 'beverages', 'veg', false, 4),
('m038', 'dheeran-001', 'Buttermilk (Chaas)', 'Cool, salty, cumin-spiked', 40, 'beverages', 'veg', false, 2),
('m039', 'dheeran-001', 'Coke', 'Chilled 300ml bottle', 40, 'beverages', 'veg', false, 1),
('m040', 'dheeran-001', 'Thums Up', 'Chilled 300ml bottle', 40, 'beverages', 'veg', false, 1)
ON CONFLICT (id) DO NOTHING;
