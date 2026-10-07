import Joi from 'joi';

const INCOMING_CATEGORIES = [
  'sales_revenue', 'investment', 'loan_received', 'refund_received', 'other_income',
];
const OUTGOING_CATEGORIES = [
  'inventory_purchase', 'salary', 'utility', 'rent', 'maintenance',
  'marketing', 'tax_payment', 'loan_repayment', 'petty_cash', 'other_expense',
];
const ALL_CATEGORIES = [...INCOMING_CATEGORIES, ...OUTGOING_CATEGORIES];
const PAYMENT_METHODS = ['cash', 'credit', 'debit_card', 'online', 'connectIPS', 'esewa', 'khalti', 'fonepay'];

export const createStoreTransactionSchema = {
  body: Joi.object({
    type: Joi.string().valid('incoming', 'outgoing').required(),
    category: Joi.string().valid(...ALL_CATEGORIES).required(),
    amount: Joi.number().positive().precision(2).required(),
    description: Joi.string().max(500).optional(),
    payment_method: Joi.string().valid(...PAYMENT_METHODS).optional(),
    reference_number: Joi.string().max(100).optional(),
    party_name: Joi.string().max(255).optional(),
    party_contact: Joi.string().max(20).optional(),
    attachment_url: Joi.string().uri().optional(),
    notes: Joi.string().max(1000).optional(),
    transaction_date: Joi.date().iso().default(() => new Date()),
    created_by: Joi.string().uuid().required(),

    // If category=inventory_purchase, optionally link stock movement
    inventory_purchase: Joi.when('category', {
      is: 'inventory_purchase',
      then: Joi.object({
        product_id: Joi.string().uuid().required(),
        quantity: Joi.number().positive().required(),
        unit_cost: Joi.number().positive().required(),
        supplier_name: Joi.string().max(255).optional(),
        supplier_invoice: Joi.string().max(100).optional(),
      }).optional(),
      otherwise: Joi.forbidden(),
    }),
  }).custom((value, helpers) => {
    // Validate category matches type
    if (value.type === 'incoming' && !INCOMING_CATEGORIES.includes(value.category)) {
      return helpers.error('any.invalid');
    }
    if (value.type === 'outgoing' && !OUTGOING_CATEGORIES.includes(value.category)) {
      return helpers.error('any.invalid');
    }
    return value;
  }),
};


export const voidTransactionSchema = {
  params: Joi.object({ id: Joi.string().uuid().required() }),
  body: Joi.object({
    void_reason: Joi.string().max(500).required(),
    voided_by: Joi.string().uuid().required(),
  }),
};

export const updateStoreTransactionSchema = {
  params: Joi.object({ id: Joi.string().uuid().required() }),
  body: Joi.object({
    description: Joi.string().max(500).optional(),
    payment_method: Joi.string().valid(...PAYMENT_METHODS).optional(),
    reference_number: Joi.string().max(100).optional(),
    party_name: Joi.string().max(255).optional(),
    party_contact: Joi.string().max(20).optional(),
    attachment_url: Joi.string().uri().optional(),
    notes: Joi.string().max(1000).optional(),
    transaction_date: Joi.date().iso().optional(),
  }),
};

export const getTransactionsSchema = {
  query: Joi.object({
    type: Joi.string().valid('incoming', 'outgoing').optional(),
    category: Joi.string().valid(...ALL_CATEGORIES).optional(),
    from_date: Joi.date().iso().optional(),
    to_date: Joi.date().iso().min(Joi.ref('from_date')).optional(),
    payment_method: Joi.string().valid(...PAYMENT_METHODS).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

export const getTransactionByIdSchema = {
  params: Joi.object({ id: Joi.string().uuid().required() }),
};

export const getSummarySchema = {
  query: Joi.object({
    from_date: Joi.date().iso().optional(),
    to_date: Joi.date().iso().optional(),
  }),
};