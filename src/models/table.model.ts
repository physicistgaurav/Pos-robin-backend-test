import { query } from "../config/database";
import { Table, CreateTableDTO, UpdateTableDTO } from "../types/table.types";

export class TableModel {
  static async create(data: CreateTableDTO): Promise<Table> {
    const sql = `
        INSERT INTO tables (table_number, table_name, capacity, status, location, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `;
    const values = [
      data.table_number,
      data.table_name,
      data.capacity,
      data.status,
      data.location,
      data.is_active,
    ];
    const result = await query(sql, values);
    return result.rows[0];
  }

  static async findById(id: string): Promise<Table | null> {
    const sql = "SELECT * FROM tables WHERE id = $1";
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

    static async findByTableNumber(tableNumber: string): Promise<Table | null> {
    const sql = "SELECT * FROM tables WHERE table_number = $1";
    const result = await query(sql, [tableNumber]);
    return result.rows[0] || null;
  }

  static async findAll(params: { is_active?: boolean }): Promise<{
    tables: Table[];
    total: number;
  }> {
    const countSql = "SELECT COUNT(*) FROM tables where is_active = $1";
    const countResult = await query(countSql,[params.is_active]);
    const total = parseInt(countResult.rows[0].count, 10);

    const sql = `
      SELECT * FROM tables
      where is_active = $1
      ORDER BY table_number
      `;
      // LIMIT $1 OFFSET $2

    const result = await query(sql, [params.is_active]);
    return { tables: result.rows, total };
  }

  static async findAvailableTables(params: { limit: number; offset: number, is_active?: boolean }): Promise<{
    tables: Table[];
    total: number;
  }> {
    const countSql = "SELECT COUNT(*) FROM tables where is_active = $1 and status = $2";
    const countResult = await query(countSql,[params.is_active, 'available']);
    const total = parseInt(countResult.rows[0].count, 10);

    const sql = `
      SELECT * FROM tables
      where is_active = $3
      and status = $4
      ORDER BY table_number
      LIMIT $1 OFFSET $2
    `;

    const result = await query(sql, [params.limit, params.offset, params.is_active, 'available']);
    return { tables: result.rows, total };
  }

  static async update(id: string, data: UpdateTableDTO): Promise<Table | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${++paramCount}`);
        values.push(value);
      }
    });

    //     If data is:

    // {
    //   name: "Corner Table",
    //   capacity: 4,
    //   status: undefined
    // }

    //     After the loop:

    // fields = [
    //   "name = $1",
    //   "capacity = $2"
    // ]

    // values = [
    //   "Corner Table",
    //   4
    // ]

    // paramCount = 2

    // nothing to update
    if (fields.length === 0) return this.findById(id);

    const sql = `
      UPDATE tables
      SET ${fields.join(", ")}
      WHERE id = $${++paramCount}
      RETURNING *
    `;

    // how it looks
    // UPDATE tables
    // SET name = $1, capacity = $2
    // WHERE id = $3
    // RETURNING *

    values.push(id);

    const result = await query(sql, values);
    return result.rows[0] || null;
  }

  static async deactivate(id: string): Promise<boolean> {
    const sql = "UPDATE tables SET is_active = $1 WHERE id = $2";
    const result = await query(sql, [false,id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  static async reactivate(id: string): Promise<boolean> {
    const sql = "UPDATE tables SET is_active = $1 WHERE id = $2";
    const result = await query(sql, [true,id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  static async delete(id: string): Promise<boolean> {
    const sql = "DELETE FROM tables WHERE id = $1";
    const result = await query(sql, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }
}
