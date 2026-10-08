import { query } from "../config/database";
import { User, RegisterDTO, UserResponse, UserRole } from "../types/auth.types";

export class UserModel {
  static async create(
    data: RegisterDTO & { password_hash: string }
  ): Promise<User> {
    const sql = `
      INSERT INTO users (email, password_hash, full_name, role, phone_number)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [
      data.email.toLowerCase(),
      data.password_hash,
      data.full_name,
      data.role || "staff",
      data.phone_number,
    ];

    const result = await query(sql, values);
    return result.rows[0];
  }

  static async findByEmail(email: string): Promise<User | null> {
    const sql = "SELECT * FROM users WHERE email = $1";
    const result = await query(sql, [email.toLowerCase()]);
    return result.rows[0] || null;
  }

  // First argument (sql): The SQL command string, containing the parameter placeholders ($1).

  // Second argument ([email.toLowerCase()]): An array of values that will safely replace the placeholders in the SQL string, in order.

  // What is $1 ? It is a placeholder for a prepared statement parameter.It is NOT a raw string concatenation or a simple variable.

  // The number $1 refers to the position of the variable in the array of values passed to the query function.
  // In your code,this array is [email.toLowerCase()].
  //  $1 maps to the first item: email.toLowerCase().
  //  $2 would map to the second item: [..., **second_value**].
  //  $3 would map to the third item: [..., ..., **third_value**], and so on.

  //
  //   Mapping:
  // $1 → email
  // $2 → true

  // Why is parameterization (using $\$1$) used instead of string concatenation?
  // This technique is crucial for Security and Performance.🛡️ Security (Prevents SQL Injection): This is the most important reason.
  //  The pg library automatically handles the placeholder by sanitizing and escaping the value.
  // If the user's email contained malicious SQL code (e.g., ' OR 1=1 --), it would be treated as a literal string value for the email column,
  //  not as executable code.
  // 🚀 Performance (Prepared Statements): The database can "prepare" or optimize the execution plan for the query with the placeholder,
  //  making subsequent calls slightly faster.
  // here, the dabase engine parses our sql query which is very expensive, but if we use $1, the parsing is skiped for another similar query and only
  // the data field is changed

  //   pg returns:

  // {
  //   rows: [],
  //   rowCount: number,
  //   fields: []
  // }

  static async findById(id: string): Promise<User | null> {
    const sql = "SELECT * FROM users WHERE id = $1";
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

  static async updateLastLogin(id: string): Promise<void> {
    const sql = "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1";
    await query(sql, [id]);
  }

  static async findAll(params: {
    limit: number;
    offset: number;
    role?: string;
    is_active?: boolean;
  }): Promise<{ users: UserResponse[]; total: number }> {
    let conditions: string[] = [];
    let values: any[] = [];
    let paramCount = 0;

    if (params.role) {
      conditions.push(`role = $${++paramCount}`);
      values.push(params.role);
    }

    if (params.is_active !== undefined) {
      conditions.push(`is_active = $${++paramCount}`);
      values.push(params.is_active);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countResult = await query(countSql, values);
    const total = parseInt(countResult.rows[0].count, 10);

    const sql = `
      SELECT id, email, full_name, role, is_active, last_login, phone_number, created_at
      FROM users
      ${whereClause}
      ORDER BY last_login ASC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    values.push(params.limit, params.offset);

    const result = await query(sql, values);
    return { users: result.rows, total };
  }

  static async update(
    id: string,
    data: Partial<Pick<User, "full_name" | "role" | "is_active" | "phone_number">>
  ): Promise<UserResponse | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    // prepare feilds and values to update
    //     fields = [
    //   "full_name = $1",
    //   "is_active = $2"
    //            ];

    // values = [
    //   "John",
    //   false
    //    ];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${++paramCount}`);
        values.push(value);
      }
    });

    // nothing to update, so just return sanitize user
    if (fields.length === 0) {
      const user = await this.findById(id);
      return user ? this.sanitizeUser(user) : null;
    }

    const sql = `
      UPDATE users
      SET ${fields.join(", ")}
      WHERE id = $${++paramCount}
      RETURNING id, email, full_name, role, is_active, last_login, created_at, phone_number
    `;
    values.push(id);

    const result = await query(sql, values);
    return result.rows[0] || null;
  }

  static async delete(id: string): Promise<boolean> {
    const sql = "DELETE FROM users WHERE id = $1";
    const result = await query(sql, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  static async deactivate(id: string): Promise<boolean> {
    const sql = "UPDATE users SET is_active =$1 WHERE id = $2";
    const result = await query(sql, [false, id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  static async reactivate(id: string): Promise<boolean> {
    const sql = "UPDATE users SET is_active =$1 WHERE id = $2";
    const result = await query(sql, [true, id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  // santize user by not sending password in userResponse
  static sanitizeUser(user: User): UserResponse {
    const { password_hash, ...sanitized } = user;
    return sanitized;
  }

  static async updatePassword(userId: string, password_hash: string) {
    const sql = `UPDATE users SET password_hash = $1 WHERE id = $2`;
    const result = await query(sql, [password_hash, userId]);

    return result.rows[0] || null;
  }

  static async updateUserRole(userId: string, role: UserRole) {
    const sql = `UPDATE users SET role = $1 WHERE id = $2`;

    const result = await query(sql, [role, userId]);

    return result.rows[0] || null;
  }

  static async countActiveAdminsExcluding(excludeUserId: string): Promise<number> {
    const result = await query(
      `SELECT COUNT(*)::int AS count FROM users
       WHERE role = 'admin' AND is_active = true AND id != $1`,
      [excludeUserId]
    );
    return result.rows[0].count;
  }
}
