import { PAYMENT_ERROR_MESSAGES } from "../constants/payment.response";
import { CreditCustomerModel } from "../models/credit-customer.model";
import { CreditTransactionModel } from "../models/credit-transaction.model";
import { OrderModel } from "../models/order.model";
import { PaymentModel } from "../models/payment.model";
import { ProcessPaymentData, RefundData } from "../types/payment.types";
import { ApiError } from "../utils/ApiError";
import { calculateDueDate } from "../utils/payment";

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

  static async processPayment(orderId: string, paymentData: ProcessPaymentData) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw ApiError.notFound(PAYMENT_ERROR_MESSAGES.ORDER_NOT_FOUND);
  
    if (order.status === 'cancelled') {
      throw ApiError.badRequest(PAYMENT_ERROR_MESSAGES.CANNOT_PROCESS_PAYMENT_CANCELLED);
    }
    if (order.payment_status === 'paid') {
      throw ApiError.badRequest(PAYMENT_ERROR_MESSAGES.ORDER_ALREADY_PAID);
    }
  
    const remainingBalance = Number(order.total_amount) - Number(order.paid_amount);
  
    if (paymentData.amount <= 0) {
      throw ApiError.badRequest(PAYMENT_ERROR_MESSAGES.INVALID_PAYMENT_AMOUNT);
    }
    if (paymentData.amount > remainingBalance) {
      throw ApiError.badRequest(
        `Payment amount (${paymentData.amount}) exceeds remaining balance (${remainingBalance})`
      );
    }
  
    // ── CREDIT PAYMENT BRANCH ──────────────────────────────────────────
    if (paymentData.payment_method === 'credit') {
      const creditCustomerId = paymentData.credit_customer_id ?? order.credit_customer_id;
  
      if (!creditCustomerId) {
        throw ApiError.badRequest(
          'credit_customer_id is required for credit payments.'
        );
      }
  
      const creditCustomer = await CreditCustomerModel.findById(creditCustomerId);
      if (!creditCustomer) throw ApiError.notFound('Credit customer not found');
      if (creditCustomer.status !== 'active') {
        throw ApiError.badRequest(`Credit account is ${creditCustomer.status}.`);
      }
  
      // Cast to number — DECIMAL comes back as string from pg
      const availableCredit = Number(creditCustomer.available_credit);
      const currentBalance = Number(creditCustomer.current_balance);
  
      console.log('availableCredit:', availableCredit, 'amount:', paymentData.amount);
  
      if (paymentData.amount > availableCredit) {
        throw ApiError.badRequest(
          `Amount (${paymentData.amount}) exceeds available credit (${availableCredit})`
        );
      }
  
      // Link credit customer to order
      if (!order.credit_customer_id) {
        await OrderModel.updateCreditCustomer(orderId, creditCustomerId);
      }
  
      // Create credit transaction → DB trigger updates current_balance
      const creditTx = await CreditTransactionModel.create({
        credit_customer_id: creditCustomerId,
        order_id: orderId,
        transaction_type: 'charge',
        amount: paymentData.amount,
        balance_before: currentBalance,
        balance_after: currentBalance + paymentData.amount,
        due_date: calculateDueDate(creditCustomer.payment_terms_days).toISOString(),
        notes: paymentData.notes ?? undefined,
        created_by: paymentData.processed_by,
      });
  
      console.log('Credit transaction created:', creditTx);
  
      paymentData.credit_customer_id = creditCustomerId;
    }
    // ── END CREDIT BRANCH ──────────────────────────────────────────────
  
    // Creates order_payments record → DB trigger updates order.paid_amount + payment_status
    const payment = await PaymentModel.createPayment({
      order_id: orderId,
      ...paymentData,
      status: 'completed',
    });
  
    const updatedOrder = await OrderModel.findById(orderId);
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
    // 1. Verify order exists
    const order = await OrderModel.findById(orderId);
    if (!order) {
      throw ApiError.notFound(PAYMENT_ERROR_MESSAGES.ORDER_NOT_FOUND);
    }
  
    // 2. Verify payment exists and belongs to order
    const payment = await PaymentModel.findById(paymentId);
    if (!payment || payment.order_id !== orderId) {
      throw ApiError.conflict(PAYMENT_ERROR_MESSAGES.PAYMENT_NOT_FOUND);
    }
  
    // 3. Validate refund amount doesn't exceed original payment
    const paymentAmount = parseFloat(payment.amount.toString());
    if (refundData.refund_amount > paymentAmount) {
      throw ApiError.conflict(PAYMENT_ERROR_MESSAGES.REFUND_EXCEEDS_PAYMENT);
    }
  
    // 4. Check cumulative refunds don't exceed original payment amount
    const existingRefunds = await PaymentModel.findRefundsByPaymentId(paymentId);
    const totalRefunded = existingRefunds.reduce(
      (sum, r) => sum + parseFloat(r.refund_amount.toString()),
      0
    );
  
    if (totalRefunded + refundData.refund_amount > paymentAmount) {
      throw ApiError.conflict(PAYMENT_ERROR_MESSAGES.REFUND_EXCEEDS_AVAILABLE);
    }
  
    // 5. Create refund record
    const refund = await PaymentModel.createRefund({
      order_id: orderId,
      payment_id: paymentId,
      refund_method: payment.payment_method,
      ...refundData,
    });
  
    // 6. Update payment status if fully refunded
    const newTotalRefunded = totalRefunded + refundData.refund_amount;
    if (newTotalRefunded >= paymentAmount) {
      await PaymentModel.updatePaymentStatus(paymentId, "refunded");
    }
  
    // 7. Recalculate order payment status
    await PaymentModel.recalculateOrderPaymentStatus(orderId);
  
    // 8. Get updated order
    const updatedOrder = await OrderModel.findById(orderId);
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
