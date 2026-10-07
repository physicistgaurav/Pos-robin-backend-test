import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { ApiError } from "../utils/ApiError";

export const validateRequest = (schema: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const validationOptions = {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true,
    };

    const errors: string[] = [];

    if (schema.body) {
      const { error, value } = schema.body.validate(
        req.body,
        validationOptions
      );
      if (error) {
        errors.push(...error.details.map((detail) => detail.message));
      } else {
        req.body = value;
      }
    }

    if (schema.query) {
      const { error, value } = schema.query.validate(
        req.query,
        validationOptions
      );
      if (error) {
        errors.push(...error.details.map((detail) => detail.message));
      } else {
        req.query = value;
      }
    }

    if (schema.params) {
      const { error, value } = schema.params.validate(
        req.params,
        validationOptions
      );
      if (error) {
        errors.push(...error.details.map((detail) => detail.message));
      } else {
        req.params = value;
      }
    }

    if (errors.length > 0) {
      throw ApiError.badRequest(errors.join(", "));
    }

    next();
  };
};
