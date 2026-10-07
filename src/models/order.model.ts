import { PoolClient } from "pg";
import { pool, query, transaction } from "../config/database";
import {
  Order,
  CreateOrderDTO,
  UpdateOrderDTO,
  OrderStatus,
} from "../types/order.types";

export class OrderModel {
  static async create(
    client: any,
    data: CreateOrderDTO,
    userId: string
  ): Promise<Order> {
    const sql = `
    INSERT INTO orders (
        order_type,
        table_id,
        customer_name,
        customer_phone,
        customer_email,
        delivery_address,
        delivery_instructions,
        special_instructions,
        kitchen_notes,
        tax_percentage,
        service_charge_percentage,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `;

    const result = await client.query(sql, [
      data.order_type,
      data.table_id ?? null,
      data.customer_name ?? null,
      data.customer_phone ?? null,
      data.customer_email ?? null,
      data.delivery_address ?? null,
      data.delivery_instructions ?? null,
      data.special_instructions ?? null,
      data.kitchen_notes ?? null,
      data.tax_percentage ?? 0,
      data.service_charge_percentage ?? 0,
      userId,
    ]);

    return result.rows[0];
  }

  static async findById(id: string): Promise<Order | null>;
  static async findById(client: PoolClient, id: string): Promise<Order | null>;

  static async findById(clientOrId: any, id?: string): Promise<Order | null> {
    // Determine orderId
    const orderId: string = id ?? (clientOrId as string);

    // Determine client: use passed client if provided and valid, else fallback to pool
    let client: { query: (sql: string, params?: any[]) => Promise<any> };
    if (id !== undefined) {
      // Two-argument call: first is client (may be undefined)
      client = clientOrId ?? {
        query: async (sql: string, params?: any[]) => pool.query(sql, params),
      };
    } else {
      // One-argument call: create fallback
      client = {
        query: async (sql: string, params?: any[]) => pool.query(sql, params),
      };
    }

    const sql = `
      SELECT
        orders.id,
        orders.order_number,
        orders.order_type,
        orders.table_id,

        COALESCE(tables.table_name, tables.table_number::text) AS table_name,
        COALESCE(tables.location, 'Unknown') As table_location,

        orders.customer_name,
        orders.customer_phone,
        orders.delivery_address,
        orders.status,

        orders.created_by,
        users.full_name AS full_name,

        orders.subtotal,
        orders.discount_amount,
        orders.total_amount,
        orders.payment_status,
        orders.paid_amount,
        orders.balance_amount,
        orders.order_time,

        COALESCE(
          json_agg(
            json_build_object(
              'id', order_items.id,
              'order_id', order_items.order_id,
              'product_id', order_items.product_id,
              'product_name', order_items.product_name,
              'product_price', order_items.product_price,
              'quantity', order_items.quantity,
              'item_status', order_items.item_status
            )
            ORDER BY order_items.ordered_at ASC 
          ) FILTER (WHERE order_items.id IS NOT NULL),
          '[]'
        ) AS order_items

      FROM orders

      LEFT JOIN tables ON orders.table_id = tables.id
      LEFT JOIN users ON orders.created_by = users.id
      LEFT JOIN order_items ON orders.id = order_items.order_id

      WHERE orders.id = $1

      GROUP BY
        orders.id,
        tables.table_name,
        tables.table_number,
        tables.location,
        users.full_name;
    `;

    const result = await client.query(sql, [orderId]);
    return result.rows[0] || null;
  }

  static async findByCustomerId(
    customerId: string,
    options: { limit: number; offset: number }
  ) {
    const { limit, offset } = options;
  
    const ordersQuery = `
      SELECT
        id,
        order_number,
        order_type,
        status,
        subtotal,
        discount_amount,
        tax_amount,
        service_charge_amount,
        total_amount,
        payment_status,
        paid_amount,
        balance_amount,
        order_time,
        created_at,
        updated_at
      FROM orders
      WHERE credit_customer_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
  
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM orders
      WHERE credit_customer_id = $1
    `;
  
    const [ordersResult, countResult] = await Promise.all([
      query(ordersQuery, [customerId, limit, offset]),
      query(countQuery, [customerId]),
    ]);
  
    return {
      orders: ordersResult.rows,
      total: countResult.rows[0].total,
    };
  }
  static async updateCreditCustomer(orderId: string, creditCustomerId: string): Promise<void> {
    const sql = `
      UPDATE orders 
      SET credit_customer_id = $1, updated_at = NOW()
      WHERE id = $2
    `;
    await query(sql, [creditCustomerId, orderId]);
  }

