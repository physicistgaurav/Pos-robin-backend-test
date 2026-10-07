-- =====================================================
-- INVENTORY
-- =====================================================

CREATE TYPE stock_unit AS ENUM (
    'piece', 'bottle', 'can', 'glass',
    'ml', 'liter',
    'kg', 'gram',
    'pack', 'carton', 'box'
);

CREATE TYPE stock_movement_type AS ENUM (
    'purchase',       -- Stock received from supplier
    'sale',           -- Sold via POS order (auto)
    'adjustment',     -- Manual stock correction
    'wastage',        -- Spillage, breakage, expiry
    'return',         -- Returned to supplier
    'transfer',       -- Between locations (future)
    'opening_stock'   -- Initial stock entry
);

-- Step 1: Flag products for inventory tracking
ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_inventory_tracked BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stock_unit stock_unit,
ADD COLUMN IF NOT EXISTS low_stock_threshold DECIMAL(10,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS reorder_quantity   DECIMAL(10,3) DEFAULT 0;

-- Step 2: Stock levels per product
CREATE TABLE inventory_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

    current_stock   DECIMAL(10,3) NOT NULL DEFAULT 0,
    reserved_stock  DECIMAL(10,3) NOT NULL DEFAULT 0, -- future: holds for pending orders
    available_stock DECIMAL(10,3) GENERATED ALWAYS AS (current_stock - reserved_stock) STORED,

    last_purchase_price DECIMAL(10,2),   -- cost price of last restock
    average_cost_price  DECIMAL(10,2),   -- weighted average cost

    last_restocked_at   TIMESTAMP WITH TIME ZONE,
    last_movement_at    TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT inventory_stock_product_unique UNIQUE (product_id),
    CONSTRAINT inventory_stock_current_check  CHECK (current_stock >= 0),
    CONSTRAINT inventory_stock_reserved_check CHECK (reserved_stock >= 0)
);

-- Step 3: Every stock change is a movement (full audit trail)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    movement_type stock_movement_type NOT NULL,

    quantity        DECIMAL(10,3) NOT NULL, -- always positive; direction from type
    unit_cost       DECIMAL(10,2),          -- cost per unit at time of movement
    total_cost      DECIMAL(10,2),          -- quantity * unit_cost

    stock_before    DECIMAL(10,3) NOT NULL,
    stock_after     DECIMAL(10,3) NOT NULL,

    -- Links to source of movement
    order_id         UUID REFERENCES orders(id) ON DELETE SET NULL,       -- if sale
    order_item_id    UUID REFERENCES order_items(id) ON DELETE SET NULL,  -- if sale
    store_txn_id     UUID,  -- FK added after store_transactions table created below
    supplier_name    VARCHAR(255),
    supplier_invoice VARCHAR(100),

    reason  TEXT,    -- for adjustments/wastage
    notes   TEXT,

    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_product  ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_type     ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_order    ON stock_movements(order_id);
CREATE INDEX idx_stock_movements_date     ON stock_movements(created_at DESC);

-- Step 4: Trigger to auto-update inventory_stock on movement insert
CREATE OR REPLACE FUNCTION apply_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
    v_current DECIMAL(10,3);
    v_new     DECIMAL(10,3);
    v_avg_cost DECIMAL(10,2);
    v_cur_cost DECIMAL(10,2);
BEGIN
    SELECT current_stock, average_cost_price
    INTO v_current, v_avg_cost
    FROM inventory_stock
    WHERE product_id = NEW.product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No inventory_stock record for product %', NEW.product_id;
    END IF;

    -- Determine direction
    IF NEW.movement_type IN ('purchase', 'return', 'opening_stock', 'transfer') THEN
        v_new := v_current + NEW.quantity;

        -- Recalculate weighted average cost on purchase
        IF NEW.movement_type = 'purchase' AND NEW.unit_cost IS NOT NULL THEN
            IF v_current = 0 THEN
                v_avg_cost := NEW.unit_cost;
            ELSE
                v_avg_cost := ((v_current * COALESCE(v_avg_cost, 0)) + (NEW.quantity * NEW.unit_cost))
                              / (v_current + NEW.quantity);
            END IF;
        END IF;

    ELSIF NEW.movement_type IN ('sale', 'wastage', 'adjustment') THEN
        v_new := v_current - NEW.quantity;
        IF v_new < 0 THEN
            RAISE EXCEPTION 'Insufficient stock for product %. Available: %, Requested: %',
                NEW.product_id, v_current, NEW.quantity;
        END IF;
    END IF;

    -- Capture before/after on the movement record
    NEW.stock_before := v_current;
    NEW.stock_after  := v_new;

    -- Update inventory_stock
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

CREATE TRIGGER trigger_apply_stock_movement
BEFORE INSERT ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION apply_stock_movement();

-- Step 5: Auto-deduct stock when an order item is marked ready/completed
-- (you can also do this in application layer — both approaches are valid)
-- Keeping it in app layer is more flexible; see note below.

