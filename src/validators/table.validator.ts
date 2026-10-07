import Joi from "joi";
import { TABLE_STATUS } from "../config/constants";

const statuses = Object.values(TABLE_STATUS);

export const createTableSchema = {
  body: Joi.object({
    table_number: Joi.number().integer().positive().required(),
    table_name: Joi.string().optional(),

    capacity: Joi.number().integer().min(1).max(50).required(),

    status: Joi.string()
      .valid(...statuses)
      .optional()
      .default("available"),
    location: Joi.string().max(100).optional(),

    is_active: Joi.boolean().default(true),
  }),
};

export const updateTableSchema = {
  params: Joi.object({
    id: Joi.string().required(),
  }),
  body: Joi.object({
    table_number: Joi.string().max(20).optional(),
    table_name: Joi.string().optional(),
    capacity: Joi.number().integer().min(1).max(50).optional(),
    status: Joi.string()
      .valid(...statuses)
      .optional(),
    location: Joi.string().max(100).optional(),
    is_active: Joi.boolean().optional(),
  }).min(1),
};
