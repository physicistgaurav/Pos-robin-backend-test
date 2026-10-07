-- =====================================================
-- CREDIT CUSTOMERS
-- =====================================================
CREATE TABLE credit_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) UNIQUE NOT NULL,
    customer_email VARCHAR(255),
    
    company_name VARCHAR(255),
    company_registration VARCHAR(100),
    pan_number VARCHAR(20),
    
    billing_address TEXT,
    
    credit_limit DECIMAL(10,2) NOT NULL DEFAULT 0,
    current_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    available_credit DECIMAL(10,2) GENERATED ALWAYS AS (credit_limit - current_balance) STORED,
    
    payment_terms_days INTEGER DEFAULT 30, -- Net 30, Net 15, etc.
    
    status VARCHAR(20) DEFAULT 'active',
    
    contact_person VARCHAR(255),
    contact_phone VARCHAR(20),
    
    notes TEXT,
    internal_notes TEXT, -- Staff only
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT credit_limit_check CHECK (credit_limit >= 0),
    CONSTRAINT balance_check CHECK (current_balance >= 0),
    CONSTRAINT status_check CHECK (status IN ('active', 'suspended', 'closed')),
    CONSTRAINT payment_terms_check CHECK (payment_terms_days > 0)
);

CREATE INDEX idx_credit_customers_phone ON credit_customers(customer_phone);
CREATE INDEX idx_credit_customers_status ON credit_customers(status);
CREATE INDEX idx_credit_customers_company ON credit_customers(company_name);
CREATE INDEX idx_credit_customers_balance ON credit_customers(current_balance) WHERE current_balance > 0;

-- =====================================================
-- INVOICE RECORDS
-- =====================================================
CREATE TABLE invoice_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    credit_customer_id UUID REFERENCES credit_customers(id) ON DELETE SET NULL,
    
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    fiscal_year VARCHAR(10) NOT NULL, -- "2081/82" (Nepali) or "2024/25"
    
    invoice_type VARCHAR(20) DEFAULT 'tax_invoice',
    
    invoice_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    due_date DATE,
    
    -- Amounts (denormalized for reporting)
    subtotal DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    service_charge_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    
    -- VAT Details (Nepal specific)
    pan_number VARCHAR(20), -- Restaurant's PAN
    vat_amount DECIMAL(10,2),
    
    -- Customer details snapshot
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    customer_address TEXT,
    customer_pan VARCHAR(20),
    
    -- PDF Storage
    pdf_generated BOOLEAN DEFAULT false,
    pdf_path TEXT,
    pdf_url TEXT,
    
    -- Printing tracking
    printed_count INTEGER DEFAULT 0,
    first_printed_at TIMESTAMP WITH TIME ZONE,
    last_printed_at TIMESTAMP WITH TIME ZONE,
    
    -- Email tracking
    emailed_to VARCHAR(255),
    emailed_at TIMESTAMP WITH TIME ZONE,
    email_count INTEGER DEFAULT 0,
    
    -- Payment tracking
    payment_status payment_status DEFAULT 'unpaid',
    paid_amount DECIMAL(10,2) DEFAULT 0,
    
    notes TEXT,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT invoice_type_check CHECK (
        invoice_type IN ('tax_invoice', 'simplified_invoice', 'credit_note', 'proforma')
    )
);

CREATE INDEX idx_invoice_records_order ON invoice_records(order_id);
CREATE INDEX idx_invoice_records_number ON invoice_records(invoice_number);
CREATE INDEX idx_invoice_records_customer ON invoice_records(credit_customer_id);
CREATE INDEX idx_invoice_records_date ON invoice_records(invoice_date DESC);
CREATE INDEX idx_invoice_records_due_date ON invoice_records(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_invoice_records_payment_status ON invoice_records(payment_status);
CREATE INDEX idx_invoice_records_fiscal_year ON invoice_records(fiscal_year);

-- =====================================================
-- CREDIT TRANSACTIONS (Ledger)
-- =====================================================
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    credit_customer_id UUID NOT NULL REFERENCES credit_customers(id) ON DELETE RESTRICT,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoice_records(id) ON DELETE SET NULL,
    
    transaction_type VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    
    balance_before DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    
    payment_method payment_method,
    transaction_id VARCHAR(255),
    reference_number VARCHAR(255),
    
    due_date DATE,
    
    notes TEXT,
    created_by UUID REFERENCES users(id),
    
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT transaction_type_check CHECK (
        transaction_type IN ('charge', 'payment', 'adjustment', 'credit_note', 'opening_balance')
    ),
    CONSTRAINT amount_check CHECK (amount != 0)
);

