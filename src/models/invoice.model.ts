import { PoolClient } from "pg";
import { query } from "../config/database";

export type PaymentStatus = "unpaid" | "partial" | "paid";
export type InvoiceType = "tax_invoice" | "simplified_invoice" | "credit_note" | "proforma";

export interface Invoice {
    id: string;
    order_id: string;
    credit_customer_id?: string | null;
    invoice_number: string;
    fiscal_year: string;
    invoice_type: InvoiceType;
    invoice_date: Date;
    due_date?: Date | null;
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    service_charge_amount: number;
    total_amount: number;
    pan_number?: string | null;
    vat_amount?: number | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_email?: string | null;
    customer_address?: string | null;
    customer_pan?: string | null;
    pdf_generated: boolean;
    pdf_path?: string | null;
    pdf_url?: string | null;
    printed_count: number;
    first_printed_at?: Date | null;
    last_printed_at?: Date | null;
    emailed_to?: string | null;
    emailed_at?: Date | null;
    email_count: number;
    payment_status: PaymentStatus;
    paid_amount: number;
    notes?: string | null;
    created_by?: string | null;
    created_at: Date;
    updated_at: Date;
  
    // Extra fields from joins (not in table)
    order_number?: string;
    credit_customer_name?: string;
    credit_company_name?: string;
    created_by_name?: string;
    is_overdue?: boolean;
    days_overdue?: number;
    balance_amount?: number;
  }

export class InvoiceModel {
  /**
   * Create invoice
   */
  static async create(data: {
    order_id: string;
    credit_customer_id?: string | null;
    invoice_type: string;
    due_date?: Date | string | null;
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    service_charge_amount: number;
    total_amount: number;
    pan_number?: string | null;
    vat_amount?: number | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_email?: string | null;
    customer_address?: string | null;
    customer_pan?: string | null;
    payment_status: string;
    paid_amount: number;
    notes?: string | null;
    created_by: string;
  }, client?: PoolClient): Promise<Invoice> {
    const sql = `
      INSERT INTO invoice_records (
        order_id,
        credit_customer_id,
        invoice_type,
        due_date,
        subtotal,
        discount_amount,
        tax_amount,
        service_charge_amount,
        total_amount,
        pan_number,
        vat_amount,
        customer_name,
        customer_phone,
        customer_email,
        customer_address,
        customer_pan,
        payment_status,
        paid_amount,
        notes,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *;
    `;

    const values = [
      data.order_id,
      data.credit_customer_id || null,
      data.invoice_type,
      data.due_date || null,
      data.subtotal,
      data.discount_amount,
      data.tax_amount,
      data.service_charge_amount,
      data.total_amount,
      data.pan_number || null,
      data.vat_amount || null,
      data.customer_name || null,
      data.customer_phone || null,
      data.customer_email || null,
      data.customer_address || null,
      data.customer_pan || null,
      data.payment_status,
      data.paid_amount,
      data.notes || null,
      data.created_by,
    ];

    const executor = client || { query: query as typeof query };

    const result = await executor.query(sql, values);
    return result.rows[0] as Invoice;
  }

  /**
   * Find by ID
   */
  static async findById(invoiceId: string,client?: PoolClient): Promise<Invoice | null> {
    const sql = `
      SELECT 
      ir.*,
      o.order_number,
      cc.customer_name AS credit_customer_name,
      cc.company_name AS credit_company_name,
      u.full_name AS created_by_name,
      ir.total_amount - ir.paid_amount AS balance_amount,
      CASE 
        WHEN ir.due_date < CURRENT_DATE AND ir.payment_status != 'paid' 
        THEN true ELSE false 
      END AS is_overdue,
      CASE 
        WHEN ir.due_date < CURRENT_DATE AND ir.payment_status != 'paid' 
        THEN CURRENT_DATE - ir.due_date 
        ELSE 0 
      END AS days_overdue
    FROM invoice_records ir
    LEFT JOIN orders o ON ir.order_id = o.id
    LEFT JOIN credit_customers cc ON ir.credit_customer_id = cc.id
    LEFT JOIN users u ON ir.created_by = u.id
    WHERE ir.id = $1;
    `;

    const executor = client ?? { query: query as typeof query };

    const result = await executor.query(sql, [invoiceId]);
    return result.rows[0] || null;
  }

  /**
   * Find by order ID
   */
  static async findByOrderId(orderId: string): Promise<Invoice | null> {
    const sql = `
      SELECT * FROM invoice_records
      WHERE order_id = $1;
    `;

    const result = await query(sql, [orderId]);
    return result.rows[0] || null;
  }

