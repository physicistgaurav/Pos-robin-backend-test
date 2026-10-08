-- =====================================================
-- Migration 033: Credit reporting + payment integrity fixes
--
-- 1. FIX (critical, reports): v_today_credit_activity summed
--    credit_customers.current_balance AFTER joining credit_transactions,
--    so every customer's balance was counted once PER LEDGER ROW.
--    Dashboard "Outstanding Credit" was inflated by the average number of
--    ledger rows per customer (e.g. Rs 42,11,481 vs the real Rs 1,30,983).
--
-- 2. FIX (reports): overdue / aging ignored payments. A fully paid charge
--    stayed "overdue" forever and aging buckets never reconciled to the
--    customer balance. Open items are now computed FIFO (payments settle the
--    oldest charges first) in the new view credit_open_items.
--
-- 3. FIX (money): update_payment_status() ignored refunds. After a partial
--    refund, the next payment on that order reset paid_amount to the gross
--    (pre-refund) total, silently "un-refunding" the order.
--
-- 4. FIX (timezone): order numbers and legacy summary views used the DB
--    session date (UTC on most hosts) instead of the Kathmandu date.
--
-- 5. FIX (reports): discount analysis used total_amount + discount_amount as
--    "gross" (tax-inclusive, tax is computed AFTER discount), which understated
--    the effective discount rate. Gross is now the pre-discount subtotal.
-- =====================================================

-- ─── 1/2. FIFO open items (single source of truth for overdue + aging) ────────
-- Payments / credit notes / negative adjustments settle the OLDEST charges
-- first, so the outstanding amount of a customer is made of their NEWEST
-- positive ledger entries. SUM(outstanding_amount) == credit_customers.current_balance.
DROP VIEW IF EXISTS aged_receivables;
DROP VIEW IF EXISTS credit_customers_outstanding;
DROP VIEW IF EXISTS credit_open_items;

CREATE VIEW credit_open_items AS
WITH positives AS (
  SELECT
    ct.id                      AS credit_transaction_id,
    ct.credit_customer_id,
    ct.order_id,
    ct.invoice_id,
    ct.transaction_type,
    ct.transaction_date,
    COALESCE(
      ct.due_date,
      (ct.transaction_date AT TIME ZONE 'Asia/Kathmandu')::date + cc.payment_terms_days
    )                          AS due_date,
    ct.amount                  AS original_amount,
    cc.current_balance,
    -- total of all NEWER positive entries of the same customer
    COALESCE(SUM(ct.amount) OVER (
      PARTITION BY ct.credit_customer_id
      ORDER BY ct.transaction_date DESC, ct.created_at DESC, ct.id DESC
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ), 0)                      AS newer_total
  FROM credit_transactions ct
  JOIN credit_customers cc ON cc.id = ct.credit_customer_id
  WHERE ct.amount > 0
    AND ct.transaction_type IN ('charge', 'opening_balance', 'adjustment')
)
SELECT
  credit_transaction_id,
  credit_customer_id,
  order_id,
  invoice_id,
  transaction_type,
  transaction_date,
  due_date,
  original_amount,
  GREATEST(0, LEAST(original_amount, current_balance - newer_total))::numeric(10,2)
                               AS outstanding_amount
FROM positives
WHERE GREATEST(0, LEAST(original_amount, current_balance - newer_total)) > 0;

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
  (SELECT COUNT(*) FROM credit_transactions ct
    WHERE ct.credit_customer_id = cc.id AND ct.transaction_type = 'charge')
                                                         AS total_invoices,
  (SELECT COUNT(*) FROM credit_open_items oi
    WHERE oi.credit_customer_id = cc.id
      AND oi.due_date < (NOW() AT TIME ZONE 'Asia/Kathmandu')::date)
                                                         AS overdue_invoices,
  (SELECT MIN(oi.due_date) FROM credit_open_items oi
    WHERE oi.credit_customer_id = cc.id
      AND oi.due_date < (NOW() AT TIME ZONE 'Asia/Kathmandu')::date)
                                                         AS earliest_overdue_date,
  (SELECT MAX(ct.transaction_date) FROM credit_transactions ct
    WHERE ct.credit_customer_id = cc.id)                 AS last_transaction_date
FROM credit_customers cc
WHERE cc.current_balance > 0
ORDER BY cc.current_balance DESC;

