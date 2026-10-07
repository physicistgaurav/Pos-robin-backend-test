import { PoolClient } from 'pg';
import { query } from '../config/database';

export interface CreditTransaction {
  id: string;
  credit_customer_id: string;
  order_id?: string;
  invoice_id?: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  payment_method?: string;
  transaction_id?: string;
  reference_number?: string;
  due_date?: Date;
  notes?: string;
  created_by?: string;
  transaction_date: Date;
  created_at: Date;
}

export class CreditTransactionModel {
  /**
   * Create transaction
   */
  static async create(data: {
    credit_customer_id: string;
    order_id?: string;
    invoice_id?: string;
    transaction_type: string;
    amount: number;
    // balance before and after may not be needed to be checked later
    balance_before?: number;
    balance_after?: number;
    payment_method?: string;
    transaction_id?: string;
    reference_number?: string;
    due_date?: string | null;
    notes?: string;
    created_by?: string;
  },
client?: PoolClient
): Promise<CreditTransaction> {
    const sql = `
      INSERT INTO credit_transactions (
        credit_customer_id,
        order_id,
        invoice_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        payment_method,
        transaction_id,
        reference_number,
        due_date,
        notes,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *;
    `;

    const values = [
      data.credit_customer_id,
      data.order_id || null,
      data.invoice_id || null,
      data.transaction_type,
      data.amount,
      data.balance_before,
      data.balance_after,
      data.payment_method || null,
      data.transaction_id || null,
      data.reference_number || null,
      data.due_date || null,
      data.notes || null,
      data.created_by || null,
    ];

    const executor = client ?? { query: query as typeof query };

    const result = await executor.query(sql, values);
    return result.rows[0] as CreditTransaction;
  }

  /**
   * Find by customer ID
   */
  static async findByCustomerId(
    customerId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<CreditTransaction[]> {
    const sql = `
      SELECT 
        ct.*,
        o.order_number,
        ir.invoice_number,
        u.full_name AS created_by_name
      FROM credit_transactions ct
      LEFT JOIN orders o ON ct.order_id = o.id
      LEFT JOIN invoice_records ir ON ct.invoice_id = ir.id
      LEFT JOIN users u ON ct.created_by = u.id
      WHERE ct.credit_customer_id = $1
      ORDER BY ct.transaction_date DESC
      ${options?.limit ? `LIMIT $2` : ''}
      ${options?.offset ? `OFFSET $3` : ''};
    `;

    const values: string[] = [customerId];
    if (options?.limit !== undefined) values.push(options.limit.toString());
    if (options?.offset !== undefined) values.push(options.offset.toString());

    const result = await query(sql, values);
    return result.rows as CreditTransaction[];
  }

  /**
   * Get statement
   */
  static async getStatement(
    customerId: string,
    filters: { start_date?: string; end_date?: string }
  ): Promise<CreditTransaction[]> {
    const conditions = ['ct.credit_customer_id = $1'];
    const values: any[] = [customerId];
    let paramCount = 1;

    if (filters.start_date) {
      paramCount++;
      conditions.push(`ct.transaction_date >= $${paramCount}`);
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      paramCount++;
      conditions.push(`ct.transaction_date <= $${paramCount}`);
      values.push(filters.end_date);
    }

    const sql = `
      SELECT 
        ct.*,
        o.order_number,
        ir.invoice_number,
        u.full_name AS created_by_name
      FROM credit_transactions ct
      LEFT JOIN orders o ON ct.order_id = o.id
      LEFT JOIN invoice_records ir ON ct.invoice_id = ir.id
      LEFT JOIN users u ON ct.created_by = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ct.transaction_date ASC, ct.created_at ASC;
    `;

    const result = await query(sql, values);
    return result.rows as CreditTransaction[];
  }

  /**
   * Get balance as of date
   */
  static async getBalanceAsOf(
    customerId: string,
    asOfDate: string
  ): Promise<number> {
    const sql = `
      SELECT COALESCE(SUM(
        CASE 
          WHEN transaction_type IN ('charge', 'opening_balance') THEN amount
          WHEN transaction_type IN ('payment', 'credit_note') THEN -amount
          WHEN transaction_type = 'adjustment' THEN amount
        END
      ), 0) as balance
      FROM credit_transactions
      WHERE credit_customer_id = $1
        AND transaction_date < $2;
    `;

    const result = await query(sql, [customerId, asOfDate]);
    return parseFloat(result.rows[0]?.balance || '0');
  }
}