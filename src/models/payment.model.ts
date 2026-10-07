import { query } from '../config/database';
import { Payment, Refund } from '../types/payment.types';



export class PaymentModel {
  /**
   * Create a new payment
   */
  static async createPayment(data: {
    order_id: string;
    payment_method: string;
    amount: number;
    transaction_id?: string;
    reference_number?: string;
    card_last_4_digits?: string;
    payment_gateway?: string;
    status: string;
    processed_by: string;
    notes?: string;
  }): Promise<Payment> {
    const sql = `
      INSERT INTO order_payments (
        order_id,
        payment_method,
        amount,
        transaction_id,
        reference_number,
        card_last_4_digits,
        payment_gateway,
        status,
        processed_by,
        notes,
        payment_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *;
    `;

    const values = [
      data.order_id,
      data.payment_method,
      data.amount,
      data.transaction_id || null,
      data.reference_number || null,
      data.card_last_4_digits || null,
      data.payment_gateway || null,
      data.status,
      data.processed_by,
      data.notes || null,
    ];

    const result = await query(sql, values);
    return result.rows[0] as Payment;
  }

  /**
   * Find payment by ID
   */
  static async findById(paymentId: string): Promise<Payment | null> {
    const sql = `
      SELECT 
        op.*,
        u.full_name AS processed_by_name
      FROM order_payments op
      LEFT JOIN users u ON op.processed_by = u.id
      WHERE op.id = $1;
    `;

    const result = await query(sql, [paymentId]);
    return result.rows[0] || null;
  }

  /**
   * Find all payments for an order
   */
  static async findByOrderId(orderId: string): Promise<Payment[]> {
    const sql = `
      SELECT 
        op.*,
        u.full_name AS processed_by_name
      FROM order_payments op
      LEFT JOIN users u ON op.processed_by = u.id
      WHERE op.order_id = $1
      ORDER BY op.payment_date DESC;
    `;

    const result = await query(sql, [orderId]);
    return result.rows as Payment[];
  }

  /**
   * Create a refund
   */
  static async createRefund(data: {
    order_id: string;
    payment_id?: string;
    refund_amount: number;
    refund_method: string;
    reason: string;
    refunded_by: string;
    approved_by?: string;
  }): Promise<Refund> {
    const sql = `
      INSERT INTO order_refunds (
        order_id,
        payment_id,
        refund_amount,
        refund_method,
        reason,
        refunded_by,
        approved_by,
        refund_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *;
    `;

    const values = [
      data.order_id,
      data.payment_id || null,
      data.refund_amount,
      data.refund_method,
      data.reason,
      data.refunded_by,
      data.approved_by || null,
    ];

    const result = await query(sql, values);
    return result.rows[0] as Refund;
  }

  /**
   * Find refunds by order ID
   */
  static async findRefundsByOrderId(orderId: string): Promise<Refund[]> {
    const sql = `
      SELECT 
        r.*,
        u1.full_name AS refunded_by_name,
        u2.full_name AS approved_by_name
      FROM order_refunds r
      LEFT JOIN users u1 ON r.refunded_by = u1.id
      LEFT JOIN users u2 ON r.approved_by = u2.id
      WHERE r.order_id = $1
      ORDER BY r.refund_date DESC;
    `;

    const result = await query(sql, [orderId]);
    return result.rows as Refund[];
  }

  /**
   * Find refunds by payment ID
   */
  static async findRefundsByPaymentId(paymentId: string): Promise<Refund[]> {
    const sql = `
      SELECT * FROM order_refunds
      WHERE payment_id = $1
      ORDER BY refund_date DESC;
    `;

    const result = await query(sql, [paymentId]);
    return result.rows as Refund[];
  }

  /**
   * Update payment status
   */
  static async updatePaymentStatus(
    paymentId: string,
    status: string
  ): Promise<void> {
    const sql = `
      UPDATE order_payments
      SET status = $1
      WHERE id = $2;
    `;

    await query(sql, [status, paymentId]);
  }

  /**
   * Recalculate order payment status after refund
   */
  static async recalculateOrderPaymentStatus(orderId: string): Promise<void> {
    const sql = `
      WITH payment_net AS (
        SELECT 
          COALESCE(SUM(op.amount - COALESCE(r.refunded_amount, 0)), 0) AS net_paid
        FROM order_payments op
        LEFT JOIN (
          SELECT 
            payment_id, 
            SUM(refund_amount) AS refunded_amount
          FROM order_refunds
          GROUP BY payment_id
        ) r ON op.id = r.payment_id
        WHERE op.order_id = $1
        AND op.status = 'completed'
      ),
  
      order_info AS (
        SELECT total_amount
        FROM orders
        WHERE id = $1
      )
  
      UPDATE orders
      SET 
        paid_amount = (SELECT net_paid FROM payment_net),
  
        balance_amount = GREATEST(
          (SELECT total_amount FROM order_info) - (SELECT net_paid FROM payment_net),
          0
        ),
  
        payment_status = (
          CASE
            WHEN (SELECT net_paid FROM payment_net) = 0 THEN 'unpaid'
            WHEN (SELECT net_paid FROM payment_net) >= (SELECT total_amount FROM order_info) THEN 'paid'
            ELSE 'partial'
          END
        )::payment_status,  -- ✅ FIX HERE
  
        updated_at = NOW()
  
      WHERE id = $1;
    `;
  
    await query(sql, [orderId]);
  }
}