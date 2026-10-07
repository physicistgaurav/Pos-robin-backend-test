import Joi from "joi";

export const createCategorySchema = {
  body: Joi.object({
    name: Joi.string().trim().max(255).required(),
    
    type: Joi.string()
      .valid("main", "sub")
      .required()
      .messages({
        "any.only": "type must be either 'main' or 'sub'",
      }),
    
    parent_id: Joi.string()
      .uuid({ version: "uuidv4" })
      .when("type", {
        is: "main",
        then: Joi.forbidden().messages({
          "any.unknown": "parent_id must not be provided for type 'main'",
        }),
        otherwise: Joi.required().messages({
          "any.required": "parent_id is required for type 'sub'",
        }),
      }),
    
      display_order: Joi.number().integer().min(0).optional(),
    
    is_active: Joi.boolean().default(true),
    
    description: Joi.string().trim().allow("", null).optional(),
    image_url: Joi.string().uri().allow(null, "").optional(),
  }),
};

// Update Category Schema
export const updateCategorySchema = {
  params: Joi.object({
    id: Joi.string().uuid({ version: "uuidv4" }).required(),
  }),
  body: Joi.object({
    name: Joi.string().trim().max(255).optional(),
    is_active: Joi.boolean().optional(),
    parent_id: Joi.string().optional(),
    description: Joi.string().trim().allow("", null).optional(),
    image_url:Joi.string().uri().allow(null, "").optional(),
    })
    .min(1) // at least one field to update
    .messages({
      "object.min": "At least one field must be provided for update",
    }),
};


// Reorder Categories Schema (for drag & drop reordering under same parent)
export const reorderCategoriesSchema = {
  body: Joi.object({
    parent_id: Joi.string()
      .uuid({ version: "uuidv4" })
      .allow(null)
      .required(),

    items: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().uuid({ version: "uuidv4" }).required(),
          display_order: Joi.number().integer().min(0).required(),
        })
      )
      .min(1)
      .required(),
  }),
};
