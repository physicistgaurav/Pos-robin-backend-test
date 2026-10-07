import Joi from 'joi';

const STOCK_UNITS = ['piece', 'bottle', 'can', 'glass', 'ml', 'liter', 'kg', 'gram', 'pack', 'carton', 'box'];
const MOVEMENT_TYPES = ['purchase', 'sale', 'adjustment', 'wastage', 'return', 'opening_stock'];

export const toggleInventoryTrackingSchema = {
  params: Joi.object({ id: Joi.string().uuid().required() }),
  body: Joi.object({
    is_inventory_tracked: Joi.boolean().required(),
    stock_unit: Joi.string().valid(...STOCK_UNITS).when('is_inventory_tracked', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    low_stock_threshold: Joi.number().min(0).default(0),
    reorder_quantity: Joi.number().min(0).default(0),
  }),
};

export const getInventoryProductsSchema = {
  query: Joi.object({
    stock_status: Joi.string().valid('ok', 'low_stock', 'out_of_stock').optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

export const getStockSchema = {
  query: Joi.object({
    product_id: Joi.string().uuid().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

export const adjustStockSchema = {
  params: Joi.object({ productId: Joi.string().uuid().required() }),
  body: Joi.object({
    quantity: Joi.number().required(),
    movement_type: Joi.string()
      .valid(
        'purchase',
        'opening_stock',
        'customer_return',
        'supplier_return',
        'adjustment',
        'sale',
        'wastage'
      )
      .required(),
    unit_cost: Joi.number().positive().optional(),
    reason: Joi.string().max(500).optional(),
    notes: Joi.string().max(1000).optional(),
    processed_by: Joi.string().uuid().required(),
  }),
};

export const purchaseStockSchema = {
  params: Joi.object({ productId: Joi.string().uuid().required() }),
  body: Joi.object({
    quantity: Joi.number().positive().required(),
    unit_cost: Joi.number().positive().required(),
    supplier_name: Joi.string().max(255).optional(),
    supplier_invoice: Joi.string().max(100).optional(),
    store_txn_id: Joi.string().uuid().optional(), // link to store transaction
    notes: Joi.string().max(1000).optional(),
    processed_by: Joi.string().uuid().required(),
  }),
};

export const wastageStockSchema = {
  params: Joi.object({ productId: Joi.string().uuid().required() }),
  body: Joi.object({
    quantity: Joi.number().positive().required(),
    reason: Joi.string().max(500).required(),
    notes: Joi.string().max(1000).optional(),
    processed_by: Joi.string().uuid().required(),
  }),
};

export const getMovementsSchema = {
  params: Joi.object({ productId: Joi.string().uuid().required() }),
  query: Joi.object({
    movement_type: Joi.string().valid(...MOVEMENT_TYPES).optional(),
    from_date: Joi.date().iso().optional(),
    to_date: Joi.date().iso().min(Joi.ref('from_date')).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};