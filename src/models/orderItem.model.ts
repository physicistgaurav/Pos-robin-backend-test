import { PoolClient } from "pg";
import { query } from "../config/database";
import { OrderItem, OrderItemWithSnapshot } from "../types/order.types";

export class OrderItemModel {
  static async bulkCreate(
    client: any,
    orderId: string,
    items: OrderItemWithSnapshot[]
  ): Promise<void> {
    if (items.length === 0) return;

    // Build VALUES clause with correct parameter placeholders
    const values = items
      .map(
        (_, index) => `(
          gen_random_uuid(),
          $1,                     -- order_id (shared)
          $${index * 10 + 2},     -- product_id
          $${index * 10 + 3},     -- product_name
          $${index * 10 + 4},     -- product_price
          $${index * 10 + 5},     -- quantity
          $${index * 10 + 6},     -- variant_name
          $${index * 10 + 7},     -- customizations
          $${index * 10 + 8},     -- unit_price
          $${index * 10 + 9},     -- total_price (pre-calculated)
          $${index * 10 + 10},    -- special_instructions
          $${index * 10 + 11},    -- item_status
          NOW(),
          NOW()
        )`
      )
      .join(",");

    // Flatten parameters – one array per item, 10 values each
    const params = items.flatMap((item) => [
      item.product_id,
      item.product_name,
      item.product_price,
      item.quantity,
      item.variant_name ?? null,
      item.customizations ?? null,
      item.unit_price,
      item.total_price,               // ← pre-calculated in service
      item.special_instructions ?? null,
      item.item_status ?? "pending",
    ]);

    const sql = `
      INSERT INTO order_items (
        id,
        order_id,
        product_id,
        product_name,
        product_price,
        quantity,
        variant_name,
        customizations,
        unit_price,
        total_price,
        special_instructions,
        item_status,
        created_at,
        updated_at
      )
      VALUES ${values}
    `;

    await client.query(sql, [orderId, ...params]);
  }

  static async findByOrderId(orderId: string, client?: PoolClient): Promise<OrderItem[]> {
    const sql = `SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at ASC`;
    const result = client 
      ? await client.query(sql, [orderId])
      : await query(sql, [orderId]);
    return result.rows;
  }

  static async findById(client: any, itemId: string): Promise<OrderItemWithSnapshot | null> {
    const sql = `
      SELECT 
        id, order_id, product_id, product_name, product_price,
        unit_price, quantity, total_price,
        variant_name, customizations, special_instructions,
        item_status
      FROM order_items
      WHERE id = $1
    `;

    const result = await client.query(sql, [itemId]);
    return result.rows[0] || null;
  }

  static async update(
    client: any,
    itemId: string,
    data: {
      quantity?: number;
      special_instructions?: string | null;
      variant_name?: string | null;
      customizations?: string | null;
      total_price?: number;
      item_status?: string | null;
    }
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.quantity !== undefined) {
      fields.push(`quantity = $${paramIndex++}`);
      values.push(data.quantity);
    }
    if (data.special_instructions !== undefined) {
      fields.push(`special_instructions = $${paramIndex++}`);
      values.push(data.special_instructions);
    }
    if (data.variant_name !== undefined) {
      fields.push(`variant_name = $${paramIndex++}`);
      values.push(data.variant_name);
    }
    if (data.customizations !== undefined) {
      fields.push(`customizations = $${paramIndex++}`);
      values.push(data.customizations);
    }
    if (data.total_price !== undefined) {
      fields.push(`total_price = $${paramIndex++}`);
      values.push(data.total_price);
    }

    if (data.item_status !== undefined) {
      fields.push(`item_status = $${paramIndex++}`);
      values.push(data.item_status);
    }

    fields.push(`updated_at = NOW()`);

    const sql = `
      UPDATE order_items
      SET ${fields.join(", ")}
      WHERE id = $${paramIndex}
    `;

    values.push(itemId);

    await client.query(sql, values);
  }

  static async delete(client: any, itemId: string): Promise<void> {
    const sql = `DELETE FROM order_items WHERE id = $1`;
    const result = await client.query(sql, [itemId]);

    return result.rows[0] || null;
  }

}