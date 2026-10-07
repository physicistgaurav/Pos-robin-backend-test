-- 026_missing_dashboard_views.sql

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
WHERE DATE(order_time) = CURRENT_DATE;

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
  AND DATE(op.payment_date) = CURRENT_DATE
GROUP BY op.payment_method
ORDER BY total_amount DESC;

CREATE OR REPLACE VIEW v_today_credit_activity AS
SELECT
  COALESCE(SUM(ct.amount) FILTER (
    WHERE ct.transaction_type = 'charge'
    AND   DATE(ct.transaction_date) = CURRENT_DATE
  ), 0)                                                  AS today_credit_sales,
  COALESCE(SUM(ct.amount) FILTER (
    WHERE ct.transaction_type = 'payment'
    AND   DATE(ct.transaction_date) = CURRENT_DATE
  ), 0)                                                  AS today_payments_received,
  COALESCE(SUM(cc.current_balance), 0)                   AS total_outstanding,
  COUNT(DISTINCT cc.id) FILTER (WHERE cc.current_balance > 0) AS customers_with_balance,
  (
    SELECT COUNT(DISTINCT credit_customer_id)
    FROM credit_transactions
    WHERE transaction_type = 'charge'
      AND due_date < CURRENT_DATE
  )                                                      AS customers_overdue
FROM credit_customers cc
LEFT JOIN credit_transactions ct ON cc.id = ct.credit_customer_id
WHERE cc.status != 'closed';

CREATE OR REPLACE VIEW v_food_drink_sales AS
SELECT
  DATE_TRUNC('day',   o.order_time) AS period_day,
  DATE_TRUNC('week',  o.order_time) AS period_week,
  DATE_TRUNC('month', o.order_time) AS period_month,
  DATE_TRUNC('year',  o.order_time) AS period_year,
  p.department                      AS item_type,
  c_sub.id                          AS sub_category_id,
  c_sub.name                        AS sub_category_name,
  c_main.id                         AS main_category_id,
  c_main.name                       AS main_category_name,
  COUNT(DISTINCT o.id)              AS order_count,
  SUM(oi.quantity)                  AS items_sold,
  COUNT(DISTINCT oi.product_id)     AS products_count,
  SUM(oi.total_price)               AS revenue
FROM order_items   oi
JOIN orders        o      ON oi.order_id   = o.id
JOIN products      p      ON oi.product_id = p.id
JOIN categories    c_sub  ON p.category_id = c_sub.id
LEFT JOIN categories c_main ON c_sub.parent_id = c_main.id
WHERE o.status = 'completed'
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9;

CREATE OR REPLACE VIEW v_hourly_heatmap AS
SELECT
  EXTRACT(DOW  FROM order_time)::INT AS day_of_week,
  EXTRACT(HOUR FROM order_time)::INT AS hour_of_day,
  COUNT(*)                           AS order_count,
  COALESCE(SUM(total_amount), 0)     AS revenue,
  ROUND(AVG(total_amount), 2)        AS avg_order_value
FROM orders
WHERE status = 'completed'
  AND order_time >= NOW() - INTERVAL '14 days'
GROUP BY 1, 2
ORDER BY 1, 2;

CREATE OR REPLACE VIEW v_table_occupancy AS
SELECT
  COUNT(*)                                           AS total_tables,
  COUNT(*) FILTER (WHERE status = 'occupied')        AS occupied_tables,
  COUNT(*) FILTER (WHERE status = 'available')       AS available_tables,
  COUNT(*) FILTER (WHERE status = 'reserved')        AS reserved_tables,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'occupied') * 100.0
    / NULLIF(COUNT(*), 0),
  1)                                                 AS occupancy_pct
FROM tables;

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
  AND DATE(o.order_time) = CURRENT_DATE
GROUP BY u.id, u.full_name
ORDER BY revenue_generated DESC;

CREATE OR REPLACE VIEW v_discount_analysis AS
SELECT
  DATE(order_time)              AS sale_date,
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
  DATE(cancelled_at)   AS cancel_date,
  cancellation_reason,
  order_type,
  COUNT(*)             AS cancellation_count,
  SUM(total_amount)    AS lost_revenue
FROM orders
WHERE status = 'cancelled'
  AND cancelled_at IS NOT NULL
GROUP BY 1, 2, 3
ORDER BY 1 DESC;