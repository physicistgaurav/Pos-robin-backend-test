-- ==================== src/database/migrations/006_create_triggers.sql ====================
-- Migration: Create triggers and functions
-- Created: 2024-01-01

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CREATE TRIGGER update_tables_updated_at 
--   BEFORE UPDATE ON tables
--   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CREATE TRIGGER update_menu_items_updated_at 
--   BEFORE UPDATE ON menu_items
--   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CREATE TRIGGER update_orders_updated_at 
--   BEFORE UPDATE ON orders
--   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate order totals
-- CREATE OR REPLACE FUNCTION calculate_order_totals()
-- RETURNS TRIGGER AS $$
-- DECLARE
--   order_total DECIMAL(10, 2);
-- BEGIN
--   SELECT COALESCE(SUM(subtotal), 0) INTO order_total
--   FROM order_items
--   WHERE order_id = NEW.order_id;
  
--   UPDATE orders
--   SET total_amount = order_total,
--       final_amount = order_total - COALESCE(discount_amount, 0) + COALESCE(tax_amount, 0)
--   WHERE id = NEW.order_id;
  
--   RETURN NEW;
-- END;
-- $$ language 'plpgsql';

-- Trigger to update order totals when items change
-- CREATE TRIGGER update_order_totals_on_insert
--   AFTER INSERT ON order_items
--   FOR EACH ROW EXECUTE FUNCTION calculate_order_totals();

-- CREATE TRIGGER update_order_totals_on_update
--   AFTER UPDATE ON order_items
--   FOR EACH ROW EXECUTE FUNCTION calculate_order_totals();

-- CREATE TRIGGER update_order_totals_on_delete
--   AFTER DELETE ON order_items
--   FOR EACH ROW EXECUTE FUNCTION calculate_order_totals();
