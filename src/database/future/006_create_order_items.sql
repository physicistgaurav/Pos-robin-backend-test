-- -- ==================== src/database/migrations/005_create_order_items.sql ====================
-- -- Migration: Create order_items table
-- -- Created: 2024-01-01

-- CREATE TABLE IF NOT EXISTS order_items (
--   id SERIAL PRIMARY KEY,
--   order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
--   menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
--   quantity INTEGER NOT NULL,
--   unit_price DECIMAL(10, 2) NOT NULL,
--   subtotal DECIMAL(10, 2) NOT NULL,
--   special_instructions TEXT,
--   status VARCHAR(20) DEFAULT 'pending',
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
--   CONSTRAINT order_items_quantity_check CHECK (quantity > 0),
--   CONSTRAINT order_items_unit_price_check CHECK (unit_price >= 0),
--   CONSTRAINT order_items_subtotal_check CHECK (subtotal >= 0),
--   CONSTRAINT order_items_status_check CHECK (status IN ('pending', 'preparing', 'ready', 'served'))
-- );

-- CREATE INDEX idx_order_items_order_id ON order_items(order_id);
-- CREATE INDEX idx_order_items_menu_item_id ON order_items(menu_item_id);
-- CREATE INDEX idx_order_items_status ON order_items(status);
