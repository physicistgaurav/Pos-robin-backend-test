-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE order_type AS ENUM ('dine_in', 'takeaway', 'delivery', 'online');

CREATE TYPE order_status AS ENUM (
    'pending', 'confirmed', 'preparing',
    'ready', 'served', 'completed', 'cancelled'
);

CREATE TYPE order_item_status AS ENUM (
    'pending', 'confirmed', 'preparing', 'ready'
);

CREATE TYPE payment_method AS ENUM (
    'cash', 'credit', 'debit_card', 'online',
    'connectIPS', 'esewa', 'khalti', 'fonepay'
);

CREATE TYPE payment_status AS ENUM (
    'unpaid', 'partial', 'paid', 'refunded'
);

CREATE TYPE discount_type AS ENUM (
    'percentage', 'fixed', 'coupon'
);

-- =====================================================
-- ORDERS
-- =====================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,

    order_type order_type NOT NULL DEFAULT 'dine_in',
    table_id UUID REFERENCES tables(id) ON DELETE SET NULL,

    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),

    delivery_address TEXT,
    delivery_instructions TEXT,

    status order_status NOT NULL DEFAULT 'pending',

    created_by UUID NOT NULL REFERENCES users(id),
    served_by UUID REFERENCES users(id),

    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,

    discount_type discount_type,
    discount_value DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    discount_reason TEXT,

    tax_percentage DECIMAL(5,2) DEFAULT 13.00,
    tax_amount DECIMAL(10,2) DEFAULT 0,

    service_charge_percentage DECIMAL(5,2) DEFAULT 0,
    service_charge_amount DECIMAL(10,2) DEFAULT 0,

    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,

    payment_status payment_status NOT NULL DEFAULT 'unpaid',
    paid_amount DECIMAL(10,2) DEFAULT 0,
    balance_amount DECIMAL(10,2) DEFAULT 0,

    special_instructions TEXT,
    kitchen_notes TEXT,

    order_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    confirmed_at TIMESTAMP WITH TIME ZONE,
    served_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,

    cancellation_reason TEXT,

    estimated_prep_time INTEGER,
    estimated_delivery_time TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT orders_subtotal_check CHECK (subtotal >= 0),
    CONSTRAINT orders_total_check CHECK (total_amount >= 0),
    CONSTRAINT orders_discount_check CHECK (discount_amount >= 0),
    CONSTRAINT orders_paid_check CHECK (paid_amount >= 0),
    CONSTRAINT orders_balance_check CHECK (balance_amount >= 0),
    CONSTRAINT orders_discount_not_exceed_subtotal CHECK (discount_amount <= subtotal),
    CONSTRAINT orders_paid_not_exceed_total CHECK (paid_amount <= total_amount),
    CONSTRAINT orders_table_required_for_dinein
        CHECK (order_type != 'dine_in' OR table_id IS NOT NULL)
);

-- =====================================================
-- ORDER INDEXES
-- =====================================================
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_table_active ON orders(table_id)
    WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_order_time ON orders(order_time DESC);
CREATE INDEX idx_orders_created_by ON orders(created_by);
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone);

-- =====================================================
-- ORDER ITEMS
-- =====================================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

    product_name VARCHAR(255) NOT NULL,
    product_price DECIMAL(10,2) NOT NULL,

    quantity INTEGER NOT NULL DEFAULT 1,

    variant_name VARCHAR(255),
    customizations TEXT,

    unit_price DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_price DECIMAL(10,2) NOT NULL,

    item_status order_item_status NOT NULL DEFAULT 'pending',

    special_instructions TEXT,

    ordered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ready_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT order_items_quantity_check CHECK (quantity > 0),
    CONSTRAINT order_items_price_check CHECK (unit_price >= 0 AND total_price >= 0)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_order_items_status ON order_items(item_status);
CREATE INDEX idx_order_items_ordered_at ON order_items(ordered_at DESC);

