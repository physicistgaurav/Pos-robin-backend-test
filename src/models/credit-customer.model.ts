import { PoolClient } from 'pg';
import { query } from '../config/database';

export interface CreditCustomer {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  company_name?: string;
  company_registration?: string;
  pan_number?: string;
  billing_address?: string;
  credit_limit: number;
  current_balance: number;
  available_credit: number;
  payment_terms_days: number;
  status: string;
  contact_person?: string;
  contact_phone?: string;
  notes?: string;
  internal_notes?: string;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export class CreditCustomerModel {
  /**
   * Create credit customer
   */
  static async create(data: any): Promise<CreditCustomer> {
    const sql = `
      INSERT INTO credit_customers (
        customer_name,
        customer_phone,
        customer_email,
        company_name,
        company_registration,
        pan_number,
        billing_address,
        credit_limit,
        payment_terms_days,
        contact_person,
        contact_phone,
        notes,
        internal_notes,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *;
    `;

    const values = [
      data.customer_name,
      data.customer_phone,
      data.customer_email || null,
      data.company_name || null,
      data.company_registration || null,
      data.pan_number || null,
      data.billing_address || null,
      data.credit_limit,
      data.payment_terms_days || 30,
      data.contact_person || null,
      data.contact_phone || null,
      data.notes || null,
      data.internal_notes || null,
      data.created_by,
    ];

    const result = await query(sql, values);
    return result.rows[0] as CreditCustomer;
  }

  /**
   * Find by ID
   */
  static async findById(customerId: string, client?: PoolClient): Promise<CreditCustomer | null> {
    const sql = `
      SELECT 
        cc.*,
        u.full_name AS created_by_name
      FROM credit_customers cc
      LEFT JOIN users u ON cc.created_by = u.id
      WHERE cc.id = $1;
    `;

    const executor = client ?? { query: query as typeof query };

    const result = await executor.query(sql, [customerId]);
    return result.rows[0] || null;
  }

  /**
   * Find by phone
   */
  static async findByPhone(phone: string): Promise<CreditCustomer | null> {
    const sql = `
      SELECT * FROM credit_customers
      WHERE customer_phone = $1;
    `;

    const result = await query(sql, [phone]);
    return result.rows[0] || null;
  }

  /**
   * Find all with filters
   */
  static async findAll(params: {
    status?: string;
    search?: string;
    has_balance?: boolean;
    limit: number;
    offset: number;
  }): Promise<{ customers: CreditCustomer[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    // Status filter
    if (params.status) {
      paramCount++;
      conditions.push(`status = $${paramCount}`);
      values.push(params.status);
    }

    // Search filter
    if (params.search) {
      paramCount++;
      conditions.push(`(
        customer_name ILIKE $${paramCount} OR
        company_name ILIKE $${paramCount} OR
        customer_phone ILIKE $${paramCount}
      )`);
      values.push(`%${params.search}%`);
    }

    // Has balance filter
    if (params.has_balance !== undefined) {
      if (params.has_balance) {
        conditions.push(`current_balance > 0`);
      } else {
        conditions.push(`current_balance = 0`);
      }
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Count total
    const countSql = `
      SELECT COUNT(*) FROM credit_customers
      ${whereClause};
    `;

    const countResult = await query(countSql, values);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get customers
    paramCount++;
    const limitParam = paramCount;
    paramCount++;
    const offsetParam = paramCount;

    const sql = `
      SELECT 
        cc.*,
        u.full_name AS created_by_name,
        COUNT(DISTINCT o.id) as total_orders,
        SUM(CASE WHEN o.status = 'completed' THEN o.total_amount ELSE 0 END) as total_sales
      FROM credit_customers cc
      LEFT JOIN users u ON cc.created_by = u.id
      LEFT JOIN orders o ON cc.id = o.credit_customer_id
      ${whereClause}
      GROUP BY cc.id, u.full_name
      ORDER BY cc.current_balance DESC, cc.customer_name ASC
      LIMIT $${limitParam} OFFSET $${offsetParam};
    `;

    values.push(params.limit, params.offset);

    const result = await query(sql, values);

    return {
      customers: result.rows as CreditCustomer[],
      total,
    };
  }

  /**
   * Update credit customer
   */
  static async update(
    customerId: string,
    data: Partial<CreditCustomer>
  ): Promise<CreditCustomer> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    // Build dynamic update query
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id') {
        paramCount++;
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      return this.findById(customerId) as Promise<CreditCustomer>;
    }

    paramCount++;
    values.push(customerId);

    const sql = `
      UPDATE credit_customers
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *;
    `;

    const result = await query(sql, values);
    return result.rows[0] as CreditCustomer;
  }

  /**
   * Update status
   */
  static async updateStatus(
    customerId: string,
    status: string
  ): Promise<CreditCustomer> {
    const sql = `
      UPDATE credit_customers
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;

    const result = await query(sql, [status, customerId]);
    return result.rows[0] as CreditCustomer;
  }

  /**
   * Get customer stats
   */
  static async getCustomerStats(customerId: string) {
    const sql = `
      SELECT 
        COUNT(DISTINCT o.id) as total_orders,
        COUNT(DISTINCT o.id) FILTER (WHERE o.payment_status = 'unpaid') as unpaid_orders,
        SUM(o.total_amount) FILTER (WHERE o.status = 'completed') as total_sales,
        SUM(o.balance_amount) FILTER (WHERE o.payment_status IN ('unpaid', 'partial')) as outstanding_amount,
        MAX(o.order_time) as last_order_date,
        COUNT(DISTINCT ct.id) FILTER (WHERE ct.transaction_type = 'payment') as total_payments,
        SUM(ct.amount) FILTER (WHERE ct.transaction_type = 'payment') as total_paid
      FROM credit_customers cc
      LEFT JOIN orders o ON cc.id = o.credit_customer_id
      LEFT JOIN credit_transactions ct ON cc.id = ct.credit_customer_id
      WHERE cc.id = $1
      GROUP BY cc.id;
    `;

    const result = await query(sql, [customerId]);
    return result.rows[0] || {
      total_orders: 0,
      unpaid_orders: 0,
      total_sales: 0,
      outstanding_amount: 0,
      last_order_date: null,
      total_payments: 0,
      total_paid: 0,
    };
  }

  /**
   * Get outstanding customers
   */
  static async getOutstandingCustomers(): Promise<any[]> {
    const sql = `
      SELECT * FROM credit_customers_outstanding
      ORDER BY current_balance DESC;
    `;

    const result = await query(sql);
    return result.rows;
  }

  /**
   * Get aged receivables
   */
  static async getAgedReceivables(): Promise<any[]> {
    const sql = `
      SELECT * FROM aged_receivables
      ORDER BY total_outstanding DESC;
    `;

    const result = await query(sql);
    return result.rows;
  }
}