-- Low stock view
CREATE VIEW low_stock_products AS
SELECT
    p.id,
    p.name,
    p.stock_unit,
    p.low_stock_threshold,
    p.reorder_quantity,
    s.current_stock,
    s.available_stock,
    s.average_cost_price,
    s.last_restocked_at,
    CASE
        WHEN s.current_stock = 0 THEN 'out_of_stock'
        WHEN s.current_stock <= p.low_stock_threshold THEN 'low_stock'
        ELSE 'ok'
    END AS stock_status
FROM products p
JOIN inventory_stock s ON p.id = s.product_id
WHERE p.is_inventory_tracked = TRUE
ORDER BY s.current_stock ASC;

-- =====================================================
-- STORE TRANSACTIONS
-- =====================================================

CREATE TYPE store_transaction_type AS ENUM ('incoming', 'outgoing');

CREATE TYPE store_transaction_category AS ENUM (
    -- Incoming
    'sales_revenue',      -- cash from POS (reconciliation)
    'investment',         -- owner capital injection
    'loan_received',
    'refund_received',    -- refund from supplier
    'other_income',

    -- Outgoing
    'inventory_purchase', -- buying bar stock, raw materials
    'salary',             -- staff wages
    'utility',            -- electricity, water, internet
    'rent',
    'maintenance',        -- repairs, cleaning
    'marketing',
    'tax_payment',
    'loan_repayment',
    'petty_cash',
    'other_expense'
);

CREATE TABLE store_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    type     store_transaction_type     NOT NULL,
    category store_transaction_category NOT NULL,

    amount      DECIMAL(10,2) NOT NULL,
    description TEXT,

    payment_method  payment_method, -- reuse your existing enum
    reference_number VARCHAR(100),  -- bank ref, cheque no, etc.

    -- Party info
    party_name    VARCHAR(255),  -- supplier name, employee name, etc.
    party_contact VARCHAR(20),

    -- Attachment (bill photo, receipt scan)
    attachment_url TEXT,

    -- Link to inventory if this was a stock purchase
    -- (movements will reference this txn's id)
    notes TEXT,

    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT store_txn_amount_check CHECK (amount > 0),
    CONSTRAINT store_txn_category_incoming CHECK (
        type != 'incoming' OR category IN (
            'sales_revenue','investment','loan_received',
            'refund_received','other_income'
        )
    ),
    CONSTRAINT store_txn_category_outgoing CHECK (
        type != 'outgoing' OR category IN (
            'inventory_purchase','salary','utility','rent',
            'maintenance','marketing','tax_payment',
            'loan_repayment','petty_cash','other_expense'
        )
    )
);

CREATE INDEX idx_store_txn_type     ON store_transactions(type);
CREATE INDEX idx_store_txn_category ON store_transactions(category);
CREATE INDEX idx_store_txn_date     ON store_transactions(transaction_date DESC);
CREATE INDEX idx_store_txn_created  ON store_transactions(created_by);

-- Now add the FK from stock_movements back to store_transactions
ALTER TABLE stock_movements
ADD CONSTRAINT fk_stock_movements_store_txn
FOREIGN KEY (store_txn_id) REFERENCES store_transactions(id) ON DELETE SET NULL;

-- Store transaction summary view
CREATE VIEW store_transaction_summary AS
SELECT
    DATE(transaction_date) AS txn_date,
    type,
    category,
    COUNT(*)       AS transaction_count,
    SUM(amount)    AS total_amount
FROM store_transactions
GROUP BY DATE(transaction_date), type, category
ORDER BY txn_date DESC, type, category;

-- Monthly P&L view
CREATE VIEW monthly_store_pl AS
SELECT
    DATE_TRUNC('month', transaction_date) AS month,
    SUM(CASE WHEN type = 'incoming' THEN amount ELSE 0 END) AS total_income,
    SUM(CASE WHEN type = 'outgoing' THEN amount ELSE 0 END) AS total_expense,
    SUM(CASE WHEN type = 'incoming' THEN amount ELSE -amount END) AS net
FROM store_transactions
GROUP BY DATE_TRUNC('month', transaction_date)
ORDER BY month DESC;

-- ---

-- ## How the pieces connect
-- ```
-- products (is_inventory_tracked = true, e.g. Tuborg Beer)
--     │
--     ├── inventory_stock          ← current level, avg cost
--     │
--     └── stock_movements          ← every change with full audit
--             ├── order_item_id    ← auto-deduct on sale
--             └── store_txn_id    ← linked when txn is inventory_purchase

-- store_transactions
--     ├── category = 'inventory_purchase'  → triggers stock_movements (purchase type)
--     └── category = 'salary', 'utility'  → standalone expense record


-- | Action          | API call                                             |
-- | --------------- | ---------------------------------------------------- |
-- | Add stock       | `purchase` or `+ adjustment`                         |
-- | Remove stock    | `sale`, `wastage`, `supplier_return`, `- adjustment` |
-- | Customer return | `customer_return`                                    |
-- | Supplier return | `supplier_return`                                    |