-- Aging buckets keep the original boundaries (current = not yet due or <=30
-- days past due) but are now built from what is STILL OWED, so
-- current_0_30 + aged_31_60 + aged_61_90 + aged_over_90 = total_outstanding.
CREATE VIEW aged_receivables AS
SELECT
  cc.id                AS customer_id,
  cc.customer_name,
  cc.company_name,
  cc.current_balance   AS total_outstanding,
  COALESCE(SUM(oi.outstanding_amount) FILTER (
    WHERE oi.due_date >= (NOW() AT TIME ZONE 'Asia/Kathmandu')::date - 30), 0)
                       AS current_0_30,
  COALESCE(SUM(oi.outstanding_amount) FILTER (
    WHERE oi.due_date <  (NOW() AT TIME ZONE 'Asia/Kathmandu')::date - 30
      AND oi.due_date >= (NOW() AT TIME ZONE 'Asia/Kathmandu')::date - 60), 0)
                       AS aged_31_60,
  COALESCE(SUM(oi.outstanding_amount) FILTER (
    WHERE oi.due_date <  (NOW() AT TIME ZONE 'Asia/Kathmandu')::date - 60
      AND oi.due_date >= (NOW() AT TIME ZONE 'Asia/Kathmandu')::date - 90), 0)
                       AS aged_61_90,
  COALESCE(SUM(oi.outstanding_amount) FILTER (
    WHERE oi.due_date <  (NOW() AT TIME ZONE 'Asia/Kathmandu')::date - 90), 0)
                       AS aged_over_90
FROM credit_customers cc
LEFT JOIN credit_open_items oi ON oi.credit_customer_id = cc.id
WHERE cc.current_balance > 0
GROUP BY cc.id, cc.customer_name, cc.company_name, cc.current_balance
ORDER BY cc.current_balance DESC;

-- Dashboard credit widget: no join between customers and ledger -> no fan-out.
DROP VIEW IF EXISTS v_today_credit_activity;
CREATE VIEW v_today_credit_activity AS
SELECT
  COALESCE((
    SELECT SUM(ct.amount) FROM credit_transactions ct
    WHERE ct.transaction_type = 'charge'
      AND (ct.transaction_date AT TIME ZONE 'Asia/Kathmandu')::date
        = (NOW() AT TIME ZONE 'Asia/Kathmandu')::date
  ), 0)                                                   AS today_credit_sales,
  COALESCE((
    SELECT SUM(ct.amount) FROM credit_transactions ct
    WHERE ct.transaction_type = 'payment'
      AND (ct.transaction_date AT TIME ZONE 'Asia/Kathmandu')::date
        = (NOW() AT TIME ZONE 'Asia/Kathmandu')::date
  ), 0)                                                   AS today_payments_received,
  COALESCE((SELECT SUM(cc.current_balance) FROM credit_customers cc), 0)
                                                          AS total_outstanding,
  (SELECT COUNT(*) FROM credit_customers cc WHERE cc.current_balance > 0)
                                                          AS customers_with_balance,
  (SELECT COUNT(DISTINCT oi.credit_customer_id) FROM credit_open_items oi
    WHERE oi.due_date < (NOW() AT TIME ZONE 'Asia/Kathmandu')::date)
                                                          AS customers_overdue,
  COALESCE((SELECT SUM(oi.outstanding_amount) FROM credit_open_items oi
    WHERE oi.due_date < (NOW() AT TIME ZONE 'Asia/Kathmandu')::date), 0)
                                                          AS overdue_amount;

-- ─── 3. Payment trigger: paid_amount must be NET of refunds ───────────────────
-- Same formula as PaymentModel.recalculateOrderPaymentStatus().
CREATE OR REPLACE FUNCTION update_payment_status()
RETURNS TRIGGER AS $$
DECLARE
    v_paid   DECIMAL(10,2);
    v_total  DECIMAL(10,2);
    v_status payment_status;
