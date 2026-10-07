import bcrypt from "bcryptjs";
import { pool } from "../../config/database";
import { logger } from "../../utils/logger";

async function seed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    logger.info("Starting database seeding...");

    // Seed Users
    logger.info("Seeding users...");
    const passwordHash = await bcrypt.hash("password123", 10);

    const users = [
      {
        email: "admin@hotel.com",
        password_hash: passwordHash,
        full_name: "Admin User",
        role: "admin",
      },
      {
        email: "manager@hotel.com",
        password_hash: passwordHash,
        full_name: "Manager User",
        role: "manager",
      },
      {
        email: "waiter@hotel.com",
        password_hash: passwordHash,
        full_name: "Waiter User",
        role: "waiter",
      },
      {
        email: "chef@hotel.com",
        password_hash: passwordHash,
        full_name: "Chef User",
        role: "chef",
      },
    ];

    for (const user of users) {
      await client.query(
        `INSERT INTO users (email, password_hash, full_name, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE
         SET
           password_hash = EXCLUDED.password_hash,
           full_name = EXCLUDED.full_name,
           role = EXCLUDED.role`,
        [user.email, user.password_hash, user.full_name, user.role]
      );
    }
    logger.info("✓ Users seeded");

    // Seed Tables
    logger.info("Seeding tables...");
    const tables = [
      {
        table_number: 1,
        table_name: "Mechi",
        capacity: 2,
        location: "Window Side",
      },
      { table_number: 2, table_name: "Koshi", capacity: 4, location: "Center" },
      {
        table_number: 3,
        table_name: "Sagarmatha",
        capacity: 4,
        location: "Corner",
      },
      {
        table_number: 4,
        table_name: "Janakpur",
        capacity: 6,
        location: "Private Room",
      },
      {
        table_number: 5,
        table_name: "Bagmati",
        capacity: 2,
        location: "Bar Area",
      },
      {
        table_number: 6,
        table_name: "Karnali",
        capacity: 8,
        location: "Party Section",
      },
    ];

    for (const table of tables) {
      await client.query(
        "INSERT INTO tables (table_number, table_name, capacity, location) VALUES ($1, $2, $3, $4)",
        [table.table_number, table.table_name, table.capacity, table.location]
      );
    }
    logger.info("✓ Tables seeded");

    // Seed categories data
    logger.info("Seeding categories...");
const mainCategories = [
  {
    name: "Beverages",
    type: "main",
    parent_id: null,
    display_order: 1,
    is_active: true,
    description: "All types of drinks including hot, cold, and alcoholic beverages",
  },
  {
    name: "Food",
    type: "main",
    parent_id: null,
    display_order: 2,
    is_active: true,
    description: "Main course items and meals",
  },
  {
    name: "Appetizers",
    type: "main",
    parent_id: null,
    display_order: 3,
    is_active: true,
    description: "Starters and small bites",
  },
  {
    name: "Desserts",
    type: "main",
    parent_id: null,
    display_order: 4,
    is_active: true,
    description: "Sweet treats and desserts",
  },
  {
    name: "Specials",
    type: "main",
    parent_id: null,
    display_order: 5,
    is_active: true,
    description: "Chef's special and seasonal items",
  },
];

// Insert main categories and store their IDs
const categoryIds: Record<string, string> = {};

for (const category of mainCategories) {
  const result = await client.query(
    `INSERT INTO categories (name, type, parent_id, display_order, is_active, description) 
     VALUES ($1, $2, $3, $4, $5, $6) 
     RETURNING id`,
    [
      category.name,
      category.type,
      category.parent_id,
      category.display_order,
      category.is_active,
      category.description,
    ]
  );
  categoryIds[category.name] = result.rows[0].id;
}

