import { PoolClient } from "pg";
import { pool, query } from "../config/database";

export class InventoryModel {

  static async toggleTracking(productId: string, data: {
    is_inventory_tracked: boolean;
    stock_unit?: string;
    low_stock_threshold?: number;
    reorder_quantity?: number;
  }) {
    // Update product flags
    await query(`
      UPDATE products SET
        is_inventory_tracked = $1,
        stock_unit = $2,
        low_stock_threshold = $3,
        reorder_quantity = $4,
        updated_at = NOW()
      WHERE id = $5
    `, [
      data.is_inventory_tracked,
      data.stock_unit ?? null,
      data.low_stock_threshold ?? 0,
      data.reorder_quantity ?? 0,
      productId,
    ]);

    if (data.is_inventory_tracked) {
      // Upsert inventory_stock row (idempotent)
      await query(`
        INSERT INTO inventory_stock (product_id)
        VALUES ($1)
        ON CONFLICT (product_id) DO NOTHING
      `, [productId]);
    }

    return this.getStockByProductId(productId);
  }

  static async getTrackedProducts(filters: {
    stock_status?: string;
    page: number;
    limit: number;
  }) {
    const offset = (filters.page - 1) * filters.limit;

    let statusFilter = '';
    if (filters.stock_status === 'out_of_stock') {
      statusFilter = `AND s.current_stock = 0`;
    } else if (filters.stock_status === 'low_stock') {
      statusFilter = `AND s.current_stock > 0 AND s.current_stock <= p.low_stock_threshold`;
    } else if (filters.stock_status === 'ok') {
      statusFilter = `AND s.current_stock > p.low_stock_threshold`;
    }

    const sql = `
      SELECT
        p.id, p.name, p.slug, p.selling_price, p.status,
        p.stock_unit, p.low_stock_threshold, p.reorder_quantity,
        s.current_stock, s.available_stock, s.average_cost_price,
        s.last_purchase_price, s.last_restocked_at, s.last_movement_at,
        CASE
          WHEN s.current_stock = 0 THEN 'out_of_stock'
          WHEN s.current_stock <= p.low_stock_threshold THEN 'low_stock'
          ELSE 'ok'
        END AS stock_status,
        COUNT(*) OVER() AS total_count
      FROM products p
      JOIN inventory_stock s ON p.id = s.product_id
      WHERE p.is_inventory_tracked = TRUE
      ${statusFilter}
      ORDER BY p.name ASC
      LIMIT $1 OFFSET $2
    `;

    const result = await query(sql, [filters.limit, offset]);
    return {
      data: result.rows,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: result.rows[0]?.total_count ?? 0,
      },
    };
  }

  
  static async getStockByProductId(productId: string): Promise<any>;
  static async getStockByProductId(client: PoolClient, productId: string): Promise<any>;
  
  static async getStockByProductId(
    clientOrId: PoolClient | string,
    productId?: string
  ) {
    const isClient = typeof clientOrId !== "string";
    const id = isClient ? productId! : (clientOrId as string);
    const querier = isClient
      ? (sql: string, params?: any[]) => (clientOrId as PoolClient).query(sql, params)
      : (sql: string, params?: any[]) => pool.query(sql, params);
  
    const result = await querier(`
      SELECT
        p.id, p.name, p.stock_unit, p.low_stock_threshold, p.reorder_quantity,
        s.*,
        CASE
          WHEN s.current_stock = 0 THEN 'out_of_stock'
          WHEN s.current_stock <= p.low_stock_threshold THEN 'low_stock'
          ELSE 'ok'
        END AS stock_status
      FROM products p
      JOIN inventory_stock s ON p.id = s.product_id
      WHERE p.id = $1
    `, [id]);
  
    return result.rows[0] ?? null;
  }

  static async createMovement(data: {
    product_id: string;
    movement_type: string;
    quantity: number;
    unit_cost?: number | null;
    total_cost?: number | null;
    order_id?: string | null;
    order_item_id?: string | null;
    store_txn_id?: string | null;
    supplier_name?: string | null;
    supplier_invoice?: string | null;
    reason?: string | null;
    notes?: string | null;
    created_by: string;
  }, client?: PoolClient) {
    // Verify product is tracked
    const stock = client
      ? (await client.query(`SELECT * FROM inventory_stock WHERE product_id = $1`, [data.product_id])).rows[0]
      : await this.getStockByProductId(data.product_id);
    if (!stock) throw new Error('Product not found in inventory');

    const executor = client ?? { query: query as typeof query };
    const result = await executor.query(`
      INSERT INTO stock_movements (
        product_id, movement_type, quantity, unit_cost, total_cost,
        order_id, order_item_id, store_txn_id,
        supplier_name, supplier_invoice,
        reason, notes, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
      data.product_id,
      data.movement_type,
      data.quantity,
      data.unit_cost ?? null,
      data.total_cost ?? (data.unit_cost ? data.quantity * data.unit_cost : null),
      data.order_id ?? null,
      data.order_item_id ?? null,
      data.store_txn_id ?? null,
      data.supplier_name ?? null,
      data.supplier_invoice ?? null,
      data.reason ?? null,
      data.notes ?? null,
      data.created_by,
    ]);

    return result.rows[0];
  }

  static async getMovements(productId: string, filters: {
    movement_type?: string;
    from_date?: string;
    to_date?: string;
    page: number;
    limit: number;
  }) {
    const offset = (filters.page - 1) * filters.limit;
    const conditions: string[] = ['sm.product_id = $1'];
    const values: any[] = [productId];
    let paramIdx = 2;

    if (filters.movement_type) {
      conditions.push(`sm.movement_type = $${paramIdx++}`);
      values.push(filters.movement_type);
    }
    if (filters.from_date) {
      conditions.push(`sm.created_at >= $${paramIdx++}`);
      values.push(filters.from_date);
    }
    if (filters.to_date) {
      conditions.push(`sm.created_at <= $${paramIdx++}`);
      values.push(filters.to_date);
    }

    values.push(filters.limit, offset);

    const result = await query(`
      SELECT
        sm.*,
        u.full_name AS created_by_name,
        COUNT(*) OVER() AS total_count
      FROM stock_movements sm
      LEFT JOIN users u ON sm.created_by = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY sm.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx}
    `, values);

    return {
      data: result.rows,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: result.rows[0]?.total_count ?? 0,
      },
    };
  }

  static async getLowStock() {
    const result = await query(`SELECT * FROM low_stock_products`);
    return result.rows;
  }
}