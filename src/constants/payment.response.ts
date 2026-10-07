export const PAYMENT_RESPONSE = {
    PAYMENT_PROCESSED: 'Payment processed successfully',
    PAYMENT_HISTORY_RETRIEVED: 'Payment history retrieved successfully',
    REFUND_PROCESSED: 'Refund processed successfully',
    PAYMENT_STATUS_RETRIEVED: 'Payment status retrieved successfully',
  };

  export const PAYMENT_ERROR_MESSAGES = {
    ORDER_NOT_FOUND: 'Order not found',
    PAYMENT_NOT_FOUND: 'Payment not found',
    CANNOT_PROCESS_PAYMENT_CANCELLED: 'Cannot process payment for cancelled order',
    ORDER_ALREADY_PAID: 'Order is already fully paid',
    INVALID_PAYMENT_AMOUNT: 'Payment amount must be greater than 0',
    REFUND_EXCEEDS_PAYMENT: 'Refund amount exceeds payment amount',
    REFUND_EXCEEDS_AVAILABLE: 'Total refunds exceed available payment amount',
  };