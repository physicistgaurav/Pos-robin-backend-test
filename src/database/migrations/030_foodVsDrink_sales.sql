-- 030_foodVsDrink_sales.sql

DROP VIEW IF EXISTS v_food_drink_sales;

CREATE VIEW v_food_drink_sales AS
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