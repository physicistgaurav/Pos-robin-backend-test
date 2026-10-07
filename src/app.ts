import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
// import { generalLimiter } from "./middleware/rateLimiter";
import { ApiError } from "./utils/ApiError";
import config from "./config/environment";

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.cors.allowedOrigins,
    credentials: true, // this is for cookies setup
  })
);
app.use(compression());

// Rate limiting
// app.use(generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Request logging
app.use(requestLogger);

// API routes
app.use(`/api/${config.apiVersion}`, routes);

// Root route
app.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Hotel Management API",
    version: config.apiVersion,
    environment: config.env,
    endpoints: {
      health: `/api/${config.apiVersion}/health`,
      auth: `/api/${config.apiVersion}/auth`,
      menu: `/api/${config.apiVersion}/menu`,
      tables: `/api/${config.apiVersion}/tables`,
      orders: `/api/${config.apiVersion}/orders`,
      analytics: `/api/${config.apiVersion}/analytics`,
    },
  });
});

// 404 handler
app.use((req: Request, _res: Response, _next: NextFunction) => {
  throw ApiError.notFound(`Route ${req.originalUrl} not found`);
});

// Global error handler
app.use(errorHandler);

export default app;
