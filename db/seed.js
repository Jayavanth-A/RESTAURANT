const { v4: uuidv4 } = require('uuid');

const RESTAURANT_ID = 'rest_dheeran_001';

const RESTAURANT = {
  id: RESTAURANT_ID,
  name: 'Dheeran',
  address: 'Naidupeta, Dammapeta Mandal, Khammam District, Telangana 507306',
  latitude: parseFloat(process.env.RESTAURANT_LATITUDE) || 17.44,
  longitude: parseFloat(process.env.RESTAURANT_LONGITUDE) || 80.16,
  phone: '+918885621649',
};

const MENU_ITEMS = [
  // Starters - Veg
  { name: 'Paneer 65', description: 'Crisp, tangy, Andhra-style cottage cheese', price: 280, category: 'starters', diet: 'veg', prep_time_min: 10, is_bestseller: 0, emoji: '🧀' },
  { name: 'Gobi Manchurian', description: 'Crispy cauliflower in tangy Manchurian sauce', price: 270, category: 'starters', diet: 'veg', prep_time_min: 10, is_bestseller: 0, emoji: '🥦' },
  { name: 'Veg Spring Rolls', description: 'Crunchy, stuffed with seasoned vegetables', price: 240, category: 'starters', diet: 'veg', prep_time_min: 8, is_bestseller: 0, emoji: '🌯' },
  { name: 'Paneer Pakoda', description: 'Golden-fried cottage cheese fritters', price: 260, category: 'starters', diet: 'veg', prep_time_min: 10, is_bestseller: 0, emoji: '🧀' },
  // Starters - Non-Veg
  { name: 'Chilli Chicken', description: 'Wok-tossed, spicy Indo-Chinese classic', price: 320, category: 'starters', diet: 'nonveg', prep_time_min: 12, is_bestseller: 1, emoji: '🍗' },
  { name: 'Chicken Lollipop', description: 'Deep-fried drumettes, house masala dip', price: 350, category: 'starters', diet: 'nonveg', prep_time_min: 14, is_bestseller: 1, emoji: '🍗' },
  { name: 'Chicken 65', description: 'Iconic Andhra deep-fried spiced chicken', price: 340, category: 'starters', diet: 'nonveg', prep_time_min: 12, is_bestseller: 1, emoji: '🔥' },
  { name: 'Fish Fry', description: 'Marinated river fish, shallow-fried crisp', price: 380, category: 'starters', diet: 'nonveg', prep_time_min: 15, is_bestseller: 0, emoji: '🐟' },
  { name: 'Prawns Fry', description: 'Spicy Andhra-style shallow-fried prawns', price: 420, category: 'starters', diet: 'nonveg', prep_time_min: 14, is_bestseller: 0, emoji: '🦐' },

  // Main Course - Veg
  { name: 'Dal Tadka', description: 'Slow-cooked lentils, ghee tempering', price: 210, category: 'mains', diet: 'veg', prep_time_min: 10, is_bestseller: 0, emoji: '🍛' },
  { name: 'Paneer Bhurji', description: 'Scrambled paneer, onion, tomatoes, spices', price: 260, category: 'mains', diet: 'veg', prep_time_min: 10, is_bestseller: 0, emoji: '🧀' },
  { name: 'Paneer Butter Masala', description: 'Rich tomato gravy, creamy paneer cubes', price: 280, category: 'mains', diet: 'veg', prep_time_min: 12, is_bestseller: 0, emoji: '🍛' },
  { name: 'Veg Kurma', description: 'Mixed vegetables in coconut-based gravy', price: 230, category: 'mains', diet: 'veg', prep_time_min: 12, is_bestseller: 0, emoji: '🍛' },
  // Main Course - Non-Veg
  { name: 'Andhra Chicken Curry', description: 'Fiery, home-style Andhra masala chicken', price: 300, category: 'mains', diet: 'nonveg', prep_time_min: 16, is_bestseller: 1, emoji: '🔥' },
  { name: 'Chicken Kheema with Egg Fry', description: 'Minced chicken curry with fried egg on top', price: 310, category: 'mains', diet: 'nonveg', prep_time_min: 14, is_bestseller: 0, emoji: '🍗' },
  { name: 'Mutton Rogan Josh', description: 'Slow-cooked Kashmiri-style mutton curry', price: 420, category: 'mains', diet: 'nonveg', prep_time_min: 20, is_bestseller: 0, emoji: '🍖' },
  { name: 'Egg Curry', description: 'Boiled eggs in spicy Andhra masala', price: 200, category: 'mains', diet: 'nonveg', prep_time_min: 10, is_bestseller: 0, emoji: '🥚' },

  // Rice & Biryani
  { name: 'Chicken Boneless Biryani', description: 'Dum-cooked, served with raita & shorba', price: 350, category: 'biryani', diet: 'nonveg', prep_time_min: 18, is_bestseller: 1, emoji: '🍚' },
  { name: 'Mutton Biryani', description: 'Slow dum, aromatic long-grain basmati', price: 420, category: 'biryani', diet: 'nonveg', prep_time_min: 22, is_bestseller: 1, emoji: '🍚' },
  { name: 'Veg Biryani', description: 'Garden-fresh vegetables, dum-cooked', price: 250, category: 'biryani', diet: 'veg', prep_time_min: 15, is_bestseller: 0, emoji: '🍚' },
  { name: 'Veg Fried Rice', description: 'Wok-tossed, Indo-Chinese style', price: 220, category: 'biryani', diet: 'veg', prep_time_min: 8, is_bestseller: 0, emoji: '🍚' },
  { name: 'Egg Fried Rice', description: 'Classic street-style favourite', price: 230, category: 'biryani', diet: 'nonveg', prep_time_min: 8, is_bestseller: 0, emoji: '🍚' },
  { name: 'Chicken Fried Rice', description: 'Loaded with boneless chicken pieces', price: 280, category: 'biryani', diet: 'nonveg', prep_time_min: 10, is_bestseller: 0, emoji: '🍚' },
  { name: 'Jeera Rice', description: 'Fluffy basmati, cumin-infused', price: 160, category: 'biryani', diet: 'veg', prep_time_min: 6, is_bestseller: 0, emoji: '🍚' },

  // Breads
  { name: 'Butter Naan', description: 'Tandoor-fresh, brushed with ghee', price: 60, category: 'breads', diet: 'veg', prep_time_min: 5, is_bestseller: 0, emoji: '🫓' },
  { name: 'Garlic Naan', description: 'Loaded with fresh garlic & butter', price: 70, category: 'breads', diet: 'veg', prep_time_min: 5, is_bestseller: 0, emoji: '🫓' },
  { name: 'Roti', description: 'Whole-wheat tandoor bread', price: 20, category: 'breads', diet: 'veg', prep_time_min: 4, is_bestseller: 0, emoji: '🫓' },
  { name: 'Kulcha', description: 'Stuffed, pan-tossed, served hot', price: 65, category: 'breads', diet: 'veg', prep_time_min: 6, is_bestseller: 0, emoji: '🫓' },
  { name: 'Parotta', description: 'Flaky, layered South Indian bread', price: 40, category: 'breads', diet: 'veg', prep_time_min: 5, is_bestseller: 0, emoji: '🫓' },

  // Soups
  { name: 'Hot & Sour Soup', description: 'Chilli-forward, veg or chicken', price: 150, category: 'soups', diet: 'veg', prep_time_min: 6, is_bestseller: 0, emoji: '🥣' },
  { name: 'Sweet Corn Soup', description: 'Comfort classic, veg or chicken', price: 150, category: 'soups', diet: 'veg', prep_time_min: 6, is_bestseller: 0, emoji: '🥣' },
  { name: 'Manchow Soup', description: 'Crispy noodles on top, tangy base', price: 160, category: 'soups', diet: 'veg', prep_time_min: 6, is_bestseller: 0, emoji: '🥣' },
  { name: 'Chicken Soup', description: 'Peppery clear broth with shredded chicken', price: 170, category: 'soups', diet: 'nonveg', prep_time_min: 7, is_bestseller: 0, emoji: '🥣' },

  // Beverages
  { name: 'Masala Chai', description: 'Spiced, milky, kadak', price: 40, category: 'beverages', diet: 'veg', prep_time_min: 3, is_bestseller: 0, emoji: '☕' },
  { name: 'Fresh Lime Soda', description: 'Sweet or salt, fizzy', price: 50, category: 'beverages', diet: 'veg', prep_time_min: 2, is_bestseller: 0, emoji: '🍋' },
  { name: 'Mango Lassi', description: 'Thick, chilled, Alphonso-style', price: 80, category: 'beverages', diet: 'veg', prep_time_min: 3, is_bestseller: 1, emoji: '🥭' },
  { name: 'Cold Coffee', description: 'Iced, blended, topped with cream', price: 90, category: 'beverages', diet: 'veg', prep_time_min: 4, is_bestseller: 0, emoji: '🧊' },
  { name: 'Buttermilk (Chaas)', description: 'Cool, salty, cumin-spiked', price: 40, category: 'beverages', diet: 'veg', prep_time_min: 2, is_bestseller: 0, emoji: '🥛' },
  { name: 'Coke', description: 'Chilled 300ml bottle', price: 40, category: 'beverages', diet: 'veg', prep_time_min: 1, is_bestseller: 0, emoji: '🥤' },
  { name: 'Thums Up', description: 'Chilled 300ml bottle', price: 40, category: 'beverages', diet: 'veg', prep_time_min: 1, is_bestseller: 0, emoji: '🥤' },
];

function seed(db) {
  const existing = db.prepare('SELECT COUNT(*) as count FROM restaurants').get();
  if (existing.count > 0) {
    console.log('ℹ️  Database already seeded, skipping');
    return;
  }

  const insertRestaurant = db.prepare(
    'INSERT INTO restaurants (id, name, address, latitude, longitude, phone) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertMenu = db.prepare(
    'INSERT INTO menu_items (id, restaurant_id, name, description, price, category, diet, prep_time_min, is_bestseller, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const seedTransaction = db.transaction(() => {
    insertRestaurant.run(
      RESTAURANT.id, RESTAURANT.name, RESTAURANT.address,
      RESTAURANT.latitude, RESTAURANT.longitude, RESTAURANT.phone
    );

    for (const item of MENU_ITEMS) {
      insertMenu.run(
        uuidv4(), RESTAURANT.id, item.name, item.description,
        item.price, item.category, item.diet, item.prep_time_min,
        item.is_bestseller, `/images/${item.emoji}.svg` // placeholder
      );
    }
  });

  seedTransaction();
  console.log(`✅ Seeded restaurant "${RESTAURANT.name}" with ${MENU_ITEMS.length} menu items`);
}

module.exports = { seed, RESTAURANT_ID };
