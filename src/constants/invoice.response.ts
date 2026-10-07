export const INVOICE_RESPONSE = {
    INVOICE_CREATED: "Invoice created successfully",
    INVOICE_RETRIEVED: "Invoice retrieved successfully",
    INVOICES_RETRIEVED: "Invoices retrieved successfully",
    OVERDUE_RETRIEVED: "Overdue invoices retrieved successfully",
    SUMMARY_GENERATED: "Invoice summary generated successfully",
    PRINT_RECORDED: "Invoice print recorded successfully",
    EMAIL_SENT: "Invoice emailed successfully",
    INVOICE_UPDATED: "Invoice updated successfully",
    INVOICE_DELETED: "Invoice deleted successfully",
    PDF_GENERATED: "Invoice PDF generated successfully",
  };
  
  export const INVOICE_ERROR_MESSAGES = {
    ORDER_NOT_FOUND: "Order not found",
    ORDER_NOT_COMPLETED: "Order must be completed before generating an invoice",
    INVOICE_ALREADY_EXISTS: "Invoice already exists for this order",
  
    CREDIT_CUSTOMER_NOT_FOUND: "Credit customer not found",
    CUSTOMER_NOT_ACTIVE: "Credit customer is not active",
  
    EXCEEDS_CREDIT_LIMIT:
      "Credit limit exceeded for this customer",
  
    PAYMENT_EXCEEDS_BALANCE:
      "Payment amount exceeds outstanding balance",
  
    BALANCE_CANNOT_BE_NEGATIVE:
      "Balance cannot be negative",
  
    INVOICE_NOT_FOUND: "Invoice not found",
  
    CANNOT_UPDATE_PAID_INVOICE:
      "Paid invoices cannot be updated",
  
    CANNOT_DELETE_PAID_INVOICE:
      "Paid invoices cannot be deleted",
  };
  