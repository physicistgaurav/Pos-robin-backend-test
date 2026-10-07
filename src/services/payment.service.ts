import { PAYMENT_ERROR_MESSAGES } from "../constants/payment.response";
import { CreditTransactionModel } from "../models/credit-transaction.model";
import { OrderModel } from "../models/order.model";
import { PaymentModel } from "../models/payment.model";
import { ProcessPaymentData, RefundData } from "../types/payment.types";
import { ApiError } from "../utils/ApiError";
import { calculateDueDate } from "../utils/payment";
import { transaction } from "../config/database";

export class PaymentService {
  /**
   * Process payment for an order
   * Handles: unpaid → partial → paid status transitions
   */
  // static async processPayment(
  //   orderId: string,
  //   paymentData: ProcessPaymentData
  // ) {
  //   // 1. Get order details
  //   const order = await OrderModel.findById(orderId);
  //   if (!order) {
  //     throw ApiError.notFound(PAYMENT_ERROR_MESSAGES.ORDER_NOT_FOUND);
  //   }

  //   // 2. Validate order status
  //   if (order.status === "cancelled") {
  //     throw ApiError.badRequest(
  //       PAYMENT_ERROR_MESSAGES.CANNOT_PROCESS_PAYMENT_CANCELLED
  //     );
  //   }

  //   if (order.payment_status === "paid") {
  //     throw ApiError.badRequest(PAYMENT_ERROR_MESSAGES.ORDER_ALREADY_PAID);
  //   }

  //   // 3. Calculate remaining balance
  //   const remainingBalance = order.total_amount - order.paid_amount;

  //   // 4. Validate payment amount
  //   if (paymentData.amount <= 0) {
  //     throw ApiError.badRequest(PAYMENT_ERROR_MESSAGES.INVALID_PAYMENT_AMOUNT);
  //   }

  //   if (paymentData.amount > remainingBalance) {
  //     throw ApiError.badRequest(
  //       `Payment amount (${paymentData.amount}) exceeds remaining balance (${remainingBalance})`
  //     );
  //   }

  //   // 5. Create payment record
  //   const payment = await PaymentModel.createPayment({
  //     order_id: orderId,
  //     ...paymentData,
  //     status: "completed",
  //   });

  //   // 6. Get updated order with new payment status
  //   const updatedOrder = await OrderModel.findById(orderId);
  //   if (!updatedOrder) {
  //     throw ApiError.notFound(PAYMENT_ERROR_MESSAGES.ORDER_NOT_FOUND);
  //   }

  //   // 7. Return payment details with status transition
  //   return {
  //     payment,
  //     order: {
  //       id: updatedOrder.id,
  //       order_number: updatedOrder.order_number,
  //       total_amount: updatedOrder.total_amount,
  //       paid_amount: updatedOrder.paid_amount,
  //       balance_amount: updatedOrder.balance_amount,
  //       payment_status: updatedOrder.payment_status,
  //       previous_payment_status: order.payment_status,
  //     },
  //     message: this.getPaymentStatusMessage(
  //       order.payment_status,
  //       updatedOrder.payment_status,
  //       updatedOrder.balance_amount
  //     ),
  //   };
  // }

  /** Convert NPR rupees to integer paisa to avoid float comparison bugs */
  private static toPaisa(amount: number | string): number {
    return Math.round(Number(amount) * 100);
  }

  static async processPayment(orderId: string, paymentData: ProcessPaymentData) {
    // Everything runs in ONE transaction with the order row locked:
    // two cashiers tapping "pay" at the same time can no longer both pass
    // the balance check and double-charge the customer.
    return transaction(async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId]
      );
      const order = rows[0];
      if (!order) throw ApiError.notFound(PAYMENT_ERROR_MESSAGES.ORDER_NOT_FOUND);

      if (order.status === 'cancelled') {
        throw ApiError.badRequest(PAYMENT_ERROR_MESSAGES.CANNOT_PROCESS_PAYMENT_CANCELLED);
      }
      if (order.payment_status === 'paid') {
        throw ApiError.badRequest(PAYMENT_ERROR_MESSAGES.ORDER_ALREADY_PAID);
      }

