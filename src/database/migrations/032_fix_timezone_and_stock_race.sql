-- =====================================================
-- Migration 032: Critical business-logic fixes
-- 1. FIX: silent overselling race in apply_stock_movement()
--    The SELECT had no FOR UPDATE, so two concurrent 'sale'
--    inserts could both read current_stock=5, both compute 0,
--    both write 0 -> 10 units sold from 5 in stock.
-- 2. FIX: timezone correctness for Asia/Kathmandu (NPT, UTC+5:45, no DST).
--    Migration 031 attempted this but used a double conversion
--    (order_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kathmandu')
--    which shifts instants by +5:45 and puts 00:00-05:45 NPT orders
--    on the previous day. Correct form is a single conversion:
--    order_time AT TIME ZONE 'Asia/Kathmandu'.
--    All "today" views previously used DATE(col) = CURRENT_DATE,
--    which follows the DB session timezone, not the cafe's wall clock.
-- 3. ADD: idempotency guard - one transaction_id per order.
-- =====================================================

-- ─── 1. Stock movement race fix ─────────────────────────────
CREATE OR REPLACE FUNCTION apply_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
    v_current  DECIMAL(10,3);
    v_new      DECIMAL(10,3);
    v_avg_cost DECIMAL(10,2);
BEGIN
    -- FOR UPDATE serializes concurrent movements on the same product,
    -- so the read-check-write below is atomic per product row.
    SELECT current_stock, average_cost_price
    INTO v_current, v_avg_cost
    FROM inventory_stock
    WHERE product_id = NEW.product_id
    FOR UPDATE;

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

-- ─── 2. Timezone-correct dashboard views ────────────────────
-- Helper convention used below:
--   (col AT TIME ZONE 'Asia/Kathmandu')::date  -> the cafe's wall-clock date
--   (NOW() AT TIME ZONE 'Asia/Kathmandu')::date -> "today" in Kathmandu

CREATE OR REPLACE VIEW v_today_overview AS
SELECT
  COUNT(*)                                                                AS total_orders,
  COUNT(*) FILTER (WHERE status = 'completed')                           AS completed_orders,
  COUNT(*) FILTER (WHERE status = 'cancelled')                           AS cancelled_orders,
  COUNT(*) FILTER (WHERE status = 'pending')                             AS pending_orders,
  COUNT(*) FILTER (WHERE status NOT IN ('completed','cancelled'))        AS active_orders,
  COALESCE(SUM(total_amount)          FILTER (WHERE status='completed'), 0) AS total_revenue,
  COALESCE(SUM(tax_amount)            FILTER (WHERE status='completed'), 0) AS total_tax,
  COALESCE(SUM(discount_amount)       FILTER (WHERE status='completed'), 0) AS total_discounts,
  COALESCE(SUM(service_charge_amount) FILTER (WHERE status='completed'), 0) AS total_service_charge,
  COALESCE(AVG(total_amount)          FILTER (WHERE status='completed'), 0) AS avg_order_value,
  COALESCE(SUM(total_amount) FILTER (WHERE status='completed' AND order_type='dine_in'),  0) AS dine_in_revenue,
  COALESCE(SUM(total_amount) FILTER (WHERE status='completed' AND order_type='takeaway'), 0) AS takeaway_revenue,
  COALESCE(SUM(total_amount) FILTER (WHERE status='completed' AND order_type='delivery'), 0) AS delivery_revenue,
  COALESCE(SUM(total_amount) FILTER (WHERE status='completed' AND order_type='credit'),   0) AS credit_revenue,
  COALESCE(SUM(balance_amount) FILTER (
    WHERE payment_status IN ('unpaid','partial')
    AND   status NOT IN ('cancelled')
  ), 0)                                                                  AS total_unpaid_amount
FROM orders
WHERE (order_time AT TIME ZONE 'Asia/Kathmandu')::date
    = (NOW() AT TIME ZONE 'Asia/Kathmandu')::date;

CREATE OR REPLACE VIEW v_today_payment_breakdown AS
SELECT
  op.payment_method,
  COUNT(*)       AS transaction_count,
  SUM(op.amount) AS total_amount,
  ROUND(
    SUM(op.amount) * 100.0 / NULLIF(SUM(SUM(op.amount)) OVER (), 0),
  2)             AS percentage
FROM order_payments op
WHERE op.status = 'completed'
  AND (op.payment_date AT TIME ZONE 'Asia/Kathmandu')::date
    = (NOW() AT TIME ZONE 'Asia/Kathmandu')::date
GROUP BY op.payment_method
ORDER BY total_amount DESC;

CREATE OR REPLACE VIEW v_today_credit_activity AS
SELECT
  COALESCE(SUM(ct.amount) FILTER (
    WHERE ct.transaction_type = 'charge'
    AND   (ct.transaction_date AT TIME ZONE 'Asia/Kathmandu')::date
        = (NOW() AT TIME ZONE 'Asia/Kathmandu')::date
  ), 0)                                                  AS today_credit_sales,
  COALESCE(SUM(ct.amount) FILTER (
    WHERE ct.transaction_type = 'payment'
    AND   (ct.transaction_date AT TIME ZONE 'Asia/Kathmandu')::date
        = (NOW() AT TIME ZONE 'Asia/Kathmandu')::date
  ), 0)                                                  AS today_payments_received,
  COALESCE(SUM(cc.current_balance), 0)                   AS total_outstanding,
  COUNT(DISTINCT cc.id) FILTER (WHERE cc.current_balance > 0) AS customers_with_balance,
  (
    SELECT COUNT(DISTINCT credit_customer_id)
    FROM credit_transactions
    WHERE transaction_type = 'charge'
      AND due_date < (NOW() AT TIME ZONE 'Asia/Kathmandu')::date
  )                                                      AS customers_overdue
FROM credit_customers cc
LEFT JOIN credit_transactions ct ON cc.id = ct.credit_customer_id
WHERE cc.status != 'closed';

-- Food vs drink: single conversion, periods truncated in Kathmandu wall time.
-- period_* columns are plain timestamps representing Kathmandu local time.
DROP VIEW IF EXISTS v_food_drink_sales;
CREATE VIEW v_food_drink_sales AS
SELECT
  DATE_TRUNC('day',   o.order_time AT TIME ZONE 'Asia/Kathmandu') AS period_day,
  DATE_TRUNC('week',  o.order_time AT TIME ZONE 'Asia/Kathmandu') AS period_week,
  DATE_TRUNC('month', o.order_time AT TIME ZONE 'Asia/Kathmandu') AS period_month,
  DATE_TRUNC('year',  o.order_time AT TIME ZONE 'Asia/Kathmandu') AS period_year,
  p.department                      AS item_type,
  c_sub.id                          AS sub_category_id,
  c_sub.name                        AS sub_category_name,
  c_main.id                         AS main_category_id,
  c_main.name                       AS main_category_name,
  o.id                              AS order_id,
  oi.product_id                     AS product_id,
  oi.quantity                       AS quantity,
  oi.total_price                    AS total_price
FROM order_items   oi
JOIN orders        o      ON oi.order_id   = o.id
JOIN products      p      ON oi.product_id = p.id
JOIN categories    c_sub  ON p.category_id = c_sub.id
LEFT JOIN categories c_main ON c_sub.parent_id = c_main.id
WHERE o.status = 'completed';

CREATE OR REPLACE VIEW v_hourly_heatmap AS
SELECT
  EXTRACT(DOW  FROM order_time AT TIME ZONE 'Asia/Kathmandu')::INT AS day_of_week,
  EXTRACT(HOUR FROM order_time AT TIME ZONE 'Asia/Kathmandu')::INT AS hour_of_day,
  COUNT(*)                           AS order_count,
  COALESCE(SUM(total_amount), 0)     AS revenue,
  ROUND(AVG(total_amount), 2)        AS avg_order_value
FROM orders
WHERE status = 'completed'
  AND order_time >= NOW() - INTERVAL '14 days'
GROUP BY 1, 2
ORDER BY 1, 2;

CREATE OR REPLACE VIEW v_staff_today AS
SELECT
  u.id,
  u.full_name,
  COUNT(DISTINCT o.id)                                                    AS orders_handled,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'completed')             AS completed,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'cancelled')             AS cancelled,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'completed'), 0) AS revenue_generated,
  ROUND(AVG(o.total_amount)   FILTER (WHERE o.status = 'completed'), 2)  AS avg_order_value,
  ROUND(
    COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'cancelled') * 100.0
    / NULLIF(COUNT(DISTINCT o.id), 0),
  2)                                                                      AS cancellation_rate_pct