// Subcategories data
const subCategories = [
  // Beverage subcategories
  {
    name: "Hot Drinks",
    type: "sub",
    parent_name: "Beverages",
    display_order: 1,
    is_active: true,
    description: "Coffee, tea, and other hot beverages",
  },
  {
    name: "Cold Drinks",
    type: "sub",
    parent_name: "Beverages",
    display_order: 2,
    is_active: true,
    description: "Soft drinks, juices, and iced beverages",
  },
  {
    name: "Alcoholic Beverages",
    type: "sub",
    parent_name: "Beverages",
    display_order: 3,
    is_active: true,
    description: "Beer, wine, cocktails, and spirits",
  },
  {
    name: "Smoothies & Shakes",
    type: "sub",
    parent_name: "Beverages",
    display_order: 4,
    is_active: true,
    description: "Blended drinks and milkshakes",
  },

  // Food subcategories
  {
    name: "Pizza",
    type: "sub",
    parent_name: "Food",
    display_order: 1,
    is_active: true,
    description: "Various pizza options",
  },
  {
    name: "Burgers",
    type: "sub",
    parent_name: "Food",
    display_order: 2,
    is_active: true,
    description: "Beef, chicken, and veggie burgers",
  },
  {
    name: "Pasta",
    type: "sub",
    parent_name: "Food",
    display_order: 3,
    is_active: true,
    description: "Italian pasta dishes",
  },
  {
    name: "Asian Cuisine",
    type: "sub",
    parent_name: "Food",
    display_order: 4,
    is_active: true,
    description: "Chinese, Thai, and Japanese dishes",
  },
  {
    name: "Grilled Items",
    type: "sub",
    parent_name: "Food",
    display_order: 5,
    is_active: true,
    description: "Grilled meats and vegetables",
  },
  {
    name: "Sandwiches & Wraps",
    type: "sub",
    parent_name: "Food",
    display_order: 6,
    is_active: true,
    description: "Various sandwiches and wraps",
  },

  // Appetizer subcategories
  {
    name: "Soups",
    type: "sub",
    parent_name: "Appetizers",
    display_order: 1,
    is_active: true,
    description: "Hot and cold soups",
  },
  {
    name: "Salads",
    type: "sub",
    parent_name: "Appetizers",
    display_order: 2,
    is_active: true,
    description: "Fresh salads and greens",
  },
  {
    name: "Finger Foods",
    type: "sub",
    parent_name: "Appetizers",
    display_order: 3,
    is_active: true,
    description: "Wings, nuggets, and fries",
  },
  {
    name: "Platters",
    type: "sub",
    parent_name: "Appetizers",
    display_order: 4,
    is_active: true,
    description: "Sharing platters and combos",
  },

  // Dessert subcategories
  {
    name: "Ice Cream",
    type: "sub",
    parent_name: "Desserts",
    display_order: 1,
    is_active: true,
    description: "Ice cream and frozen desserts",
  },
  {
    name: "Cakes & Pastries",
    type: "sub",
    parent_name: "Desserts",
    display_order: 2,
    is_active: true,
    description: "Cakes, pastries, and baked goods",
  },
  {
    name: "Traditional Sweets",
    type: "sub",
    parent_name: "Desserts",
    display_order: 3,
    is_active: true,
    description: "Local and traditional desserts",
  },

  // Specials subcategories
  {
    name: "Daily Special",
    type: "sub",
    parent_name: "Specials",
    display_order: 1,
    is_active: true,
    description: "Today's chef special",
  },
  {
    name: "Combo Meals",
    type: "sub",
    parent_name: "Specials",
    display_order: 2,
    is_active: true,
    description: "Value combo meals",
  },
  {
    name: "Seasonal Items",
    type: "sub",
    parent_name: "Specials",
    display_order: 3,
    is_active: true,
    description: "Limited time seasonal offerings",
  },
];