  /**
   * Find by invoice number
   */
  static async findByInvoiceNumber(
    invoiceNumber: string
  ): Promise<Invoice | null> {
    const sql = `
      SELECT * FROM invoice_records
      WHERE invoice_number = $1;
    `;

    const result = await query(sql, [invoiceNumber]);
    return result.rows[0] || null;
  }

  /**
   * Find all with filters
   */
  static async findAll(params: {
    payment_status?: string;
    invoice_type?: string;
    start_date?: string;
    end_date?: string;
    credit_customer_id?: string;
    fiscal_year?: string;
    search?: string;
    is_overdue?: boolean;
    limit: number;
    offset: number;
  }): Promise<{ invoices: Invoice[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    // Payment status filter
    if (params.payment_status) {
      paramCount++;
      conditions.push(`ir.payment_status = $${paramCount}`);
      values.push(params.payment_status);
    }

    // Invoice type filter
    if (params.invoice_type) {
      paramCount++;
      conditions.push(`ir.invoice_type = $${paramCount}`);
      values.push(params.invoice_type);
    }

    // Date range filter
    if (params.start_date) {
      paramCount++;
      conditions.push(`ir.invoice_date >= $${paramCount}`);
      values.push(params.start_date);
    }

    if (params.end_date) {
      paramCount++;
      conditions.push(`ir.invoice_date <= $${paramCount}`);
      values.push(params.end_date);
    }

    // Credit customer filter
    if (params.credit_customer_id) {
      paramCount++;
      conditions.push(`ir.credit_customer_id = $${paramCount}`);
      values.push(params.credit_customer_id);
    }

    // Fiscal year filter
    if (params.fiscal_year) {
      paramCount++;
      conditions.push(`ir.fiscal_year = $${paramCount}`);
      values.push(params.fiscal_year);
    }

    // Search filter
    if (params.search) {
      paramCount++;
      conditions.push(`(
    ir.invoice_number ILIKE $${paramCount} OR
    ir.customer_name ILIKE $${paramCount} OR
    ir.customer_phone ILIKE $${paramCount}
  )`);
      values.push(`%${params.search}%`);
    }

    // Overdue filter
    if (params.is_overdue) {
      conditions.push(
        `ir.due_date < CURRENT_DATE AND ir.payment_status != 'paid'`
      );
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count total
    const countSql = `
  SELECT COUNT(*) FROM invoice_records ir
  ${whereClause};
`;

    const countResult = await query(countSql, values);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get invoices
    paramCount++;
    const limitParam = paramCount;
    paramCount++;
    const offsetParam = paramCount;

    const sql = `
  SELECT 
    ir.*,
    o.order_number,
    cc.customer_name AS credit_customer_name,
    cc.company_name AS credit_company_name,
    u.full_name AS created_by_name,
    CASE 
      WHEN ir.due_date < CURRENT_DATE AND ir.payment_status != 'paid' THEN true
      ELSE false
    END as is_overdue,
    CASE 
      WHEN ir.due_date < CURRENT_DATE AND ir.payment_status != 'paid' 
      THEN CURRENT_DATE - ir.due_date
      ELSE 0
    END as days_overdue,
    ir.total_amount - ir.paid_amount as balance_amount
  FROM invoice_records ir
  LEFT JOIN orders o ON ir.order_id = o.id
  LEFT JOIN credit_customers cc ON ir.credit_customer_id = cc.id
  LEFT JOIN users u ON ir.created_by = u.id
  ${whereClause}
  ORDER BY ir.invoice_date DESC, ir.created_at DESC
  LIMIT $${limitParam} OFFSET $${offsetParam};
`;

    values.push(params.limit, params.offset);

    const result = await query(sql, values);

    return {
      invoices: result.rows as Invoice[],
      total,
    };
  }
  /**

Find by customer ID
*/
  static async findByCustomerId(
    customerId: string,
    params: { limit: number; offset: number }
  ): Promise<{ invoices: Invoice[]; total: number }> {
    // Count total
    const countSql = `SELECT COUNT(*) FROM invoice_records  WHERE credit_customer_id = $1;`;
    const countResult = await query(countSql, [customerId]);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get invoices
    const sql = `
  SELECT 
    ir.*,
    o.order_number,
    CASE 
      WHEN ir.due_date < CURRENT_DATE AND ir.payment_status != 'paid' THEN true
      ELSE false
    END as is_overdue,
    CASE 
      WHEN ir.due_date < CURRENT_DATE AND ir.payment_status != 'paid' 
      THEN CURRENT_DATE - ir.due_date
      ELSE 0
    END as days_overdue,
    ir.total_amount - ir.paid_amount as balance_amount
  FROM invoice_records ir
  LEFT JOIN orders o ON ir.order_id = o.id
  WHERE ir.credit_customer_id = $1
  ORDER BY ir.invoice_date DESC
  LIMIT $2 OFFSET $3;
`;

    const result = await query(sql, [customerId, params.limit, params.offset]);

    return {
      invoices: result.rows as Invoice[],
      total,
    };
  }
  /**

Update invoice
*/
  static async update(invoiceId: string, data: any): Promise<Invoice> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;
    // Build dynamic update query
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && key !== "id") {
        paramCount++;
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      return this.findById(invoiceId) as Promise<Invoice>;
    }

    paramCount++;
    values.push(invoiceId);

    const sql = `
        UPDATE invoice_records
        SET ${fields.join(", ")}, updated_at = NOW()
        WHERE id = $${paramCount}
        RETURNING *;
      `;

    const result = await query(sql, values);
    return result.rows[0] as Invoice;
  }