-- =====================================================
-- ORDER PAYMENTS
-- =====================================================
CREATE TABLE order_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_method payment_method NOT NULL,
    amount DECIMAL(10,2) NOT NULL,

    transaction_id VARCHAR(255),
    reference_number VARCHAR(255),

    card_last_4_digits VARCHAR(4),
    payment_gateway VARCHAR(50),

    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    processed_by UUID REFERENCES users(id),

    notes TEXT,

    payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT order_payments_amount_check CHECK (amount > 0),
    CONSTRAINT order_payments_status_check
        CHECK (status IN ('pending', 'completed', 'failed', 'refunded'))
);

CREATE INDEX idx_order_payments_order ON order_payments(order_id);
CREATE INDEX idx_order_payments_method ON order_payments(payment_method);
CREATE INDEX idx_order_payments_date ON order_payments(payment_date DESC);
CREATE INDEX idx_order_payments_status ON order_payments(status);

-- =====================================================
-- ORDER REFUNDS
-- =====================================================
CREATE TABLE order_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES order_payments(id) ON DELETE SET NULL,

    refund_amount DECIMAL(10,2) NOT NULL,
    refund_method payment_method NOT NULL,

    reason TEXT NOT NULL,

    refunded_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),

    refund_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT order_refunds_amount_check CHECK (refund_amount > 0)
);

CREATE INDEX idx_order_refunds_order ON order_refunds(order_id);
CREATE INDEX idx_order_refunds_date ON order_refunds(refund_date DESC);

-- =====================================================
-- SEQUENCE
-- =====================================================
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Order number generator
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number :=
            'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' ||
            LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_order_number
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION generate_order_number();

-- Update totals
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
    -- Get order details
    SELECT * INTO v_order FROM orders WHERE id = v_order_id;
    
    -- Calculate subtotal from items
    SELECT COALESCE(SUM(total_price), 0)
    INTO v_subtotal
    FROM order_items
    WHERE order_id = v_order_id;
    
    -- Calculate discount amount
    v_discount := 0;
    IF v_order.discount_type = 'percentage' THEN
        v_discount := v_subtotal * v_order.discount_value / 100;
    ELSIF v_order.discount_type = 'fixed' THEN
        v_discount := v_order.discount_value;
    ELSIF v_order.discount_type = 'coupon' THEN
        v_discount := v_order.discount_value;
    END IF;
    
    -- Amount after discount
    v_after_discount := v_subtotal - v_discount;
    IF v_after_discount < 0 THEN
        v_after_discount := 0;
    END IF;
    
    -- Calculate tax on discounted amount
    v_tax := v_after_discount * v_order.tax_percentage / 100;
    
    -- Calculate service charge on discounted amount
    v_service := v_after_discount * v_order.service_charge_percentage / 100;
    
    -- Calculate total
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

CREATE TRIGGER trigger_update_order_totals
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW
EXECUTE FUNCTION update_order_totals();

-- Update payment status
CREATE OR REPLACE FUNCTION update_payment_status()
RETURNS TRIGGER AS $$
DECLARE
    v_paid DECIMAL(10,2);
    v_total DECIMAL(10,2);
    v_status payment_status;
BEGIN
    -- Sum all completed payments
    SELECT COALESCE(SUM(amount), 0)
    INTO v_paid
    FROM order_payments
    WHERE order_id = NEW.order_id
      AND status = 'completed';

    -- Get order total
    SELECT total_amount INTO v_total
    FROM orders WHERE id = NEW.order_id;

    -- Determine payment status
    IF v_paid = 0 THEN
        v_status := 'unpaid';
    ELSIF v_paid >= v_total THEN
        v_status := 'paid';
    ELSE
        v_status := 'partial';
    END IF;

    -- Update order
    UPDATE orders
    SET paid_amount = v_paid,
        balance_amount = v_total - v_paid,
        payment_status = v_status,
        updated_at = NOW()
    WHERE id = NEW.order_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_status
AFTER INSERT OR UPDATE ON order_payments
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION update_payment_status();

