-- -- ==================== src/database/migrations/003_create_menu_items.sql ====================
-- -- Migration: Create menu_items table
-- -- Created: 2024-01-01

-- CREATE TABLE IF NOT EXISTS menu_items (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(255) NOT NULL,
--   description TEXT,
--   category VARCHAR(50) NOT NULL,
--   price DECIMAL(10, 2) NOT NULL,
--   cost_price DECIMAL(10, 2),
--   image_url VARCHAR(500),
--   is_available BOOLEAN DEFAULT true,
--   preparation_time INTEGER DEFAULT 15,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
--   CONSTRAINT menu_items_price_check CHECK (price >= 0),
--   CONSTRAINT menu_items_cost_price_check CHECK (cost_price IS NULL OR cost_price >= 0),
--   CONSTRAINT menu_items_category_check CHECK (category IN ('appetizer', 'main_course', 'dessert', 'beverage', 'side_dish'))
-- );

-- CREATE INDEX idx_menu_items_category ON menu_items(category);
-- CREATE INDEX idx_menu_items_is_available ON menu_items(is_available);
-- CREATE INDEX idx_menu_items_name ON menu_items(name);
