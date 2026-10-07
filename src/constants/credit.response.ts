export const CREDIT_RESPONSE = {
    CUSTOMER_CREATED: 'Credit Customer created successfully',
    CUSTOMERS_RETRIEVED: 'Credit customers retrieved successfully',
    CUSTOMER_RETRIEVED: 'Credit customer retrieved successfully',
    CUSTOMER_UPDATED: 'Credit customer updated successfully',
    STATUS_UPDATED:'Credit customer status updated successfully',
    BALANCE_RETRIEVED:'Credit Customer Balance retreived successfully', 
    STATEMENT_RETRIEVED:'Credit Statement retreived successfully',
    PAYMENT_RECORDED:'Credit Payment recorded successfully',
    BALANCE_ADJUSTED:'Balance adjusted successfully',
    ORDERS_RETRIEVED:'Credit customer order retreived successfully',
    REPORT_GENERATED:'Report generated successfully'
  };

  export const CREDIT_ERROR_MESSAGES = {
    CREDIT_CUSTOMER_EXISTS: 'Credit customer not found',
    CREDIT_CUSTOMER_NOT_FOUND: 'Credit customer not found',
    PHONE_ALREADY_EXISTS: 'Credit user with this phone number already exists',
    CANNOT_CLOSE_WITH_BALANCE: 'Cannot close credit customer with current balance remanining',
    INVALID_PAYMENT_AMOUNT: 'Payment amount must be greater than 0',
    REFUND_EXCEEDS_PAYMENT: 'Refund amount exceeds payment amount',
    REFUND_EXCEEDS_AVAILABLE: 'Total refunds exceed available payment amount',
    CUSTOMER_NOT_ACTIVE:'Credit customer not active',
    PAYMENT_EXCEEDS_BALANCE:'Payment exceeded balance amount',
    BALANCE_CANNOT_BE_NEGATIVE:'Balance cannot be negative',
    EXCEEDS_CREDIT_LIMIT: 'Credit limit exceeded'
  };