// Insert subcategories
for (const subCategory of subCategories) {
  const parent_id = categoryIds[subCategory.parent_name];
  
  await client.query(
    `INSERT INTO categories (name, type, parent_id, display_order, is_active, description) 
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      subCategory.name,
      subCategory.type,
      parent_id,
      subCategory.display_order,
      subCategory.is_active,
      subCategory.description,
    ]
  );
}

console.log("Categories seeded successfully!");

    // Seed Menu Items
    logger.info("Seeding menu items...");
    const menuItems = [
      // Appetizers
      {
        name: "Caesar Salad",
        description: "Fresh romaine lettuce with Caesar dressing",
        category: "appetizer",
        price: 8.99,
        cost_price: 3.5,
        preparation_time: 10,
      },
      {
        name: "Garlic Bread",
        description: "Toasted bread with garlic butter",
        category: "appetizer",
        price: 5.99,
        cost_price: 2.0,
        preparation_time: 8,
      },
      {
        name: "Spring Rolls",
        description: "Crispy vegetable spring rolls with sweet chili sauce",
        category: "appetizer",
        price: 6.99,
        cost_price: 2.5,
        preparation_time: 12,
      },

      // Main Courses
      {
        name: "Grilled Chicken",
        description: "Marinated chicken breast with herbs",
        category: "main_course",
        price: 15.99,
        cost_price: 7.0,
        preparation_time: 25,
      },
      {
        name: "Beef Steak",
        description: "Premium beef steak cooked to perfection",
        category: "main_course",
        price: 24.99,
        cost_price: 12.0,
        preparation_time: 30,
      },
      {
        name: "Pasta Carbonara",
        description: "Classic Italian pasta with cream sauce",
        category: "main_course",
        price: 13.99,
        cost_price: 5.0,
        preparation_time: 20,
      },
      {
        name: "Salmon Fillet",
        description: "Grilled salmon with lemon butter",
        category: "main_course",
        price: 19.99,
        cost_price: 9.0,
        preparation_time: 25,
      },

      // Desserts
      {
        name: "Chocolate Lava Cake",
        description: "Warm chocolate cake with molten center",
        category: "dessert",
        price: 7.99,
        cost_price: 3.0,
        preparation_time: 15,
      },
      {
        name: "Tiramisu",
        description: "Classic Italian coffee-flavored dessert",
        category: "dessert",
        price: 6.99,
        cost_price: 2.8,
        preparation_time: 5,
      },

      // Beverages
      {
        name: "Coca Cola",
        description: "Chilled soft drink",
        category: "beverage",
        price: 2.99,
        cost_price: 0.8,
        preparation_time: 2,
      },
      {
        name: "Fresh Orange Juice",
        description: "Freshly squeezed orange juice",
        category: "beverage",
        price: 4.99,
        cost_price: 1.5,
        preparation_time: 5,
      },
      {
        name: "Cappuccino",
        description: "Italian coffee with steamed milk",
        category: "beverage",
        price: 3.99,
        cost_price: 1.0,
        preparation_time: 5,
      },

      // Side Dishes
      {
        name: "French Fries",
        description: "Crispy golden fries",
        category: "side_dish",
        price: 4.99,
        cost_price: 1.5,
        preparation_time: 10,
      },
      {
        name: "Mashed Potatoes",
        description: "Creamy mashed potatoes",
        category: "side_dish",
        price: 4.99,
        cost_price: 1.8,
        preparation_time: 12,
      },
    ];

    for (const item of menuItems) {
      await client.query(
        `INSERT INTO menu_items (name, description, category, price, cost_price, preparation_time)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          item.name,
          item.description,
          item.category,
          item.price,
          item.cost_price,
          item.preparation_time,
        ]
      );
    }
    logger.info("✓ Menu items seeded");

    // Optional: skip if products exist
    const productCount = await client.query("SELECT COUNT(*) FROM products");
    if (parseInt(productCount.rows[0].count) > 0) {
      logger.info("Products already seeded. Skipping...");
      return;
    }

    const products = [
      {
        name: "Veg Momo",
        slug: "veg-momo",
        description: "Delicious steamed vegetable momo",
        selling_price: 150,
        compare_at_price: 180,
        prep_time: 10,
        category_id: "188a7553-3def-44a3-831b-44ed91868a14",
        type: "simple",
        is_vegetarian: true,
        is_active: true,
      },
      {
        name: "Chicken Momo",
        slug: "chicken-momo",
        description: "Juicy chicken momo with spicy sauce",
        selling_price: 180,
        compare_at_price: 200,
        prep_time: 12,
        category_id: "188a7553-3def-44a3-831b-44ed91868a14",
        type: "simple",
        is_active: true,
      },
      {
        name: "Buff Momo",
        slug: "buff-momo",
        description: "Buff momo made from buffalo meat",
        selling_price: 200,
        compare_at_price: 220,
        prep_time: 12,
        category_id: "188a7553-3def-44a3-831b-44ed91868a14",
        type: "simple",
        is_active: true,
      },
      {
        name: "Margherita Pizza",
        slug: "margherita-pizza",
        description: "Classic pizza with tomato, cheese and basil",
        selling_price: 350,
        compare_at_price: 400,
        prep_time: 15,
        cooking_time: 10,
        category_id: "faa31316-5011-4e90-9b7a-dbbd890e8bb8",
        type: "simple",
        is_vegetarian: true,
        is_active: true,
      },
      {
        name: "Chicken Pizza",
        slug: "chicken-pizza",
        description: "Pizza topped with grilled chicken and cheese",
        selling_price: 400,
        compare_at_price: 450,
        prep_time: 15,
        cooking_time: 12,
        category_id: "faa31316-5011-4e90-9b7a-dbbd890e8bb8",
        type: "simple",
        is_active: true,
      },
    ];

    for (const product of products) {
      await client.query(
        `INSERT INTO products 
          (name, slug, description, selling_price, compare_at_price, prep_time, cooking_time, category_id, type, is_vegetarian, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          product.name,
          product.slug,
          product.description,
          product.selling_price,
          product.compare_at_price ?? null,  // use ?? for undefined/null
          product.prep_time ?? null,
          product.cooking_time ?? null,
          product.category_id,
          product.type,
          product.is_vegetarian ?? false,
          product.is_active ?? true,
        ]
      );
    }
    
    logger.info("✓ Products seeded successfully");

    await client.query("COMMIT");
    logger.info("✓ Database seeding completed successfully!");
    logger.info("\nDefault credentials:");
    logger.info("  Admin: admin@hotel.com / password123");
    logger.info("  Manager: manager@hotel.com / password123");
    logger.info("  Waiter: waiter@hotel.com / password123");
    logger.info("  Chef: chef@hotel.com / password123");
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Seeding failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run seeder
seed().catch((error) => {
  console.error("Seed script failed:", error);
  process.exit(1);
});
