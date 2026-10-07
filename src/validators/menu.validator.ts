import Joi from "joi";
import { MENU_CATEGORY } from "../config/constants";

const categories = Object.values(MENU_CATEGORY);

export const createMenuItemSchema = {
  body: Joi.object({
    name: Joi.string().required().min(2).max(255),
    description: Joi.string().optional().max(1000),
    category: Joi.string()
      .valid(...categories)
      .required(),
    price: Joi.number().required().min(0).precision(2),
    image_url: Joi.string().uri().optional(),
    is_available: Joi.boolean().optional().default(true),
    preparation_time: Joi.number().integer().min(1).optional().default(15),
  }),
};

export const updateMenuItemSchema = {
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
  body: Joi.object({
    name: Joi.string().min(2).max(255).optional(),
    description: Joi.string().max(1000).optional(),
    category: Joi.string()
      .valid(...categories)
      .optional(),
    price: Joi.number().min(0).precision(2).optional(),
    image_url: Joi.string().uri().optional(),
    is_available: Joi.boolean().optional(),
    preparation_time: Joi.number().integer().min(1).optional(),
  }).min(1),
};

export const getMenuItemsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional().default(1),
    limit: Joi.number().integer().min(1).max(100).optional().default(10),
    category: Joi.string()
      .valid(...categories)
      .optional(),
    is_available: Joi.boolean().optional(),
    min_price: Joi.number().min(0).optional(),
    max_price: Joi.number().min(0).optional(),
    search: Joi.string().optional(),
  }),
};

export const idParamSchema = {
  params: Joi.object({
    id: Joi.string().guid({version:"uuidv4"}).required(),
  }),
};
