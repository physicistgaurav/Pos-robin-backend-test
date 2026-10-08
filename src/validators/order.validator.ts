import Joi from "joi";
import { ORDER_STATUS } from "../config/constants";

const statuses = Object.values(ORDER_STATUS);

export const idParamSchema = {
  params: Joi.object({
    id: Joi.string().guid({version:"uuidv4"}).required(),
  }),
};

export const createOrderSchema = {
  body: Joi.object({
    order: Joi.object({
      order_type: Joi.string()
        .valid("dine_in", "takeaway", "delivery", "online")
        .required(),

      table_id: Joi.string()
        .guid({ version: "uuidv4" })
        .optional(),

      customer_name: Joi.string().max(255).optional(),
      customer_phone: Joi.string().max(20).optional(),
      customer_email: Joi.string().email().optional(),

      delivery_address: Joi.string().optional(),
      delivery_instructions: Joi.string().optional(),

      special_instructions: Joi.string().optional(),
      kitchen_notes: Joi.string().optional(),

      tax_percentage: Joi.number().min(0).max(100).optional(),
      service_charge_percentage: Joi.number().min(0).max(100).optional(),
    }),

    items: Joi.array()
      .items(
        Joi.object({
          product_id: Joi.string()
            .guid({ version: "uuidv4" })
            .required(),

          quantity: Joi.number().integer().min(1).required(),

          variant_name: Joi.string().max(255).optional(),
          customizations: Joi.string().optional(),
          special_instructions: Joi.string().max(500).optional(),
        })
      )
      .min(1)
      .required(),
  }),
};

export const getOrdersSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional().default(1),
    limit: Joi.number().integer().min(1).max(100).optional().default(100),
    status: Joi.string()
      .valid(...statuses)
      .optional(),
    table_id: Joi.string().optional(),
    order_type: Joi.string().optional(),
    payment_status: Joi.string().optional(),
    delivery_status: Joi.string().optional(),
    start_date: Joi.date().iso().optional(),
    end_date: Joi.date().iso().min(Joi.ref("start_date")).optional(),
  }),
};

export const searchOrdersSchema = {
  query: Joi.object({
    q: Joi.string().optional(), // search term (order_number, phone, name)
    status: Joi.string().valid("pending", "confirmed", "preparing", "ready", "served", "completed", "cancelled").optional(),
    payment_status: Joi.string().valid("unpaid", "partial", "paid", "refunded").optional(),
    order_type: Joi.string().valid("dine_in", "takeaway", "delivery", "online").optional(),
    from_date: Joi.date().iso().optional(),
    to_date: Joi.date().iso().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

export const queryBaseSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional().default(1),
    limit: Joi.number().integer().min(1).max(100).optional().default(10),
  }),
};

export const updateOrderSchema = {
  params: Joi.object({
    id: Joi.string().guid({ version: "uuidv4" }).required(),
  }),
  body: Joi.object({
    status: Joi.string()
      .valid(
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "served",
        // "completed",
        "cancelled"
      )
      .optional(),

    //do from payment api
    // payment_status: Joi.string()
    //   .valid("unpaid", "partial", "paid", "refunded")
    //   .optional(),

    table_id: Joi.string().uuid().allow(null).optional(),
    served_by: Joi.string().uuid().allow(null).optional(),
    order_type: Joi.string()
      .valid(
        "dine_in",
        "takeaway",
        "delivery",
        "online",
      )
      .optional(),
    customer_name: Joi.string().max(255).optional(),
    customer_phone: Joi.string().max(20).optional(),
    customer_email: Joi.string().email().optional(),

    delivery_address: Joi.string().optional(),
    delivery_instructions: Joi.string().optional(),

    special_instructions: Joi.string().optional(),
    kitchen_notes: Joi.string().optional(),

    estimated_prep_time: Joi.number().integer().positive().optional(),
    estimated_delivery_time: Joi.date().optional(),

    cancellation_reason: Joi.string().optional()
  }).unknown(false)
};

export const cancelOrderSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required()
  }),

  body: Joi.object({
    reason: Joi.string().min(3).required()
  }).unknown(false)
};

export const addItemsToOrderSchema = {
  params: Joi.object({
    id: Joi.string().guid({ version: "uuidv4" }).required(),
  }),
  body: Joi.object({
    items: Joi.array()
      .items(
        Joi.object({
          product_id: Joi.string()
            .guid({ version: "uuidv4" })
            .required(),

          quantity: Joi.number().integer().min(1).required(),

          variant_name: Joi.string().max(255).optional(),
          customizations: Joi.string().optional(),
          special_instructions: Joi.string().max(500).optional(),
        })
      )
      .min(1)
      .required(),
  }),
};

export const updateOrderItemSchema = {
  params: Joi.object({
    id: Joi.string().guid({ version: "uuidv4" }).required(),        // orderId
    itemId: Joi.string().guid({ version: "uuidv4" }).required(),    // order_item id
  }),
  body: Joi.object({
    quantity: Joi.number().integer().min(1).optional(),
    special_instructions: Joi.string().max(500).allow("").optional(),
    variant_name: Joi.string().max(255).allow(null, "").optional(),
    customizations: Joi.string().allow(null, "").optional(),
    item_status: Joi.string()
      .valid("pending", "confirmed", "preparing", "ready")
      .optional(),

  }).min(1), // at least one field must be provided
};

export const deleteOrderItemSchema = {
  params: Joi.object({
    id: Joi.string().guid({ version: "uuidv4" }).required(),
    itemId: Joi.string().guid({ version: "uuidv4" }).required(),
  }),
};

export const updateOrderItemStatusSchema = {
  params: Joi.object({
    id: Joi.string().guid({ version: "uuidv4" }).required(),
    itemId: Joi.string().guid({ version: "uuidv4" }).required(),
  }),
  body: Joi.object({
    item_status: Joi.string()
      .valid("pending", "confirmed", "preparing", "ready")
      .required(),
  }),
};

export const applyDiscountSchema = {
  params: Joi.object({
    id: Joi.string().guid({ version: "uuidv4" }).required(),
  }),
  body: Joi.object({
    discount_type: Joi.string().valid("percentage", "fixed", "coupon").required(),
    discount_value: Joi.number().min(0).required(),
    discount_reason: Joi.string().max(255).required(),
  }),
};