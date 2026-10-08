-- =====================================================================
-- READ-ONLY reconciliation checks for money-related data.
-- Run against production AFTER deploying migration 033:
--   psql "$DATABASE_URL" -f src/database/diagnostics/reconcile_money.sql
-- Every query should return ZERO rows on a healthy system. Nothing here
-- changes data (the one optional repair is commented out at the bottom).
-- =====================================================================

\echo '--- 1. Credit customers whose stored balance != sum of their ledger'
SELECT cc.id, cc.customer_name,
       cc.current_balance AS stored_balance,
       COALESCE(SUM(CASE
         WHEN ct.transaction_type IN ('charge','opening_balance','adjustment') THEN ct.amount
         WHEN ct.transaction_type IN ('payment','credit_note') THEN -ct.amount
       END), 0) AS ledger_balance
FROM credit_customers cc
LEFT JOIN credit_transactions ct ON ct.credit_customer_id = cc.id
GROUP BY cc.id
HAVING cc.current_balance <> COALESCE(SUM(CASE
         WHEN ct.transaction_type IN ('charge','opening_balance','adjustment') THEN ct.amount
         WHEN ct.transaction_type IN ('payment','credit_note') THEN -ct.amount
       END), 0);

\echo '--- 2. DOUBLE-CHARGED orders: credit charges on the ledger exceed what the order is worth'
-- (counter "credit" payment + credit invoice both charged the account)
SELECT o.order_number, cc.customer_name, o.total_amount AS order_total,
       SUM(ct.amount) AS charged_to_ledger,
       SUM(ct.amount) - o.total_amount AS over_charged,
       COUNT(*) AS charge_rows
FROM credit_transactions ct
JOIN orders o ON o.id = ct.order_id
JOIN credit_customers cc ON cc.id = ct.credit_customer_id
WHERE ct.transaction_type = 'charge'
GROUP BY o.id, o.order_number, o.total_amount, cc.customer_name
HAVING SUM(ct.amount) > o.total_amount
ORDER BY over_charged DESC;

\echo '--- 3. Orders charged to a credit account but not marked as paid-by-credit'
-- (credit invoice created before this fix: shows as unpaid order AND credit outstanding)
SELECT o.order_number, o.payment_status, o.total_amount, o.balance_amount,
       SUM(ct.amount) AS charged_to_ledger
FROM credit_transactions ct
JOIN orders o ON o.id = ct.order_id
WHERE ct.transaction_type = 'charge'
  AND NOT EXISTS (SELECT 1 FROM order_payments op
                  WHERE op.order_id = o.id AND op.payment_method = 'credit'
                    AND op.status IN ('completed','refunded'))
GROUP BY o.id, o.order_number, o.payment_status, o.total_amount, o.balance_amount
ORDER BY o.order_number;

\echo '--- 4. Orders whose paid_amount != payments minus refunds (refund-then-repay drift)'
WITH net AS (
  SELECT op.order_id,
         SUM(op.amount - COALESCE(r.refunded, 0)) AS net_paid
  FROM order_payments op
  LEFT JOIN (SELECT payment_id, SUM(refund_amount) AS refunded
             FROM order_refunds WHERE payment_id IS NOT NULL GROUP BY payment_id) r
         ON r.payment_id = op.id
  WHERE op.status = 'completed'
  GROUP BY op.order_id
)
SELECT o.order_number, o.status, o.total_amount, o.paid_amount AS stored_paid,
       COALESCE(n.net_paid, 0) AS real_net_paid,
       o.paid_amount - COALESCE(n.net_paid, 0) AS drift
FROM orders o
LEFT JOIN net n ON n.order_id = o.id
WHERE o.paid_amount <> COALESCE(n.net_paid, 0)
ORDER BY o.order_time DESC;

\echo '--- 5. Cancelled orders that still carry payments (money taken, order cancelled)'
SELECT order_number, total_amount, paid_amount, cancellation_reason, cancelled_at
FROM orders
WHERE status = 'cancelled' AND paid_amount > 0
ORDER BY cancelled_at DESC;

\echo '--- 6. Tracked-stock items marked completed with NO sale movement (stock never deducted)'
-- Orders completed before inventory tracking was switched on for a product also
-- appear here; those are expected. Recent rows are the suspicious ones.
SELECT o.order_number, o.completed_at, oi.product_name, oi.quantity
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN inventory_stock s ON s.product_id = oi.product_id
WHERE oi.item_status = 'completed'
  AND NOT EXISTS (SELECT 1 FROM stock_movements sm
                  WHERE sm.order_item_id = oi.id AND sm.movement_type = 'sale')
ORDER BY o.completed_at DESC NULLS LAST;

\echo '--- 7. Dashboard credit total vs credit section total (must be identical)'
SELECT (SELECT total_outstanding FROM v_today_credit_activity) AS dashboard_total,
       (SELECT COALESCE(SUM(current_balance), 0) FROM credit_customers_outstanding) AS credit_section_total;

-- ---------------------------------------------------------------------
-- OPTIONAL REPAIR for check 4 - review the rows above first, then run
-- inside a transaction:
--
-- BEGIN;
-- WITH net AS (
--   SELECT op.order_id, SUM(op.amount - COALESCE(r.refunded,0)) AS net_paid
--   FROM order_payments op
--   LEFT JOIN (SELECT payment_id, SUM(refund_amount) refunded FROM order_refunds
--              WHERE payment_id IS NOT NULL GROUP BY payment_id) r ON r.payment_id = op.id
--   WHERE op.status = 'completed' GROUP BY op.order_id
-- )
-- UPDATE orders o
-- SET paid_amount    = LEAST(n.net_paid, o.total_amount),
--     balance_amount = GREATEST(o.total_amount - n.net_paid, 0),
--     payment_status = (CASE WHEN n.net_paid <= 0 THEN 'unpaid'
--                            WHEN n.net_paid >= o.total_amount THEN 'paid'
--                            ELSE 'partial' END)::payment_status
-- FROM net n
-- WHERE n.order_id = o.id AND o.paid_amount <> n.net_paid;
-- -- inspect, then COMMIT; (or ROLLBACK;)
-- ---------------------------------------------------------------------