CREATE INDEX idx_credit_transactions_customer ON credit_transactions(credit_customer_id);
CREATE INDEX idx_credit_transactions_order ON credit_transactions(order_id);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX idx_credit_transactions_date ON credit_transactions(transaction_date DESC);
CREATE INDEX idx_credit_transactions_due_date ON credit_transactions(due_date) WHERE due_date IS NOT NULL;

-- =====================================================
-- INVOICE SEQUENCE
-- =====================================================
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    v_fiscal_year VARCHAR(10);
    v_year_start INTEGER;
    v_year_end INTEGER;
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        -- Determine fiscal year (Nepal: mid-July to mid-July)
        -- Simplified: Using calendar year for now
        v_year_start := EXTRACT(YEAR FROM CURRENT_DATE);
        v_year_end := v_year_start + 1;
        v_fiscal_year := v_year_start::TEXT || '/' || RIGHT(v_year_end::TEXT, 2);
        
        NEW.fiscal_year := v_fiscal_year;
        NEW.invoice_number := 
            'INV-' || REPLACE(v_fiscal_year, '/', '') || '-' ||
            LPAD(NEXTVAL('invoice_number_seq')::TEXT, 5, '0');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_invoice_number
BEFORE INSERT ON invoice_records
FOR EACH ROW
EXECUTE FUNCTION generate_invoice_number();

-- Update credit customer balance
CREATE OR REPLACE FUNCTION update_credit_customer_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_customer_id UUID;
    v_new_balance DECIMAL(10,2);
BEGIN
    v_customer_id := NEW.credit_customer_id;
    
    -- Calculate new balance from all transactions
    SELECT COALESCE(SUM(
        CASE 
            WHEN transaction_type IN ('charge', 'opening_balance') THEN amount
            WHEN transaction_type IN ('payment', 'credit_note') THEN -amount
            WHEN transaction_type = 'adjustment' THEN amount
        END
    ), 0)
    INTO v_new_balance
    FROM credit_transactions
    WHERE credit_customer_id = v_customer_id;
    
    -- Update customer balance
    UPDATE credit_customers
    SET current_balance = v_new_balance,
        updated_at = NOW()
    WHERE id = v_customer_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_credit_balance
AFTER INSERT ON credit_transactions
FOR EACH ROW
EXECUTE FUNCTION update_credit_customer_balance();

-- Track invoice printing
CREATE OR REPLACE FUNCTION track_invoice_printing()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.printed_count > OLD.printed_count THEN
        NEW.last_printed_at := NOW();
        
        IF OLD.first_printed_at IS NULL THEN
            NEW.first_printed_at := NOW();
        END IF;
    END IF;
    
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_track_invoice_printing
BEFORE UPDATE ON invoice_records
FOR EACH ROW
WHEN (NEW.printed_count IS DISTINCT FROM OLD.printed_count)
EXECUTE FUNCTION track_invoice_printing();

-- =====================================================
-- VIEWS
-- =====================================================

-- Credit customers with outstanding balance
CREATE VIEW credit_customers_outstanding AS
SELECT 
    cc.id,
    cc.customer_name,
    cc.company_name,
    cc.customer_phone,
    cc.credit_limit,
    cc.current_balance,
    cc.available_credit,
    cc.payment_terms_days,
    cc.status,
    COUNT(DISTINCT ct.id) FILTER (WHERE ct.transaction_type = 'charge') as total_invoices,
    COUNT(DISTINCT ct.id) FILTER (WHERE ct.due_date < CURRENT_DATE) as overdue_invoices,
    MIN(ct.due_date) FILTER (WHERE ct.due_date < CURRENT_DATE) as earliest_overdue_date,
    MAX(ct.transaction_date) as last_transaction_date