FROM users u
LEFT JOIN orders o ON o.created_by = u.id
  AND (o.order_time AT TIME ZONE 'Asia/Kathmandu')::date
    = (NOW() AT TIME ZONE 'Asia/Kathmandu')::date
GROUP BY u.id, u.full_name
ORDER BY revenue_generated DESC;

CREATE OR REPLACE VIEW v_discount_analysis AS
SELECT
  (order_time AT TIME ZONE 'Asia/Kathmandu')::date AS sale_date,
  discount_type,
  COUNT(*)                      AS order_count,
  SUM(discount_amount)          AS total_discount_given,
  ROUND(AVG(discount_amount), 2) AS avg_discount_amount,
  SUM(total_amount)             AS revenue_after_discount,
  SUM(total_amount + discount_amount) AS gross_revenue,
  ROUND(
    SUM(discount_amount) * 100.0
    / NULLIF(SUM(total_amount + discount_amount), 0),
  2)                            AS effective_discount_rate_pct
FROM orders
WHERE status = 'completed'
  AND discount_type IS NOT NULL
GROUP BY 1, 2
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW v_cancellation_analysis AS
SELECT
  (cancelled_at AT TIME ZONE 'Asia/Kathmandu')::date AS cancel_date,
  cancellation_reason,
  order_type,
  COUNT(*)             AS cancellation_count,
  SUM(total_amount)    AS lost_revenue