  static async findAll(params: {
    limit: number;
    offset: number;
    status?: string;
    table_id?: string;
    order_type?: string;
    payment_status?: string;
    delivery_status?: string;
    start_date?: Date;
    end_date?: Date;
  }): Promise<{ orders: Order[]; total: number }> {
    let conditions: string[] = [];
    let values: any[] = [];
    let paramCount = 0;

    if (params.status) {
      conditions.push(`orders.status = $${++paramCount}`);
      values.push(params.status);
    }

    if (params.table_id) {
      conditions.push(`orders.table_id = $${++paramCount}`);
      values.push(params.table_id);
    }

    if (params.order_type) {
      conditions.push(`orders.order_type = $${++paramCount}`);
      values.push(params.order_type);
    }

    if (params.payment_status) {
      conditions.push(`orders.payment_status = $${++paramCount}`);
      values.push(params.payment_status);
    }

    if (params.delivery_status) {
      conditions.push(`orders.delivery_status = $${++paramCount}`);
      values.push(params.delivery_status);
    }

    if (params.start_date) {
      conditions.push(`orders.created_at >= $${++paramCount}`);
      values.push(params.start_date);
    }

    if (params.end_date) {
      conditions.push(`orders.created_at <= $${++paramCount}`);
      values.push(params.end_date);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*) FROM orders ${whereClause}`;
    const countResult = await query(countSql, values);
    const total = parseInt(countResult.rows[0].count, 10);

    const sql = `
    SELECT
      orders.id,
      orders.order_number,
      orders.order_type,
      orders.table_id,
    
      COALESCE(tables.table_name, tables.table_number::text) AS table_name,
    
      orders.customer_name,
      orders.customer_phone,
      orders.delivery_address,
      orders.status,
    
      orders.created_by,
      users.full_name AS full_name,
    
      orders.subtotal,
      orders.discount_amount,
      orders.total_amount,
      orders.payment_status,
      orders.paid_amount,
      orders.balance_amount,
      orders.order_time,
    
      COALESCE(
        json_agg(
          json_build_object(
            'id', order_items.id,
            'order_id', order_items.order_id,
            'product_id', order_items.product_id,
            'product_name', order_items.product_name,
            'item_status', order_items.item_status
          )
        ) FILTER (WHERE order_items.id IS NOT NULL),
        '[]'
      ) AS order_items
    
    FROM orders
    
    LEFT JOIN tables
      ON orders.table_id = tables.id
    
    LEFT JOIN users
      ON orders.created_by = users.id
    
    LEFT JOIN order_items
      ON orders.id = order_items.order_id
    
    ${whereClause}
    
    GROUP BY
      orders.id,
      tables.table_name,
      tables.table_number,
      users.full_name
    
    ORDER BY orders.order_time DESC
    LIMIT $${++paramCount} OFFSET $${++paramCount};
    `;

    values.push(params.limit, params.offset);

    const result = await query(sql, values);
    return { orders: result.rows, total };
  }

  static async getRecentOrders(params: {
    limit: number;
    offset: number;
  }): Promise<{ orders: any[] }> {
    const sql = `
      SELECT
        o.id,
        o.order_number,
        o.order_type,
        o.table_id,
  
        COALESCE(t.table_name, t.table_number::text) AS table_name,
  
        -- 👤 CUSTOMER
        o.customer_name,
        o.customer_phone,
  
        -- 🧑‍🍳 STAFF
        u.full_name AS staff_name,
  
        o.status,
        o.payment_status,
  
        o.subtotal,
        o.discount_amount,
        o.total_amount,
  
        o.order_time,
  
        -- Additional useful fields
        o.completed_at,
        o.created_at,
        o.updated_at,
  
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'product_id', oi.product_id,
              'product_name', oi.product_name,
              'quantity', oi.quantity,
              'unit_price', oi.product_price,
              'total_price', oi.product_price * oi.quantity,
              'item_status', oi.item_status
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS order_items
  
      FROM orders o
  
      LEFT JOIN tables t
        ON o.table_id = t.id
  
      LEFT JOIN users u
        ON o.created_by = u.id
  
      LEFT JOIN order_items oi
        ON o.id = oi.order_id
  
      WHERE 
        -- Exclude cancelled orders completely
        o.status != 'cancelled'

        AND
        (
          -- 1. Orders that are NOT fully completed yet
          o.status != 'completed'
          
          OR 
          
          -- 2. Orders that are completed BUT still unpaid/partial
          (
            o.status = 'completed' 
            AND o.payment_status IN ('unpaid', 'partial')
          )
        )

        -- Only recent orders
        AND o.order_time >= NOW() - INTERVAL '48 hours'
  
      GROUP BY
        o.id,
        o.order_number,
        o.order_type,
        o.table_id,
        t.table_name,
        t.table_number,
        u.full_name,
        o.status,
        o.payment_status,
        o.subtotal,
        o.discount_amount,
        o.total_amount,
        o.order_time,
        o.completed_at,
        o.created_at,
        o.updated_at
  
      ORDER BY 
        -- Prioritize active orders first, then recently completed unpaid ones
        CASE 
          WHEN o.status != 'completed' THEN 1
          ELSE 2 
        END,
        o.order_time DESC,
        o.updated_at DESC   -- More recent updates first (important for re-open scenario)
  
      LIMIT $1 OFFSET $2;
    `;
  
    const result = await query(sql, [params.limit, params.offset]);
  
    return { orders: result.rows };
  }


  static async searchOrders(params: {
    q?: string;
    status?: string;
    payment_status?: string;
    order_type?: string;
    from_date?: string;
    to_date?: string;
    offset: number;
    limit: number;
  }) {
    let whereClauses: string[] = [];
    let values: any[] = [];
    let paramIndex = 1;

    if (params.q) {
      whereClauses.push(`
        (
          orders.order_number ILIKE $${paramIndex} OR
          orders.customer_phone ILIKE $${paramIndex} OR
          orders.customer_name ILIKE $${paramIndex}
        )
      `);
      values.push(`%${params.q}%`);
      paramIndex++;
    }
    
    if (params.status) {
      whereClauses.push(`orders.status = $${paramIndex}`);
      values.push(params.status);
      paramIndex++;
    }
    
    if (params.payment_status) {
      whereClauses.push(`orders.payment_status = $${paramIndex}`);
      values.push(params.payment_status);
      paramIndex++;
    }
    
    if (params.order_type) {
      whereClauses.push(`orders.order_type = $${paramIndex}`);
      values.push(params.order_type);
      paramIndex++;
    }
    
    if (params.from_date) {
      whereClauses.push(`DATE(orders.order_time) >= $${paramIndex}`);
      values.push(params.from_date);
      paramIndex++;
    }
    
    if (params.to_date) {
      whereClauses.push(`DATE(orders.order_time) <= $${paramIndex}`);
      values.push(params.to_date);
      paramIndex++;
    }

    const whereSql =
      whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

    // Count query
    const countSql = `SELECT COUNT(*) FROM orders ${whereSql}`;
    const countResult = await query(countSql, values);
    const total = parseInt(countResult.rows[0].count, 10);

    // Data query (reuse your existing detailed SELECT with items)
    const dataSql = `
      SELECT
      orders.id,
      orders.order_number,
      orders.order_type,
      orders.table_id,
    
      COALESCE(tables.table_name, tables.table_number::text) AS table_name,
    
      orders.customer_name,
      orders.customer_phone,
      orders.delivery_address,
      orders.status,
    
      orders.created_by,
      users.full_name AS full_name,
    
      orders.subtotal,
      orders.discount_amount,
      orders.total_amount,
      orders.payment_status,
      orders.paid_amount,
      orders.balance_amount,
      orders.order_time,
    
      COALESCE(
        json_agg(
          json_build_object(
            'id', order_items.id,
            'order_id', order_items.order_id,
            'product_id', order_items.product_id,
            'product_name', order_items.product_name,
            'item_status', order_items.item_status
          )
        ) FILTER (WHERE order_items.id IS NOT NULL),
        '[]'
      ) AS order_items
    
    FROM orders
      LEFT JOIN tables ON orders.table_id = tables.id
      LEFT JOIN users ON orders.created_by = users.id
      LEFT JOIN order_items ON orders.id = order_items.order_id
      ${whereSql}
      GROUP BY orders.id, tables.table_name, tables.table_number, users.full_name
      ORDER BY orders.order_time DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    values.push(params.limit, params.offset);

    const dataResult = await query(dataSql, values);

    return { orders: dataResult.rows, total };
  }

