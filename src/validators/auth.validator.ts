import Joi from "joi";

export const idParamSchema = {
  params: Joi.object({
    id: Joi.string().guid({version:"uuidv4"}).required(),
  }),
};

export const registerSchema = {
  body: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    password: Joi.string().min(6).required().messages({
      "string.min": "Password must be at least 6 characters long",
      "any.required": "Password is required",
    }),
    full_name: Joi.string().min(2).max(255).required().messages({
      "string.min": "Full name must be at least 2 characters long",
      "any.required": "Full name is required",
    }),
    role: Joi.string()
      .valid("staff", "waiter", "chef")  // Removed admin and manager roles
      .optional(),
  }),
};

export const loginSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
};

export const refreshTokenSchema = {
  body: Joi.object({
    refreshToken: Joi.string().required(),
  }),
};

export const createUserSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    full_name: Joi.string().min(2).max(255).required(),
    role: Joi.string().valid("staff", "waiter", "chef", "admin", "manager").required(),
    phone_number: Joi.string().optional(),
  }),
};

export const updateUserSchema = {
  params: Joi.object({
    id: Joi.string().uuid({ version: "uuidv4" }).required(),
  }),
  body: Joi.object({
    full_name: Joi.string().min(2).max(255).optional(),
    role: Joi.string()
      .valid("admin", "manager", "staff", "waiter", "chef")
      .optional(),
    is_active: Joi.boolean().optional(),
    phone_number: Joi.string().optional(),
  }).min(1),
};

export const changePasswordSchema = {
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required(),
  }),
};

export const changeUserRoleSchema = {
  body: Joi.object({
    role: Joi.string()
      .valid("admin", "manager", "staff", "waiter", "chef")
      .required(),
  }),
};

export const resetUserPasswordSchema = {
  params: Joi.object({
    id: Joi.string().uuid({ version: "uuidv4" }).required(),
  }),
  body: Joi.object({
    password: Joi.string().min(8).required(),
  }),
};