BEGIN
    SELECT GREATEST(COALESCE(SUM(op.amount - COALESCE(r.refunded, 0)), 0), 0)
    INTO v_paid
    FROM order_payments op
    LEFT JOIN (
        SELECT payment_id, SUM(refund_amount) AS refunded
        FROM order_refunds
        WHERE payment_id IS NOT NULL
        GROUP BY payment_id
    ) r ON r.payment_id = op.id
    WHERE op.order_id = NEW.order_id
      AND op.status = 'completed';

    SELECT total_amount INTO v_total FROM orders WHERE id = NEW.order_id;

    IF v_paid = 0 THEN
        v_status := 'unpaid';
    ELSIF v_paid >= v_total THEN
        v_status := 'paid';
    ELSE
        v_status := 'partial';
    END IF;

    UPDATE orders
    SET paid_amount    = v_paid,
        balance_amount = GREATEST(v_total - v_paid, 0),
        payment_status = v_status,
        updated_at     = NOW()
    WHERE id = NEW.order_id;

    -- Keep the invoice of a normal (non-credit) order in step with the order.
    -- Credit invoices are settled through the credit ledger instead (see below).
    UPDATE invoice_records
    SET paid_amount    = v_paid,
        payment_status = v_status,
        updated_at     = NOW()
    WHERE order_id = NEW.order_id
      AND credit_customer_id IS NULL
      AND (paid_amount IS DISTINCT FROM v_paid OR payment_status IS DISTINCT FROM v_status);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 4. Kathmandu-correct order number + legacy summary views ─────────────────
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number :=
            'ORD-' || TO_CHAR((NOW() AT TIME ZONE 'Asia/Kathmandu')::date, 'YYYYMMDD') || '-' ||
            LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE VIEW daily_sales_summary AS
SELECT
    (order_time AT TIME ZONE 'Asia/Kathmandu')::date AS sale_date,
    COUNT(DISTINCT id) AS total_orders,
    COUNT(DISTINCT CASE WHEN status = 'completed' THEN id END) AS completed_orders,
    COUNT(DISTINCT CASE WHEN status = 'cancelled' THEN id END) AS cancelled_orders,
    SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) AS total_sales,
    AVG(CASE WHEN status = 'completed' THEN total_amount END) AS avg_order_value,
    SUM(CASE WHEN status = 'completed' THEN discount_amount ELSE 0 END) AS total_discounts,
    SUM(CASE WHEN status = 'completed' THEN tax_amount ELSE 0 END) AS total_tax_collected
FROM orders
GROUP BY (order_time AT TIME ZONE 'Asia/Kathmandu')::date
ORDER BY sale_date DESC;

CREATE OR REPLACE VIEW payment_method_summary AS
SELECT
    (op.payment_date AT TIME ZONE 'Asia/Kathmandu')::date AS payment_date,
    op.payment_method,
    COUNT(op.id) AS transaction_count,
    SUM(op.amount) AS total_amount
FROM order_payments op
WHERE op.status = 'completed'
GROUP BY (op.payment_date AT TIME ZONE 'Asia/Kathmandu')::date, op.payment_method
ORDER BY payment_date DESC, total_amount DESC;

CREATE OR REPLACE VIEW store_transaction_summary AS
SELECT
    (transaction_date AT TIME ZONE 'Asia/Kathmandu')::date AS txn_date,
    type,
    category,
    COUNT(*)       AS transaction_count,
    SUM(amount)    AS total_amount
FROM store_transactions
WHERE status = 'active'
GROUP BY (transaction_date AT TIME ZONE 'Asia/Kathmandu')::date, type, category
ORDER BY txn_date DESC, type, category;

CREATE OR REPLACE VIEW daily_invoice_summary AS
SELECT
    (invoice_date AT TIME ZONE 'Asia/Kathmandu')::date AS invoice_date,
    COUNT(*) AS total_invoices,
    SUM(total_amount) AS total_invoiced,
    SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) AS total_paid,
    SUM(CASE WHEN payment_status = 'unpaid' THEN total_amount ELSE 0 END) AS total_unpaid,
    SUM(CASE WHEN payment_status = 'partial' THEN total_amount ELSE 0 END) AS total_partial,
    COUNT(*) FILTER (WHERE credit_customer_id IS NOT NULL) AS credit_invoices,
    COUNT(*) FILTER (WHERE credit_customer_id IS NULL) AS cash_invoices
FROM invoice_records
GROUP BY (invoice_date AT TIME ZONE 'Asia/Kathmandu')::date
ORDER BY (invoice_date AT TIME ZONE 'Asia/Kathmandu')::date DESC;