  static async findActiveOrders(params: {
    limit: number;
    offset: number;
  }): Promise<{ orders: Order[]; total: number }> {
    const activeStatuses: OrderStatus[] = [
      "pending",
      "confirmed",
      "preparing",
      // 'ready',
      // 'served',
    ];

    let paramCount = 0;
    const values: any[] = [];

    const countSql = `
      SELECT COUNT(*) 
      FROM orders 
      WHERE status = ANY($1)
    `;
    values.push(activeStatuses);
    paramCount++;

    const countResult = await query(countSql, values);
    const total = parseInt(countResult.rows[0].count, 10);

    const sql = `
      SELECT
        orders.id,
        orders.order_number,
        orders.order_type,
        orders.table_id,
  
        COALESCE(tables.table_name, tables.table_number::text) AS table_name,
  
        orders.customer_name,
        orders.customer_phone,
        orders.delivery_address,
        orders.status,
  
        orders.created_by,
        users.full_name AS created_by_name,
  
        orders.subtotal,
        orders.discount_amount,
        orders.tax_amount,
        orders.service_charge_amount,
        orders.total_amount,
        orders.payment_status,
        orders.paid_amount,
        orders.balance_amount,
        orders.order_time,
  
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'product_id', oi.product_id,
              'product_name', oi.product_name,
              'quantity', oi.quantity,
              'unit_price', oi.unit_price,
              'total_price', oi.total_price,
              'item_status', oi.item_status,
              'special_instructions', oi.special_instructions,
              'variant_name', oi.variant_name,
              'customizations', oi.customizations
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS order_items
  
      FROM orders
  
      LEFT JOIN tables ON orders.table_id = tables.id
      LEFT JOIN users ON orders.created_by = users.id
      LEFT JOIN order_items oi ON orders.id = oi.order_id
  
      WHERE orders.status = ANY($1)
  
      GROUP BY
        orders.id,
        tables.table_name,
        tables.table_number,
        users.full_name
  
      ORDER BY orders.order_time DESC  -- Most recent first
  
      LIMIT $2 OFFSET $3;
    `;

    const result = await query(sql, [
      activeStatuses,
      params.limit,
      params.offset,
    ]);

    return {
      orders: result.rows as Order[],
      total,
    };
  }

