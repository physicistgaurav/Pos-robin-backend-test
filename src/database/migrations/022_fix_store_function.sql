-- =====================================================
-- Step 1: Add void columns to store_transactions
-- (idempotent - safe to run even if partially applied)
-- =====================================================
ALTER TABLE store_transactions
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'voided')),
    ADD COLUMN IF NOT EXISTS voided_at        TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS voided_by        UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS void_reason      TEXT,
    ADD COLUMN IF NOT EXISTS voided_by_txn_id UUID REFERENCES store_transactions(id);

CREATE INDEX IF NOT EXISTS idx_store_txn_status ON store_transactions(status);

-- =====================================================
-- Step 2: Add void_reversal enum value
-- =====================================================
ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'void_reversal';

-- =====================================================
-- Step 3: void_store_transaction function
-- =====================================================
CREATE OR REPLACE FUNCTION void_store_transaction(
    p_transaction_id UUID,
    p_voided_by      UUID,
    p_void_reason    TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_txn      RECORD;
    v_movement RECORD;
    v_current  DECIMAL(10,3);
    v_new      DECIMAL(10,3);
    v_result   JSONB;
BEGIN
    IF p_void_reason IS NULL OR TRIM(p_void_reason) = '' THEN
        RAISE EXCEPTION 'Void reason is required' USING ERRCODE = 'P0003';
    END IF;

    SELECT * INTO v_txn
    FROM store_transactions
    WHERE id = p_transaction_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found: %', p_transaction_id
            USING ERRCODE = 'P0001';
    END IF;

    IF v_txn.status = 'voided' THEN
        RAISE EXCEPTION 'Transaction is already voided: %', p_transaction_id
            USING ERRCODE = 'P0002';
    END IF;

    FOR v_movement IN
        SELECT *
        FROM stock_movements
        WHERE store_txn_id = p_transaction_id
          AND movement_type != 'void_reversal'
        ORDER BY created_at DESC
    LOOP
        SELECT current_stock INTO v_current
        FROM inventory_stock
        WHERE product_id = v_movement.product_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'No inventory_stock record for product % during void',
                v_movement.product_id;
        END IF;

        IF v_movement.movement_type IN ('purchase', 'opening_stock', 'transfer', 'customer_return') THEN
            v_new := v_current - v_movement.quantity;
            IF v_new < 0 THEN
                RAISE EXCEPTION
                    'Cannot reverse: stock would go negative for product %. Current: %, Qty: %',
                    v_movement.product_id, v_current, v_movement.quantity;
            END IF;

        ELSIF v_movement.movement_type IN ('sale', 'wastage', 'supplier_return') THEN
            v_new := v_current + v_movement.quantity;

        ELSIF v_movement.movement_type = 'adjustment' THEN
            v_new := v_current - v_movement.quantity;
            IF v_new < 0 THEN
                RAISE EXCEPTION
                    'Cannot reverse adjustment: stock would go negative for product %. Current: %, Qty: %',
                    v_movement.product_id, v_current, v_movement.quantity;
            END IF;

        ELSE
            RAISE NOTICE 'Skipping unhandled movement_type % for movement %',
                v_movement.movement_type, v_movement.id;
            CONTINUE;
        END IF;

        UPDATE inventory_stock
        SET current_stock    = v_new,
            last_movement_at = NOW(),
            updated_at       = NOW()
        WHERE product_id = v_movement.product_id;

        INSERT INTO stock_movements (
            product_id, movement_type, quantity,
            unit_cost, total_cost,
            stock_before, stock_after,
            store_txn_id, supplier_name, supplier_invoice,
            reason, notes, created_by, created_at
        ) VALUES (
            v_movement.product_id, 'void_reversal', v_movement.quantity,
            v_movement.unit_cost, v_movement.total_cost,
            v_current, v_new,
            p_transaction_id, v_movement.supplier_name, v_movement.supplier_invoice,
            'Void reversal: ' || p_void_reason,
            'Reversal of movement ' || v_movement.id::TEXT,
            p_voided_by, NOW()
        );
    END LOOP;

    UPDATE store_transactions
    SET status      = 'voided',
        voided_at   = NOW(),
        voided_by   = p_voided_by,
        void_reason = p_void_reason,
        updated_at  = NOW()
    WHERE id = p_transaction_id;

    SELECT jsonb_build_object(
        'id',          s.id,
        'status',      s.status,
        'voided_at',   s.voided_at,
        'voided_by',   s.voided_by,
        'void_reason', s.void_reason
    ) INTO v_result
    FROM store_transactions s
    WHERE s.id = p_transaction_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Step 4: Update trigger to handle void_reversal
-- =====================================================
CREATE OR REPLACE FUNCTION apply_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
    v_current  DECIMAL(10,3);
    v_new      DECIMAL(10,3);
    v_avg_cost DECIMAL(10,2);
BEGIN
    SELECT current_stock, average_cost_price
    INTO v_current, v_avg_cost
    FROM inventory_stock
    WHERE product_id = NEW.product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No inventory_stock record for product %', NEW.product_id;
    END IF;

    -- Exit early: stock already updated by void function
    IF NEW.movement_type = 'void_reversal' THEN
        NEW.stock_before := COALESCE(NEW.stock_before, v_current);
        NEW.stock_after  := COALESCE(NEW.stock_after,  v_current);
        RETURN NEW;
    END IF;

    IF NEW.movement_type IN ('purchase', 'opening_stock', 'transfer', 'customer_return') THEN
        v_new := v_current + NEW.quantity;

        IF NEW.movement_type = 'purchase' AND NEW.unit_cost IS NOT NULL THEN
            IF v_current = 0 THEN
                v_avg_cost := NEW.unit_cost;
            ELSE
                v_avg_cost := (
                    (v_current * COALESCE(v_avg_cost, 0)) +
                    (NEW.quantity * NEW.unit_cost)
                ) / (v_current + NEW.quantity);
            END IF;
        END IF;

    ELSIF NEW.movement_type IN ('sale', 'wastage', 'supplier_return') THEN
        v_new := v_current - NEW.quantity;

    ELSIF NEW.movement_type = 'adjustment' THEN
        v_new := v_current + NEW.quantity;

    ELSE
        RAISE EXCEPTION 'Unknown movement_type: %', NEW.movement_type;
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