-- =====================================================
-- FIX: Separate function for discount recalculation
-- triggered from the orders table itself
-- =====================================================

CREATE OR REPLACE FUNCTION recalculate_order_totals_on_discount()
RETURNS TRIGGER AS $$
DECLARE
    -- When fired from orders, NEW.id is the order's own PK
    v_order_id UUID := NEW.id;
    v_subtotal DECIMAL(10,2);
    v_discount DECIMAL(10,2);
    v_after_discount DECIMAL(10,2);
    v_tax DECIMAL(10,2);
    v_service DECIMAL(10,2);
    v_total DECIMAL(10,2);
BEGIN
    SELECT COALESCE(SUM(total_price), 0)
    INTO v_subtotal
    FROM order_items
    WHERE order_id = v_order_id;

    v_discount := 0;
    IF NEW.discount_type = 'percentage' THEN
        v_discount := v_subtotal * NEW.discount_value / 100;
    ELSIF NEW.discount_type IN ('fixed', 'coupon') THEN
        v_discount := NEW.discount_value;
    END IF;

    IF v_discount > v_subtotal THEN
        v_discount := v_subtotal;
    END IF;

    v_after_discount := v_subtotal - v_discount;
    v_tax     := v_after_discount * NEW.tax_percentage / 100;
    v_service := v_after_discount * NEW.service_charge_percentage / 100;
    v_total   := v_after_discount + v_tax + v_service;

    -- Use NEW.paid_amount so balance reflects current state
    NEW.subtotal              := v_subtotal;
    NEW.discount_amount       := v_discount;
    NEW.tax_amount            := v_tax;
    NEW.service_charge_amount := v_service;
    NEW.total_amount          := v_total;
    NEW.balance_amount        := v_total - NEW.paid_amount;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop any leftover attempt from 027 just in case
DROP TRIGGER IF EXISTS trigger_update_order_totals_on_discount ON orders;

CREATE TRIGGER trigger_recalculate_on_discount
BEFORE UPDATE OF discount_type, discount_value ON orders
FOR EACH ROW
EXECUTE FUNCTION recalculate_order_totals_on_discount();