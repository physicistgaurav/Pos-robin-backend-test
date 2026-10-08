import Joi from 'joi';

export const processPaymentSchema = {
  params: Joi.object({
    orderId: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    payment_method: Joi.string()
      .valid(
        'cash',
        'credit',
        'debit_card',
        'online',
        'connectIPS',
        'esewa',
        'khalti',
        'fonepay'
      )
      .required(),
    amount: Joi.number().positive().precision(2).required(),
    credit_customer_id: Joi.string().uuid().when('payment_method', {
      is: 'credit',
      then: Joi.required(),
      otherwise: Joi.forbidden(), // don't allow it for non-credit orders
    }),
    transaction_id: Joi.string().optional(),
    reference_number: Joi.string().optional(),
    card_last_4_digits: Joi.string().length(4).optional(),
    payment_gateway: Joi.string().optional(),
    notes: Joi.string().optional(),
    // Accepted for backwards compatibility but ignored: the server always
    // uses the authenticated user from the JWT.
    processed_by: Joi.string().uuid().optional(),
  }),
};

export const getPaymentHistorySchema = {
  params: Joi.object({
    orderId: Joi.string().uuid().required(),
  }),
};

export const refundPaymentSchema = {
  params: Joi.object({
    orderId: Joi.string().uuid().required(),
    paymentId: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    refund_amount: Joi.number().positive().precision(2).required(),
    reason: Joi.string().required(),
    // Accepted for backwards compatibility but ignored: the server always
    // uses the authenticated user from the JWT.
    refunded_by: Joi.string().uuid().optional(),
    approved_by: Joi.string().uuid().optional(),
  }),
};