FROM credit_customers cc
LEFT JOIN credit_transactions ct ON cc.id = ct.credit_customer_id
WHERE cc.current_balance > 0
GROUP BY cc.id
ORDER BY cc.current_balance DESC;

-- Invoice summary view
CREATE VIEW invoice_summary AS
SELECT 
    ir.id,
    ir.invoice_number,
    ir.fiscal_year,
    ir.invoice_date,
    ir.due_date,
    ir.total_amount,
    ir.payment_status,
    ir.paid_amount,
    ir.total_amount - ir.paid_amount as balance_amount,
    o.order_number,
    o.order_type,
    cc.customer_name as credit_customer_name,
    cc.company_name as credit_company_name,
    CASE 
        WHEN ir.due_date < CURRENT_DATE AND ir.payment_status != 'paid' THEN true
        ELSE false
    END as is_overdue,
    CASE 
        WHEN ir.due_date < CURRENT_DATE AND ir.payment_status != 'paid' 
        THEN CURRENT_DATE - ir.due_date
        ELSE 0
    END as days_overdue
FROM invoice_records ir
JOIN orders o ON ir.order_id = o.id
LEFT JOIN credit_customers cc ON ir.credit_customer_id = cc.id
ORDER BY ir.invoice_date DESC;

-- Aged receivables report
CREATE VIEW aged_receivables AS
SELECT 
    cc.id as customer_id,
    cc.customer_name,
    cc.company_name,
    cc.current_balance as total_outstanding,
    
    -- Current (0-30 days)
    SUM(CASE 
        WHEN ct.due_date >= CURRENT_DATE - INTERVAL '30 days' 
        THEN ct.amount ELSE 0 
    END) as current_0_30,
    
    -- 31-60 days
    SUM(CASE 
        WHEN ct.due_date < CURRENT_DATE - INTERVAL '30 days' 
        AND ct.due_date >= CURRENT_DATE - INTERVAL '60 days'
        THEN ct.amount ELSE 0 
    END) as aged_31_60,
    
    -- 61-90 days
    SUM(CASE 
        WHEN ct.due_date < CURRENT_DATE - INTERVAL '60 days'
        AND ct.due_date >= CURRENT_DATE - INTERVAL '90 days'
        THEN ct.amount ELSE 0 
    END) as aged_61_90,
    
    -- Over 90 days
    SUM(CASE 
        WHEN ct.due_date < CURRENT_DATE - INTERVAL '90 days'
        THEN ct.amount ELSE 0 
    END) as aged_over_90
    
FROM credit_customers cc
LEFT JOIN credit_transactions ct ON cc.id = ct.credit_customer_id
    AND ct.transaction_type = 'charge'
    AND ct.due_date IS NOT NULL
WHERE cc.current_balance > 0
GROUP BY cc.id, cc.customer_name, cc.company_name, cc.current_balance
ORDER BY cc.current_balance DESC;

-- Daily invoice summary
CREATE VIEW daily_invoice_summary AS
SELECT 
    DATE(invoice_date) as invoice_date,
    COUNT(*) as total_invoices,
    SUM(total_amount) as total_invoiced,
    SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as total_paid,
    SUM(CASE WHEN payment_status = 'unpaid' THEN total_amount ELSE 0 END) as total_unpaid,
    SUM(CASE WHEN payment_status = 'partial' THEN total_amount ELSE 0 END) as total_partial,
    COUNT(*) FILTER (WHERE credit_customer_id IS NOT NULL) as credit_invoices,
    COUNT(*) FILTER (WHERE credit_customer_id IS NULL) as cash_invoices
FROM invoice_records
GROUP BY DATE(invoice_date)
ORDER BY DATE(invoice_date) DESC;

-- =====================================================
-- ADDITIONAL CONSTRAINTS
-- =====================================================

-- Link orders to credit customers
ALTER TABLE orders 
ADD COLUMN credit_customer_id UUID REFERENCES credit_customers(id) ON DELETE SET NULL;

CREATE INDEX idx_orders_credit_customer ON orders(credit_customer_id);


-- Update order_type enum to include 'credit'
ALTER TYPE order_type ADD VALUE IF NOT EXISTS 'credit';

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS credit_customer_id UUID
REFERENCES credit_customers(id)
ON DELETE SET NULL;