  static async getKitchenOrders(params: {
    limit: number;
    offset: number;
  }): Promise<{ orders: any[]; total: number }> {
    const countSql = `
    SELECT COUNT(DISTINCT order_id) AS total
    FROM kitchen_orders_view
  `;

    const countResult = await query(countSql);
    const total = parseInt(countResult.rows[0].total, 10) || 0;

    const dataSql = `
  SELECT 
    kov.order_id,
    kov.order_number,
    kov.order_type,
    kov.table_number,
    kov.table_name,

    json_agg(
      json_build_object(
        'item_id', kov.item_id,
        'product_name', kov.product_name,
        'quantity', kov.quantity,
        'item_status', kov.item_status,
        'special_instructions', kov.special_instructions,
        'customizations', kov.customizations,
        'ordered_at', kov.ordered_at,
        'minutes_waiting', kov.minutes_waiting,

        'image', p.image_url
      )
      ORDER BY kov.ordered_at ASC
    ) AS items

  FROM kitchen_orders_view kov

  LEFT JOIN products p 
    ON p.name = kov.product_name   -- OR better: p.id = kov.product_id

  GROUP BY 
    kov.order_id,
    kov.order_number,
    kov.order_type,
    kov.table_number,
    kov.table_name

  ORDER BY MIN(kov.ordered_at) ASC

  LIMIT $1 OFFSET $2;
`;

    const dataResult = await query(dataSql, [params.limit, params.offset]);
    const orders = dataResult.rows;
    return { orders, total };
  }

  static async getBarOrder(params: {
    limit: number;
    offset: number;
  }): Promise<{ orders: any[]; total: number }> {
    const countSql = `
    SELECT COUNT(DISTINCT order_id) AS total
    FROM bar_orders_view
  `;

    const countResult = await query(countSql);
    const total = parseInt(countResult.rows[0].total, 10) || 0;

    const dataSql = `
      SELECT 
        order_id,
        order_number,
        order_type,
        table_number,
        table_name,
        json_agg(
          json_build_object(
            'item_id', item_id,
            'product_name', product_name,
            'quantity', quantity,
            'item_status', item_status,
            'special_instructions', special_instructions,
            'customizations', customizations,
            'ordered_at', ordered_at,
            'minutes_waiting', minutes_waiting
          )
          ORDER BY ordered_at ASC
        ) AS items
      FROM bar_orders_view
      GROUP BY order_id, order_number, order_type, table_number, table_name
      ORDER BY MIN(ordered_at) ASC
      LIMIT $1 OFFSET $2;
    `;

    const dataResult = await query(dataSql, [params.limit, params.offset]);
    const orders = dataResult.rows;
    return { orders, total };
  }