      const remainingPaisa = this.toPaisa(order.total_amount) - this.toPaisa(order.paid_amount);
      const amountPaisa = this.toPaisa(paymentData.amount);

      if (amountPaisa <= 0) {
        throw ApiError.badRequest(PAYMENT_ERROR_MESSAGES.INVALID_PAYMENT_AMOUNT);
      }
      if (amountPaisa > remainingPaisa) {
        throw ApiError.badRequest(
          `Payment amount (${paymentData.amount}) exceeds remaining balance (${(remainingPaisa / 100).toFixed(2)})`
        );
      }

      // ── CREDIT PAYMENT BRANCH ──────────────────────────────────────
      if (paymentData.payment_method === 'credit') {
        const creditCustomerId = paymentData.credit_customer_id ?? order.credit_customer_id;

        if (!creditCustomerId) {
          throw ApiError.badRequest(
            'credit_customer_id is required for credit payments.'
          );
        }

        // Lock the credit account: concurrent charges can't overshoot the limit
        const ccRes = await client.query(
          `SELECT * FROM credit_customers WHERE id = $1 FOR UPDATE`,
          [creditCustomerId]
        );
        const creditCustomer = ccRes.rows[0];
        if (!creditCustomer) throw ApiError.notFound('Credit customer not found');
        if (creditCustomer.status !== 'active') {
          throw ApiError.badRequest(`Credit account is ${creditCustomer.status}.`);
        }

        const availablePaisa = this.toPaisa(creditCustomer.available_credit);
        if (amountPaisa > availablePaisa) {
          throw ApiError.badRequest(
            `Amount (${paymentData.amount}) exceeds available credit (${creditCustomer.available_credit})`
          );
        }

        // Link credit customer to order
        if (!order.credit_customer_id) {
          await client.query(
            `UPDATE orders SET credit_customer_id = $1, updated_at = NOW() WHERE id = $2`,
            [creditCustomerId, orderId]
          );
        }

        // Create credit transaction → DB trigger updates current_balance
        const currentBalance = Number(creditCustomer.current_balance);
        await CreditTransactionModel.create({
          credit_customer_id: creditCustomerId,
          order_id: orderId,
          transaction_type: 'charge',
          amount: paymentData.amount,
          balance_before: currentBalance,
          balance_after: currentBalance + paymentData.amount,
          due_date: calculateDueDate(creditCustomer.payment_terms_days).toISOString(),
          notes: paymentData.notes ?? undefined,
          created_by: paymentData.processed_by,
        }, client);

        paymentData.credit_customer_id = creditCustomerId;
      }
      // ── END CREDIT BRANCH ──────────────────────────────────────────

      // Creates order_payments record → DB trigger updates order.paid_amount + payment_status.
      // The UNIQUE index on (order_id, transaction_id) makes retries safe:
      // a double-submitted gateway callback becomes a 409, not a double charge.
      let payment;
      try {
        payment = await PaymentModel.createPayment({
          order_id: orderId,
          ...paymentData,
          status: 'completed',
        }, client);
      } catch (err: any) {
        if (err?.code === '23505') {
          throw ApiError.conflict(
            'Duplicate payment: a payment with this transaction ID was already recorded for this order'
          );
        }
        throw err;
      }

      const updatedOrder = (
        await client.query(`SELECT * FROM orders WHERE id = $1`, [orderId])
      ).rows[0];
      if (!updatedOrder) throw ApiError.notFound(PAYMENT_ERROR_MESSAGES.ORDER_NOT_FOUND);