CREATE OR REPLACE VIEW invoice_summary AS
SELECT
    ir.id,
    ir.invoice_number,
    ir.fiscal_year,
    ir.invoice_date,
    ir.due_date,
    ir.total_amount,
    ir.payment_status,
    ir.paid_amount,
    ir.total_amount - ir.paid_amount AS balance_amount,
    o.order_number,
    o.order_type,
    cc.customer_name AS credit_customer_name,
    cc.company_name  AS credit_company_name,
    CASE
        WHEN ir.due_date < (NOW() AT TIME ZONE 'Asia/Kathmandu')::date
         AND ir.payment_status != 'paid' THEN true
        ELSE false
    END AS is_overdue,
    CASE
        WHEN ir.due_date < (NOW() AT TIME ZONE 'Asia/Kathmandu')::date
         AND ir.payment_status != 'paid'
        THEN (NOW() AT TIME ZONE 'Asia/Kathmandu')::date - ir.due_date
        ELSE 0
    END AS days_overdue
FROM invoice_records ir
JOIN orders o ON ir.order_id = o.id
LEFT JOIN credit_customers cc ON ir.credit_customer_id = cc.id
ORDER BY ir.invoice_date DESC;

-- ─── 5. Discount analysis: gross = pre-discount subtotal ──────────────────────
-- revenue_after_discount = subtotal - discount (pre-tax), so
-- effective_discount_rate_pct is the discount the customer actually received.
CREATE OR REPLACE VIEW v_discount_analysis AS
SELECT
  (order_time AT TIME ZONE 'Asia/Kathmandu')::date AS sale_date,
  discount_type,
  COUNT(*)                      AS order_count,
  SUM(discount_amount)          AS total_discount_given,
  ROUND(AVG(discount_amount), 2) AS avg_discount_amount,
  SUM(subtotal - discount_amount) AS revenue_after_discount,
  SUM(subtotal)                 AS gross_revenue,
  ROUND(
    SUM(discount_amount) * 100.0
    / NULLIF(SUM(subtotal), 0),
  2)                            AS effective_discount_rate_pct
FROM orders
WHERE status = 'completed'
  AND discount_type IS NOT NULL
GROUP BY 1, 2
ORDER BY 1 DESC;

-- ─── 6. Credit invoices must follow the credit ledger ─────────────────────────
-- Customer repayments are recorded on the ledger only, so a credit invoice used
-- to stay 'unpaid' forever and kept showing up in the overdue list after the
-- customer had paid. The invoice is now settled FIFO from the same open-item
-- view the dashboard uses, automatically on every ledger insert.
CREATE OR REPLACE FUNCTION sync_credit_invoice_status(p_customer_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE invoice_records ir
    SET paid_amount    = x.new_paid,
        payment_status = x.new_status,
        updated_at     = NOW()
    FROM (
        SELECT
            c.invoice_id,
            GREATEST(c.charged - COALESCE(o.outstanding, 0), 0) AS new_paid,
            (CASE
                WHEN COALESCE(o.outstanding, 0) <= 0        THEN 'paid'
                WHEN COALESCE(o.outstanding, 0) >= c.charged THEN 'unpaid'
                ELSE 'partial'
             END)::payment_status AS new_status
        FROM (
            SELECT invoice_id, SUM(amount) AS charged
            FROM credit_transactions
            WHERE credit_customer_id = p_customer_id
              AND transaction_type = 'charge'
              AND invoice_id IS NOT NULL
            GROUP BY invoice_id
        ) c
        LEFT JOIN (
            SELECT invoice_id, SUM(outstanding_amount) AS outstanding
            FROM credit_open_items
            WHERE credit_customer_id = p_customer_id
              AND invoice_id IS NOT NULL
            GROUP BY invoice_id
        ) o ON o.invoice_id = c.invoice_id
    ) x
    WHERE ir.id = x.invoice_id
      AND (ir.paid_amount IS DISTINCT FROM x.new_paid
           OR ir.payment_status IS DISTINCT FROM x.new_status);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_sync_credit_invoices()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM sync_credit_invoice_status(NEW.credit_customer_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Named so it sorts AFTER trigger_update_credit_balance (AFTER triggers fire
-- alphabetically) and therefore sees the refreshed current_balance.
DROP TRIGGER IF EXISTS trigger_zz_sync_credit_invoices ON credit_transactions;
CREATE TRIGGER trigger_zz_sync_credit_invoices
AFTER INSERT OR UPDATE OF invoice_id ON credit_transactions
FOR EACH ROW
EXECUTE FUNCTION trg_sync_credit_invoices();

-- One-off backfill so existing credit invoices reflect payments already received.
SELECT sync_credit_invoice_status(id) FROM credit_customers;
