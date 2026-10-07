-- =====================================================
-- FIX: update_order_totals FUNCTION (support both tables)
-- =====================================================
CREATE OR REPLACE FUNCTION update_order_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id UUID := COALESCE(NEW.order_id, OLD.order_id, NEW.id, OLD.id);
    v_subtotal DECIMAL(10,2);
    v_discount DECIMAL(10,2);
    v_after_discount DECIMAL(10,2);
    v_tax DECIMAL(10,2);
    v_service DECIMAL(10,2);
    v_total DECIMAL(10,2);
    v_order RECORD;
BEGIN
    -- Get order details
    SELECT * INTO v_order FROM orders WHERE id = v_order_id;

    IF NOT FOUND THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Calculate subtotal from items
    SELECT COALESCE(SUM(total_price), 0)
    INTO v_subtotal
    FROM order_items
    WHERE order_id = v_order_id;

    -- Calculate discount amount
    v_discount := 0;
    IF v_order.discount_type = 'percentage' THEN
        v_discount := v_subtotal * v_order.discount_value / 100;
    ELSIF v_order.discount_type IN ('fixed', 'coupon') THEN
        v_discount := v_order.discount_value;
    END IF;

    -- Prevent negative subtotal
    IF v_discount > v_subtotal THEN
        v_discount := v_subtotal;
    END IF;

    -- Amount after discount
    v_after_discount := v_subtotal - v_discount;

    -- Tax & service
    v_tax := v_after_discount * v_order.tax_percentage / 100;
    v_service := v_after_discount * v_order.service_charge_percentage / 100;

    -- Final total
    v_total := v_after_discount + v_tax + v_service;

    -- Update order
    UPDATE orders
    SET subtotal = v_subtotal,
        discount_amount = v_discount,
        tax_amount = v_tax,
        service_charge_amount = v_service,
        total_amount = v_total,
        balance_amount = v_total - paid_amount,
        updated_at = NOW()
    WHERE id = v_order_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Recalculate when discount is updated
-- =====================================================

DROP TRIGGER IF EXISTS trigger_update_order_totals_on_discount ON orders;

CREATE TRIGGER trigger_update_order_totals_on_discount
AFTER UPDATE OF discount_type, discount_value ON orders
FOR EACH ROW
EXECUTE FUNCTION update_order_totals();