      return {
        payment,
        order: {
          id: updatedOrder.id,
          order_number: updatedOrder.order_number,
          total_amount: updatedOrder.total_amount,
          paid_amount: updatedOrder.paid_amount,
          balance_amount: updatedOrder.balance_amount,
          payment_status: updatedOrder.payment_status,
          previous_payment_status: order.payment_status,
          credit_customer_id: updatedOrder.credit_customer_id ?? null,
        },
        message: this.getPaymentStatusMessage(
          order.payment_status,
          updatedOrder.payment_status,
          updatedOrder.balance_amount
        ),
      };
    });
  }


  /**
   * Get payment history for an order
   */
  static async getPaymentHistory(orderId: string) {
    // 1. Check if order exists
    const order = await OrderModel.findById(orderId);
    if (!order) {
      throw ApiError.notFound(PAYMENT_ERROR_MESSAGES.ORDER_NOT_FOUND);
    }

    // 2. Get all payments
    const payments = await PaymentModel.findByOrderId(orderId);

    // 3. Get refunds
    const refunds = await PaymentModel.findRefundsByOrderId(orderId);

    // 4. Calculate totals
    const totalPaid = payments
      .filter((p) => p.status === "completed")
      .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);

    const totalRefunded = refunds.reduce(
      (sum, r) => sum + parseFloat(r.refund_amount.toString()),
      0
    );

    return {
      order: {
        id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount,
        paid_amount: order.paid_amount,
        balance_amount: order.balance_amount,
        payment_status: order.payment_status,
      },
      payments,
      refunds,
      summary: {
        total_paid: totalPaid,
        total_refunded: totalRefunded,
        net_paid: totalPaid - totalRefunded,
        remaining_balance: order.balance_amount,
      },
    };
  }

  /**
   * Refund a payment
   */
  static async refundPayment(
    orderId: string,
    paymentId: string,
    refundData: RefundData
  ) {
    // Locked single transaction: concurrent refunds can no longer race the
    // cumulative cap, and the credit ledger is reversed in the same commit.
    return transaction(async (client) => {
      // 1. Verify order exists (locked)
      const orderRes = await client.query(
        `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId]
      );
      const order = orderRes.rows[0];
      if (!order) {
        throw ApiError.notFound(PAYMENT_ERROR_MESSAGES.ORDER_NOT_FOUND);
      }

      // 2. Verify payment exists and belongs to order (locked)
      const payRes = await client.query(
        `SELECT * FROM order_payments WHERE id = $1 FOR UPDATE`,
        [paymentId]
      );
      const payment = payRes.rows[0];
      if (!payment || payment.order_id !== orderId) {
        throw ApiError.conflict(PAYMENT_ERROR_MESSAGES.PAYMENT_NOT_FOUND);
      }

      // 3. Only completed payments hold money — failed/pending ones have
      //    nothing to give back and must not create refund records.
      if (payment.status !== 'completed') {
        throw ApiError.badRequest(
          `Only completed payments can be refunded (current status: ${payment.status})`
        );
      }

      // 4. Validate refund amount doesn't exceed original payment (paisa math)
      const paymentPaisa = this.toPaisa(payment.amount);
      const refundPaisa = this.toPaisa(refundData.refund_amount);
      if (refundPaisa <= 0 || refundPaisa > paymentPaisa) {
        throw ApiError.conflict(PAYMENT_ERROR_MESSAGES.REFUND_EXCEEDS_PAYMENT);
      }

      // 5. Check cumulative refunds don't exceed original payment amount
      const existingRefunds = await PaymentModel.findRefundsByPaymentId(paymentId, client);
      const totalRefundedPaisa = existingRefunds.reduce(
        (sum, r) => sum + this.toPaisa(r.refund_amount),
        0
      );

      if (totalRefundedPaisa + refundPaisa > paymentPaisa) {
        throw ApiError.conflict(PAYMENT_ERROR_MESSAGES.REFUND_EXCEEDS_AVAILABLE);
      }

      // 6. Create refund record
      const refund = await PaymentModel.createRefund({
        order_id: orderId,
        payment_id: paymentId,
        refund_method: payment.payment_method,
        ...refundData,
      }, client);

      // 7. Credit payments: reverse the charge on the customer's ledger so
      //    the refunded amount becomes available credit again.
      //    (credit_customer_id lives on the order, not on order_payments.)
      if (payment.payment_method === 'credit' && order.credit_customer_id) {
        const ccRes = await client.query(
          `SELECT * FROM credit_customers WHERE id = $1 FOR UPDATE`,
          [order.credit_customer_id]
        );
        const cc = ccRes.rows[0];
        if (cc && cc.status === 'active') {
          await CreditTransactionModel.create({
            credit_customer_id: order.credit_customer_id,
            order_id: orderId,
            transaction_type: 'payment',
            amount: refundData.refund_amount,
            balance_before: Number(cc.current_balance),
            balance_after: Number(cc.current_balance) - refundData.refund_amount,
            notes: `Refund of payment ${paymentId}: ${refundData.reason}`,
            created_by: refundData.refunded_by,
          }, client);
        }
      }

      // 8. Update payment status if fully refunded
      const newTotalRefundedPaisa = totalRefundedPaisa + refundPaisa;
      if (newTotalRefundedPaisa >= paymentPaisa) {
        await PaymentModel.updatePaymentStatus(paymentId, "refunded", client);
      }

      // 9. Recalculate order payment status
      await PaymentModel.recalculateOrderPaymentStatus(orderId, client);

      // 10. Get updated order
      const updatedOrder = (
        await client.query(`SELECT * FROM orders WHERE id = $1`, [orderId])
      ).rows[0];
      if (!updatedOrder) {
        throw ApiError.notFound(PAYMENT_ERROR_MESSAGES.ORDER_NOT_FOUND);
      }

      return {
        refund,
        order: {
          id: updatedOrder.id,
          order_number: updatedOrder.order_number,
          payment_status: updatedOrder.payment_status,
          paid_amount: updatedOrder.paid_amount,
          balance_amount: updatedOrder.balance_amount,
        },
      };
    });
  }

  /**
   * Get payment status summary
   */
  static async getPaymentStatus(orderId: string) {
    const order = await OrderModel.findById(orderId);
    if (!order) {
      throw ApiError.notFound(PAYMENT_ERROR_MESSAGES.ORDER_NOT_FOUND);
    }

    const payments = await PaymentModel.findByOrderId(orderId);
    const refunds = await PaymentModel.findRefundsByOrderId(orderId);

    // Group payments by method
    const paymentsByMethod = payments
      .filter((p) => p.status === "completed")
      .reduce(
        (acc, payment) => {
          const method = payment.payment_method;
          if (!acc[method]) {
            acc[method] = {
              method,
              count: 0,
              total: 0,
            };
          }
          acc[method].count++;
          acc[method].total += parseFloat(payment.amount.toString());
          return acc;
        },
        {} as Record<string, { method: string; count: number; total: number }>
      );

    return {
      order_id: order.id,
      order_number: order.order_number,
      order_status: order.status,
      payment_status: order.payment_status,
      amounts: {
        subtotal: order.subtotal,
        discount: order.discount_amount,
        tax: order.tax_amount,
        service_charge: order.service_charge_amount,
        total: order.total_amount,
        paid: order.paid_amount,
        balance: order.balance_amount,
      },
      payment_breakdown: Object.values(paymentsByMethod),
      total_payments: payments.length,
      total_refunds: refunds.length,
      is_fully_paid: order.payment_status === "paid",
      is_partially_paid: order.payment_status === "partial",
      is_unpaid: order.payment_status === "unpaid",
    };
  }

  /**
   * Helper: Get user-friendly payment status message
   */
  private static getPaymentStatusMessage(
    previousStatus: string,
    currentStatus: string,
    balance: number | string
  ): string {
    const numericBalance = Number(balance);

    const formattedBalance = Number.isFinite(numericBalance)
      ? numericBalance.toFixed(2)
      : "0.00";

    if (previousStatus === "unpaid" && currentStatus === "partial") {
      return `Partial payment received. Remaining balance: Rs. ${formattedBalance}`;
    }

    if (previousStatus === "partial" && currentStatus === "partial") {
      return `Additional payment received. Remaining balance: Rs. ${formattedBalance}`;
    }

    if (currentStatus === "paid") {
      return "Payment completed successfully. Order is fully paid.";
    }

    return "Payment processed successfully.";
  }
}
