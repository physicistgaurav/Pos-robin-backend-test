import Joi from 'joi';

export const createInvoiceSchema = {
  body: Joi.object({
    order_id: Joi.string().uuid().required(),
    credit_customer_id: Joi.string().uuid().optional(),
    invoice_type: Joi.string()
      .valid('tax_invoice', 'simplified_invoice', 'credit_note', 'proforma')
      .default('tax_invoice'),
    due_date: Joi.date().optional(),
    pan_number: Joi.string().optional(),
    notes: Joi.string().optional(),
    created_by: Joi.string().uuid().required(),
  }),
};

export const updateInvoiceSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    due_date: Joi.date().optional(),
    notes: Joi.string().optional(),
  }).min(1),
};

export const getInvoiceSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};

export const emailInvoiceSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    email: Joi.string().email().required(),
    subject: Joi.string().optional(),
    message: Joi.string().optional(),
  }),
};

export const queryInvoicesSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    payment_status: Joi.string()
      .valid('unpaid', 'partial', 'paid', 'refunded')
      .optional(),
    start_date: Joi.date().optional(),
    end_date: Joi.date().optional(),
    credit_customer_id: Joi.string().uuid().optional(),
    search: Joi.string().optional(),
  }),
};