-- Table occupancy
CREATE OR REPLACE FUNCTION update_table_status_on_order()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark table as occupied for active orders
    IF NEW.status NOT IN ('completed', 'cancelled') AND NEW.table_id IS NOT NULL THEN
        UPDATE tables 
        SET status = 'occupied', updated_at = NOW()
        WHERE id = NEW.table_id;
    
    -- Mark table as available if no active orders remain
    ELSIF NEW.table_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM orders
            WHERE table_id = NEW.table_id
              AND status NOT IN ('completed', 'cancelled')
              AND id != NEW.id
        ) THEN
            UPDATE tables 
            SET status = 'available', updated_at = NOW()
            WHERE id = NEW.table_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_table_status
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_table_status_on_order();

-- Order status timestamps
CREATE OR REPLACE FUNCTION update_order_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if this is an UPDATE operation
    IF TG_OP = 'UPDATE' THEN
        IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
            NEW.confirmed_at := NOW();
        ELSIF NEW.status = 'served' AND (OLD.status IS NULL OR OLD.status != 'served') THEN
            NEW.served_at := NOW();
        ELSIF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
            NEW.completed_at := NOW();
        ELSIF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
            NEW.cancelled_at := NOW();
        END IF;
    END IF;
    
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_order_timestamps
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_order_timestamps();

-- =====================================================
-- VIEWS
-- =====================================================

-- Active Orders View
CREATE VIEW active_orders_view AS
SELECT 
    o.id,
    o.order_number,
    o.order_type,
    o.status,
    o.payment_status,
    t.table_number,
    t.table_name,
    o.customer_name,
    o.customer_phone,
    o.total_amount,
    o.paid_amount,
    o.balance_amount,
    o.order_time,
    u.full_name AS created_by_name,
    COUNT(oi.id) AS item_count,
    o.special_instructions
FROM orders o
LEFT JOIN tables t ON o.table_id = t.id
LEFT JOIN users u ON o.created_by = u.id
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.status NOT IN ('completed', 'cancelled')
GROUP BY o.id, t.table_number, t.table_name, u.full_name
ORDER BY o.order_time DESC;

-- Daily Sales Summary
CREATE VIEW daily_sales_summary AS
SELECT 
    DATE(order_time) AS sale_date,
    COUNT(DISTINCT id) AS total_orders,
    COUNT(DISTINCT CASE WHEN status = 'completed' THEN id END) AS completed_orders,
    COUNT(DISTINCT CASE WHEN status = 'cancelled' THEN id END) AS cancelled_orders,
    SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) AS total_sales,
    AVG(CASE WHEN status = 'completed' THEN total_amount END) AS avg_order_value,
    SUM(CASE WHEN status = 'completed' THEN discount_amount ELSE 0 END) AS total_discounts,
    SUM(CASE WHEN status = 'completed' THEN tax_amount ELSE 0 END) AS total_tax_collected
FROM orders
GROUP BY DATE(order_time)
ORDER BY sale_date DESC;

-- Kitchen Orders View
CREATE VIEW kitchen_orders_view AS
SELECT 
    o.id AS order_id,
    o.order_number,
    o.order_type,
    t.table_number,
    t.table_name,
    oi.id AS item_id,
    oi.product_name,
    oi.quantity,
    oi.item_status,
    oi.special_instructions,
    oi.customizations,
    oi.ordered_at,
    EXTRACT(EPOCH FROM (NOW() - oi.ordered_at))/60 AS minutes_waiting
FROM orders o
LEFT JOIN tables t ON o.table_id = t.id
JOIN order_items oi ON o.id = oi.order_id
WHERE o.status IN ('confirmed', 'preparing')
  AND oi.item_status IN ('pending', 'confirmed', 'preparing')
ORDER BY oi.ordered_at ASC;

-- Payment Method Summary
CREATE VIEW payment_method_summary AS
SELECT 
    DATE(op.payment_date) AS payment_date,
    op.payment_method,
    COUNT(op.id) AS transaction_count,
    SUM(op.amount) AS total_amount
FROM order_payments op
WHERE op.status = 'completed'
GROUP BY DATE(op.payment_date), op.payment_method
ORDER BY payment_date DESC, total_amount DESC;