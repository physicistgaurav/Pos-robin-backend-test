import { query } from "../config/database";

export class StoreTransactionModel {

  static async create(data: {
    type: string;
    category: string;
    amount: number;
    description?: string;
    payment_method?: string;
    reference_number?: string;
    party_name?: string;
    party_contact?: string;
    attachment_url?: string;
    notes?: string;
    transaction_date: Date;
    created_by: string;
  }) {
    const result = await query(`
      INSERT INTO store_transactions (
        type, category, amount, description,
        payment_method, reference_number,
        party_name, party_contact,
        attachment_url, notes,
        transaction_date, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [
      data.type, data.category, data.amount, data.description ?? null,
      data.payment_method ?? null, data.reference_number ?? null,
      data.party_name ?? null, data.party_contact ?? null,
      data.attachment_url ?? null, data.notes ?? null,
      data.transaction_date, data.created_by,
    ]);
    return result.rows[0];
  }

  static async findById(id: string) {
    const result = await query(`
      SELECT st.*, u.full_name AS created_by_name
      FROM store_transactions st
      LEFT JOIN users u ON st.created_by = u.id
      WHERE st.id = $1
    `, [id]);
    return result.rows[0] ?? null;
  }

  static async findAll(filters: {
    type?: string;
    category?: string;
    from_date?: string;
    to_date?: string;
    payment_method?: string;
    page: number;
    limit: number;
  }) {
    const offset = (filters.page - 1) * filters.limit;
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (filters.type) { conditions.push(`st.type = $${paramIdx++}`); values.push(filters.type); }
    if (filters.category) { conditions.push(`st.category = $${paramIdx++}`); values.push(filters.category); }
    if (filters.from_date) { conditions.push(`st.transaction_date >= $${paramIdx++}`); values.push(filters.from_date); }
    if (filters.to_date) { conditions.push(`st.transaction_date <= $${paramIdx++}`); values.push(filters.to_date); }
    if (filters.payment_method) { conditions.push(`st.payment_method = $${paramIdx++}`); values.push(filters.payment_method); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(filters.limit, offset);

    const result = await query(`
      SELECT
        st.*,
        u.full_name AS created_by_name,
        COUNT(*) OVER() AS total_count
      FROM store_transactions st
      LEFT JOIN users u ON st.created_by = u.id
      ${where}
      ORDER BY st.transaction_date DESC
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

  static async update(id: string, data: Partial<{
    description: string;
    payment_method: string;
    reference_number: string;
    party_name: string;
    party_contact: string;
    attachment_url: string;
    notes: string;
    transaction_date: Date;
  }>) {
    const fields = Object.keys(data).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = [id, ...Object.values(data)];

    const result = await query(`
      UPDATE store_transactions
      SET ${fields}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, values);
    return result.rows[0] ?? null;
  }

  static async delete(id: string) {
    const result = await query(`
      DELETE FROM store_transactions WHERE id = $1 RETURNING id
    `, [id]);
    return result.rows[0] ?? null;
  }

  static async getSummary(filters: { from_date?: string; to_date?: string }) {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (filters.from_date) { conditions.push(`transaction_date >= $${paramIdx++}`); values.push(filters.from_date); }
    if (filters.to_date) { conditions.push(`transaction_date <= $${paramIdx++}`); values.push(filters.to_date); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(`
      SELECT
        type, category,
        COUNT(*) AS transaction_count,
        SUM(amount) AS total_amount
      FROM store_transactions
      ${where}
      GROUP BY type, category
      ORDER BY type, total_amount DESC
    `, values);

    // Shape into { incoming: [...], outgoing: [...], totals: {} }
    const rows = result.rows;
    const incoming = rows.filter((r: any) => r.type === 'incoming');
    const outgoing = rows.filter((r: any) => r.type === 'outgoing');
    const totalIncoming = incoming.reduce((s: number, r: any) => s + parseFloat(r.total_amount), 0);
    const totalOutgoing = outgoing.reduce((s: number, r: any) => s + parseFloat(r.total_amount), 0);

    return {
      incoming,
      outgoing,
      totals: {
        total_income: totalIncoming,
        total_expense: totalOutgoing,
        net: totalIncoming - totalOutgoing,
      },
    };
  }

  static async getMonthlyPL() {
    const result = await query(`SELECT * FROM monthly_store_pl LIMIT 24`);
    return result.rows;
  }
}