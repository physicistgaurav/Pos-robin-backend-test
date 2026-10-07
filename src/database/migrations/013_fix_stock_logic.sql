-- migrate old data
UPDATE stock_movements
SET movement_type = 'customer_return'
WHERE movement_type = 'return';

-- update trigger
CREATE OR REPLACE FUNCTION apply_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
    v_current DECIMAL(10,3);
    v_new     DECIMAL(10,3);
    v_avg_cost DECIMAL(10,2);
BEGIN
    SELECT current_stock, average_cost_price
    INTO v_current, v_avg_cost
    FROM inventory_stock
    WHERE product_id = NEW.product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No inventory_stock record for product %', NEW.product_id;
    END IF;

    IF NEW.movement_type IN ('purchase', 'opening_stock', 'transfer', 'customer_return') THEN
        v_new := v_current + NEW.quantity;

        IF NEW.movement_type = 'purchase' AND NEW.unit_cost IS NOT NULL THEN
            IF v_current = 0 THEN
                v_avg_cost := NEW.unit_cost;
            ELSE
                v_avg_cost := ((v_current * COALESCE(v_avg_cost, 0)) + (NEW.quantity * NEW.unit_cost))
                              / (v_current + NEW.quantity);
            END IF;
        END IF;

    ELSIF NEW.movement_type IN ('sale', 'wastage', 'supplier_return') THEN
        v_new := v_current - NEW.quantity;

    ELSIF NEW.movement_type = 'adjustment' THEN
        v_new := v_current + NEW.quantity;

    END IF;

    IF v_new < 0 THEN
        RAISE EXCEPTION 'Insufficient stock for product %. Available: %, Requested: %',
            NEW.product_id, v_current, NEW.quantity;
    END IF;

    NEW.stock_before := v_current;
    NEW.stock_after  := v_new;

    UPDATE inventory_stock
    SET current_stock       = v_new,
        average_cost_price  = v_avg_cost,
        last_purchase_price = CASE
                                WHEN NEW.movement_type = 'purchase' THEN NEW.unit_cost
                                ELSE last_purchase_price
                              END,
        last_restocked_at   = CASE
                                WHEN NEW.movement_type = 'purchase' THEN NOW()
                                ELSE last_restocked_at
                              END,
        last_movement_at    = NOW(),
        updated_at          = NOW()
    WHERE product_id = NEW.product_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- | Action          | API call                                             |
-- | --------------- | ---------------------------------------------------- |
-- | Add stock       | `purchase` or `+ adjustment`                         |
-- | Remove stock    | `sale`, `wastage`, `supplier_return`, `- adjustment` |
-- | Customer return | `customer_return`                                    |
-- | Supplier return | `supplier_return`                                    |