FROM orders
WHERE status = 'cancelled'
  AND cancelled_at IS NOT NULL
GROUP BY 1, 2, 3
ORDER BY 1 DESC;

-- Monthly store P&L in Kathmandu wall time; voided transactions excluded.
DROP VIEW IF EXISTS monthly_store_pl;
CREATE VIEW monthly_store_pl AS
SELECT
    DATE_TRUNC('month', transaction_date AT TIME ZONE 'Asia/Kathmandu') AS month,
    SUM(CASE WHEN type = 'incoming' THEN amount ELSE 0 END) AS total_income,
    SUM(CASE WHEN type = 'outgoing' THEN amount ELSE 0 END) AS total_expense,
    SUM(CASE WHEN type = 'incoming' THEN amount ELSE -amount END) AS net
FROM store_transactions
WHERE status = 'active'
GROUP BY DATE_TRUNC('month', transaction_date AT TIME ZONE 'Asia/Kathmandu')
ORDER BY month DESC;

-- ─── 3. Payment idempotency guard ────────────────────────────
-- A retried / double-submitted payment with the same gateway
-- transaction_id can no longer double-charge an order.
-- NULL transaction_ids (cash) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_payments_order_txn
  ON order_payments (order_id, transaction_id)
  WHERE transaction_id IS NOT NULL;

-- ─── 4. One invoice per order ─────────────────────────────────
-- The application already enforces this with a findByOrderId check,
-- but the check-then-insert races under concurrency. The constraint
-- makes it atomic; the service maps 23505 to HTTP 409.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_records_order_id
  ON invoice_records (order_id);
