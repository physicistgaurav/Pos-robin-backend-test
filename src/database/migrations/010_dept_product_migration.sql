ALTER TABLE products 
ADD COLUMN department VARCHAR(10) 
CHECK (department IN ('kitchen', 'bar')) 
NOT NULL DEFAULT 'kitchen';

CREATE INDEX idx_products_department ON products(department);

CREATE INDEX idx_order_items_product_id ON order_items(product_id);

CREATE OR REPLACE VIEW kitchen_orders_view AS
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

    ROUND(EXTRACT(EPOCH FROM (NOW() - oi.ordered_at))/60, 1) AS minutes_waiting

FROM orders o
LEFT JOIN tables t ON o.table_id = t.id
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id

WHERE 
    o.status IN ('pending', 'confirmed', 'preparing')
    AND oi.item_status IN ('pending', 'confirmed', 'preparing')
    AND p.department = 'kitchen'

ORDER BY oi.ordered_at ASC;


CREATE OR REPLACE VIEW bar_orders_view AS
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

    ROUND(EXTRACT(EPOCH FROM (NOW() - oi.ordered_at))/60, 1) AS minutes_waiting

FROM orders o
LEFT JOIN tables t ON o.table_id = t.id
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id

WHERE 
    o.status IN ('pending', 'confirmed', 'preparing')
    AND oi.item_status IN ('pending', 'confirmed', 'preparing')
    AND p.department = 'bar'

ORDER BY oi.ordered_at ASC;