import Joi from 'joi';

export const createCreditCustomerSchema = {
  body: Joi.object({
    customer_name: Joi.string().required().max(255),
    customer_phone: Joi.string().required().max(20),
    customer_email: Joi.string().email().optional(),
    
    company_name: Joi.string().optional().max(255),
    company_registration: Joi.string().optional().max(100),
    pan_number: Joi.string().optional().max(20),
    
    billing_address: Joi.string().optional(),
    
    credit_limit: Joi.number().min(0).precision(2).required(),
    opening_balance: Joi.number().min(0).precision(2).optional().default(0),

    payment_terms_days: Joi.number().integer().min(1).default(30),
    
    contact_person: Joi.string().optional().max(255),
    contact_phone: Joi.string().optional().max(20),
    
    notes: Joi.string().optional(),
    internal_notes: Joi.string().optional(),
    
    created_by: Joi.string().uuid().required(),
  }),
};

export const updateCreditCustomerSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    customer_name: Joi.string().max(255).optional(),
    customer_phone: Joi.string().max(20).optional(),
    customer_email: Joi.string().email().optional(),
    
    company_name: Joi.string().max(255).optional(),
    company_registration: Joi.string().max(100).optional(),
    pan_number: Joi.string().max(20).optional(),
    
    billing_address: Joi.string().optional(),
    
    credit_limit: Joi.number().min(0).precision(2).optional(),
    payment_terms_days: Joi.number().integer().min(1).optional(),
    
    contact_person: Joi.string().max(255).optional(),
    contact_phone: Joi.string().max(20).optional(),
    
    notes: Joi.string().optional(),
    internal_notes: Joi.string().optional(),
  }).min(1),
};

export const getCreditCustomerSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};

export const updateCreditCustomerStatus = {
    params: Joi.object({
      id: Joi.string().uuid().required(),
    }),
    body: Joi.object({
        status: Joi.string().valid('active', 'suspended', 'closed').required(),
      }),
  };
  

export const recordPaymentSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    amount: Joi.number().positive().precision(2).required(),
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
    transaction_id: Joi.string().optional(),
    reference_number: Joi.string().optional(),
    notes: Joi.string().optional(),
    created_by: Joi.string().uuid().required(),
  }),
};

export const adjustBalanceSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    amount: Joi.number().precision(2).required(),
    reason: Joi.string().required(),
    created_by: Joi.string().uuid().required(),
  }),
};

export const queryCustomersSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('active', 'suspended', 'closed').optional(),
    search: Joi.string().optional(),
    has_balance: Joi.boolean().optional(),
  }),
};