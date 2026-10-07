-- =====================================================
-- ROLLBACK: 027_discount_trigger.sql
-- =====================================================

-- Drop the broken trigger added in 027
DROP TRIGGER IF EXISTS trigger_update_order_totals_on_discount ON orders;

-- Restore update_order_totals to its original form
-- (only called from order_items, so NEW/OLD always has order_id)
CREATE OR REPLACE FUNCTION update_order_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id UUID := COALESCE(NEW.order_id, OLD.order_id);
    v_subtotal DECIMAL(10,2);
    v_discount DECIMAL(10,2);
    v_after_discount DECIMAL(10,2);
    v_tax DECIMAL(10,2);
    v_service DECIMAL(10,2);
    v_total DECIMAL(10,2);
    v_order RECORD;
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = v_order_id;

    IF NOT FOUND THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT COALESCE(SUM(total_price), 0)
    INTO v_subtotal
    FROM order_items
    WHERE order_id = v_order_id;

    v_discount := 0;
    IF v_order.discount_type = 'percentage' THEN
        v_discount := v_subtotal * v_order.discount_value / 100;
    ELSIF v_order.discount_type IN ('fixed', 'coupon') THEN
        v_discount := v_order.discount_value;
    END IF;

    IF v_discount > v_subtotal THEN
        v_discount := v_subtotal;
    END IF;

    v_after_discount := v_subtotal - v_discount;
    v_tax     := v_after_discount * v_order.tax_percentage / 100;
    v_service := v_after_discount * v_order.service_charge_percentage / 100;
    v_total   := v_after_discount + v_tax + v_service;

    UPDATE orders
    SET subtotal              = v_subtotal,
        discount_amount       = v_discount,
        tax_amount            = v_tax,
        service_charge_amount = v_service,
        total_amount          = v_total,
        balance_amount        = v_total - paid_amount,
        updated_at            = NOW()
    WHERE id = v_order_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;