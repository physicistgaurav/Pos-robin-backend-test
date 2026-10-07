export interface Payment {
    id: string;
    order_id: string;
    payment_method: string;
    amount: number;
    transaction_id?: string;
    reference_number?: string;
    card_last_4_digits?: string;
    payment_gateway?: string;
    status: string;
    processed_by?: string;
    notes?: string;
    payment_date: Date;
    created_at: Date;
  }
  
  export interface Refund {
    id: string;
    order_id: string;
    payment_id?: string;
    refund_amount: number;
    refund_method: string;
    reason: string;
    refunded_by?: string;
    approved_by?: string;
    refund_date: Date;
    created_at: Date;
  }

  export interface ProcessPaymentData {
    payment_method: string;
    amount: number;
    transaction_id?: string;
    reference_number?: string;
    card_last_4_digits?: string;
    payment_gateway?: string;
    notes?: string;
    processed_by: string;
    credit_customer_id?: string;
  }
  
  export interface RefundData {
    refund_amount: number;
    reason: string;
    refunded_by: string;
    approved_by?: string;
  }