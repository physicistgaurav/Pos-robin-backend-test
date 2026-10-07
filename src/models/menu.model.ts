import { query } from "../config/database";
import {
  MenuItem,
  CreateMenuItemDTO,
  UpdateMenuItemDTO,
  MenuQueryParams,
} from "../types/menu.types";

export class MenuModel {
  static async create(data: CreateMenuItemDTO): Promise<MenuItem> {
    const sql = `
      INSERT INTO menu_items (name, description, category, price, image_url, is_available, preparation_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      data.name,
      data.description || null,
      data.category,
      data.price,
      data.image_url || null,
      data.is_available ?? true,
      data.preparation_time || 15,
    ];

    const result = await query(sql, values);
    return result.rows[0];
  }

  static async findById(id: number): Promise<MenuItem | null> {
    const sql = "SELECT * FROM menu_items WHERE id = $1";
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

  static async findAll(
    params: MenuQueryParams & { limit: number; offset: number }
  ): Promise<{ items: MenuItem[]; total: number }> {
    let conditions: string[] = [];
    let values: any[] = [];
    let paramCount = 0;

    if (params.category) {
      conditions.push(`category = $${++paramCount}`);
      values.push(params.category);
    }

    if (params.is_available !== undefined) {
      conditions.push(`is_available = $${++paramCount}`);
      values.push(params.is_available);
    }

    if (params.min_price !== undefined) {
      conditions.push(`price >= $${++paramCount}`);
      values.push(params.min_price);
    }

    if (params.max_price !== undefined) {
      conditions.push(`price <= $${++paramCount}`);
      values.push(params.max_price);
    }

    if (params.search) {
      conditions.push(
        `(name ILIKE $${++paramCount} OR description ILIKE $${paramCount})`
      );
      values.push(`%${params.search}%`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countSql = `SELECT COUNT(*) FROM menu_items ${whereClause}`;
    const countResult = await query(countSql, values);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated items
    const sql = `
      SELECT * FROM menu_items
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    values.push(params.limit, params.offset);

    const result = await query(sql, values);
    return { items: result.rows, total };
  }

  static async update(
    id: number,
    data: UpdateMenuItemDTO
  ): Promise<MenuItem | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${++paramCount}`);
        values.push(value);
      }
    });

    if (fields.length === 0) return this.findById(id);

    const sql = `
      UPDATE menu_items
      SET ${fields.join(", ")}
      WHERE id = $${++paramCount}
      RETURNING *
    `;
    values.push(id);

    const result = await query(sql, values);
    return result.rows[0] || null;
  }

  static async delete(id: number): Promise<boolean> {
    const sql = "DELETE FROM menu_items WHERE id = $1";
    const result = await query(sql, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  static async findByIds(ids: number[]): Promise<MenuItem[]> {
    if (ids.length === 0) return [];
    const sql = "SELECT * FROM menu_items WHERE id = ANY($1)";
    const result = await query(sql, [ids]);
    return result.rows;
  }
}
