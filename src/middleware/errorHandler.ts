import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";
import { HTTP_STATUS } from "../config/constants";
import config from "../config/environment";

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;

  let message = "Internal server error";
  let isOperational = false;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  }

  // Log error
  logger.error(
    `${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`
  );

  if (!isOperational) {
    logger.error(`Stack: ${err.stack}`);
  }

  // Send error response
  const response: any = {
    success: false,
    message,
  };

  // Include stack trace in development
  if (config.env === "development") {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