  static async update(id: string, data: UpdateOrderDTO,  client?: PoolClient) {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 0;

    const push = (field: string, value: any) => {
      fields.push(`${field} = $${++i}`);
      values.push(value);
    };

    if (data.status) push("status", data.status);

    if (data.order_type) push("order_type", data.order_type);
    if (data.payment_status) push("payment_status", data.payment_status);

    if ("table_id" in data) push("table_id", data.table_id);
    if ("served_by" in data) push("served_by", data.served_by);

    if (data.customer_name) push("customer_name", data.customer_name);
    if (data.customer_phone) push("customer_phone", data.customer_phone);
    if (data.customer_email) push("customer_email", data.customer_email);

    if (data.delivery_address) push("delivery_address", data.delivery_address);
    if (data.delivery_instructions)
      push("delivery_instructions", data.delivery_instructions);

    if (data.special_instructions)
      push("special_instructions", data.special_instructions);
    if (data.kitchen_notes) push("kitchen_notes", data.kitchen_notes);

    if (data.estimated_prep_time)
      push("estimated_prep_time", data.estimated_prep_time);

    if (data.estimated_delivery_time)
      push("estimated_delivery_time", data.estimated_delivery_time);

    if (data.cancellation_reason)
      push("cancellation_reason", data.cancellation_reason);

    if (fields.length === 0) {
      return await this.findById(id);
    }

    const sql = `
      UPDATE orders
      SET ${fields.join(", ")}
      WHERE id = $${++i}
      RETURNING *
    `;

    values.push(id);

    const result = client
    ? await client.query(sql, values)
    : await query(sql, values);
    return result.rows[0] || null;
  }

  static async updateDiscount(
    client: any,
    orderId: string,
    data: {
      discount_type: string;
      discount_value: number;
      discount_reason: string;
    }
  ) {
    const sql = `
      UPDATE orders
      SET discount_type = $1,
          discount_value = $2,
          discount_reason = $3,
          updated_at = NOW()
      WHERE id = $4
    `;
    await client.query(sql, [
      data.discount_type,
      data.discount_value,
      data.discount_reason,
      orderId,
    ]);
  }

  static async cancel(client: any, id: string, reason: string): Promise<boolean>;
  static async cancel(id: string, reason: string): Promise<boolean>;
  static async cancel(clientOrId: any, idOrReason: string, reason?: string): Promise<boolean> {
    const isClient = typeof clientOrId !== 'string';
    const client = isClient ? clientOrId : null;
    const id = isClient ? idOrReason : clientOrId;
    const cancelReason = isClient ? reason : idOrReason;

    const sql = `UPDATE orders
    SET
      status = 'cancelled',
      cancellation_reason = $1
    WHERE id = $2
    RETURNING *
    `;
    const executor = client ?? { query: query as typeof query };
    const result = await executor.query(sql, [cancelReason, id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  static async complete(id: string): Promise<Order | null> {
    return transaction(async (client) => {
      await client.query(
        `UPDATE order_items 
         SET item_status = 'completed', updated_at = NOW() 
         WHERE order_id = $1`,
        [id]
      );
  
      const result = await client.query(
        `UPDATE orders SET status = 'completed' WHERE id = $1 RETURNING *`,
        [id]
      );
  
      return result.rows[0] || null;
    });
  }

  static async serve(id: string): Promise<Order | null> {
    const sql = `UPDATE orders 
    SET
      status = 'served'
    WHERE id = $1
    RETURNING *
    `;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

  static async updateStatus(client: any, orderId: string, status: OrderStatus): Promise<void> {
    await client.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, orderId]
    );
  }

  // static async delete(id: number): Promise<boolean> {
  //   const sql = "DELETE FROM orders WHERE id = $1";
  //   const result = await query(sql, [id]);
  //   return result.rowCount !== null && result.rowCount > 0;
  // }
}
