import Joi from "joi";

export const createProductSchema = {
  body: Joi.object({
    // Required
    name: Joi.string().trim().max(255).required(),
    category_id: Joi.string().uuid({ version: "uuidv4" }).required(),
    selling_price: Joi.number().min(0).required(),

    // Optional core fields
    slug: Joi.string().trim().max(255).optional(),
    description: Joi.string().allow("", null).optional(),
    short_description: Joi.string().max(500).allow("", null).optional(),

    type: Joi.string().valid("simple", "variant", "combo").default("simple"),

    status: Joi.string()
      .valid("draft", "active", "inactive", "out_of_stock")
      .default("active"),

    compare_at_price: Joi.number().min(0).optional(),

    // Food-specific
    prep_time: Joi.number().integer().min(0).optional(),
    cooking_time: Joi.number().integer().min(0).optional(),
    calories: Joi.number().integer().min(0).optional(),
    spice_level: Joi.number().integer().min(0).max(5).optional(),

    is_vegetarian: Joi.boolean().default(false),
    is_vegan: Joi.boolean().default(false),
    is_gluten_free: Joi.boolean().default(false),

    allergen_info: Joi.array().items(Joi.string()).optional(),
    ingredients: Joi.array().items(Joi.string()).optional(),

    // Display & Marketing
    featured: Joi.boolean().default(false),
    is_bestseller: Joi.boolean().default(false),
    is_new_arrival: Joi.boolean().default(false),
    display_order: Joi.number().integer().min(0).default(0),

    is_active: Joi.boolean().default(true),
    is_visible_in_menu: Joi.boolean().default(true),
    is_available_for_delivery: Joi.boolean().default(true),
    is_available_for_pickup: Joi.boolean().default(true),

    // Images
    image_url: Joi.string().uri().allow("", null).optional(),
    gallery_images: Joi.array().items(Joi.string().uri()).optional(),
    thumbnail_url: Joi.string().uri().allow("", null).optional(),


    department: Joi.string().valid("kitchen", "bar").default("kitchen"),

    is_inventory_tracked: Joi.boolean().default(false)
  }),
};

export const updateProductSchema = {
  body: Joi.object({
    name: Joi.string().trim().max(255).optional(),
    description: Joi.string().allow("", null).optional(),
    short_description: Joi.string().max(500).allow("", null).optional(),

    category_id: Joi.string().uuid({ version: "uuidv4" }).optional(),
    type: Joi.string().valid("simple", "variant", "combo").optional(),
    status: Joi.string()
      .valid("draft", "active", "inactive", "out_of_stock")
      .optional(),

    selling_price: Joi.number().min(0).optional(),
    compare_at_price: Joi.number().min(0).optional(),

    department: Joi.string().valid("kitchen", "bar").optional(),

    is_inventory_tracked: Joi.boolean().optional(),

    // Food-specific
    prep_time: Joi.number().integer().min(0).optional(),
    cooking_time: Joi.number().integer().min(0).optional(),
    calories: Joi.number().integer().min(0).optional(),
    spice_level: Joi.number().integer().min(0).max(5).optional(),

    is_vegetarian: Joi.boolean().optional(),
    is_vegan: Joi.boolean().optional(),
    is_gluten_free: Joi.boolean().optional(),

    allergen_info: Joi.array().items(Joi.string()).optional(),
    ingredients: Joi.array().items(Joi.string()).optional(),

    // Display & Marketing
    featured: Joi.boolean().optional(),
    is_bestseller: Joi.boolean().optional(),
    is_new_arrival: Joi.boolean().optional(),
    display_order: Joi.number().integer().min(0).optional(),

    is_active: Joi.boolean().optional(),
    is_visible_in_menu: Joi.boolean().optional(),
    is_available_for_delivery: Joi.boolean().optional(),
    is_available_for_pickup: Joi.boolean().optional(),

    // Images
    image_url: Joi.string().uri().allow("", null).optional(),
    gallery_images: Joi.array().items(Joi.string().uri()).optional(),
    thumbnail_url: Joi.string().uri().allow("", null).optional(),
  })
    .min(1) // at least one field required
    .custom((value, helpers) => {
      // compare_at_price logic
      if (
        value.compare_at_price !== undefined &&
        value.selling_price !== undefined &&
        value.compare_at_price < value.selling_price
      ) {
        return helpers.error("any.invalid");
      }
      return value;
    }, "Price validation")
    .messages({
      "any.invalid":
        "compare_at_price must be greater than or equal to selling_price",
    })
    .unknown(false), // 🚫 block unexpected fields
};

export const updateProductStatusSchema = {
  body: Joi.object({
    status: Joi.string()
      .valid("draft", "active", "inactive", "out_of_stock")
      .required(),
  }),
};

export const reorderProductsSchema = {
  body: Joi.object({
    category_id: Joi.string().uuid({ version: "uuidv4" }).required(),
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