  /**

Delete invoice
*/
  static async delete(invoiceId: string): Promise<void> {
    const sql = `DELETE FROM invoice_records  WHERE id = $1`;
    await query(sql, [invoiceId]);
  }

  /**

Increment print count
*/
  static async incrementPrintCount(invoiceId: string): Promise<Invoice> {
    const sql = `UPDATE invoice_records  SET printed_count = printed_count + 1,      last_printed_at = NOW(),      first_printed_at = COALESCE(first_printed_at, NOW()),      updated_at = NOW()  WHERE id = $1  RETURNING *`;
    const result = await query(sql, [invoiceId]);
    return result.rows[0] as Invoice;
  }

  /**

Get summary
*/
  static async getSummary(filters: {
    start_date?: string;
    end_date?: string;
    fiscal_year?: string;
  }) {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 0;
    if (filters.start_date) {
      paramCount++;
      conditions.push(`invoice_date >= $${paramCount}`);
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      paramCount++;
      conditions.push(`invoice_date <= $${paramCount}`);
      values.push(filters.end_date);
    }

    if (filters.fiscal_year) {
      paramCount++;
      conditions.push(`fiscal_year = $${paramCount}`);
      values.push(filters.fiscal_year);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
  SELECT 
    COUNT(*) as total_invoices,
    SUM(total_amount) as total_amount,
    SUM(paid_amount) as total_paid,
    SUM(total_amount - paid_amount) as total_outstanding,
    SUM(vat_amount) as total_vat,
    COUNT(*) FILTER (WHERE payment_status = 'paid') as paid_invoices,
    COUNT(*) FILTER (WHERE payment_status = 'unpaid') as unpaid_invoices,
    COUNT(*) FILTER (WHERE payment_status = 'partial') as partial_invoices,
    COUNT(*) FILTER (WHERE credit_customer_id IS NOT NULL) as credit_invoices,
    COUNT(*) FILTER (WHERE credit_customer_id IS NULL) as cash_invoices,
    COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND payment_status != 'paid') as overdue_invoices
  FROM invoice_records
  ${whereClause};
`;

    const result = await query(sql, values);
    return result.rows[0];
  }

  /**

Get daily summary
*/
  static async getDailySummary(date: string) {
    const sql = `SELECT * FROM daily_invoice_summary  WHERE invoice_date = $1`;
    const result = await query(sql, [date]);
    return (
      result.rows[0] || {
        invoice_date: date,
        total_invoices: 0,
        total_invoiced: 0,
        total_paid: 0,
        total_unpaid: 0,
        total_partial: 0,
        credit_invoices: 0,
        cash_invoices: 0,
      }
    );
  }
  /**

Get overdue invoices
*/
  static async getOverdueInvoices(): Promise<any[]> {
    const sql = `SELECT     ir.*,    o.order_number,    cc.customer_name AS credit_customer_name,    cc.company_name AS credit_company_name,    cc.customer_phone AS credit_customer_phone,    CURRENT_DATE - ir.due_date as days_overdue,    ir.total_amount - ir.paid_amount as balance_amount  FROM invoice_records ir  LEFT JOIN orders o ON ir.order_id = o.id  LEFT JOIN credit_customers cc ON ir.credit_customer_id = cc.id  WHERE ir.due_date < CURRENT_DATE    AND ir.payment_status != 'paid'  ORDER BY ir.due_date ASC`;
    const result = await query(sql);
    return result.rows;
  }
}
