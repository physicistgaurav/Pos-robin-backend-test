import dotenv from "dotenv";
import path from "path";
import { SignOptions } from "jsonwebtoken";

dotenv.config({ path: path.join(__dirname, "../../.env") });

interface Config {
  env: string;
  port: number;
  apiVersion: string;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    poolMin: number;
    poolMax: number;
  };
  jwt: {
    secret: string;
    expiresIn: SignOptions["expiresIn"];
    refreshSecret: string;
    refreshExpiresIn: SignOptions["expiresIn"];
  };
  security: {
    bcryptRounds: number;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
  };
  logging: {
    level: string;
  };
  cors: {
    allowedOrigins: string[];
  };
}

const config: Config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "2132", 10),
  apiVersion: process.env.API_VERSION || "v1",
  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    name: process.env.DB_NAME || "hotel_management_old_garden",
    user: process.env.DB_USER || "lizardking",
    password: process.env.DB_PASSWORD || "",
    poolMin: parseInt(process.env.DB_POOL_MIN || "2", 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || "10", 10),
  },
  jwt: {
    secret: (process.env.JWT_SECRET || "change_this_secret") as string,
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"],
    refreshSecret: (process.env.JWT_REFRESH_SECRET ||
      "change_this_refresh_secret") as string,
    refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ||
      "30d") as SignOptions["expiresIn"],
  },
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "10", 10),
    rateLimitWindowMs: parseInt(
      process.env.RATE_LIMIT_WINDOW_MS || "900000",
      10
    ),
    rateLimitMaxRequests: parseInt(
      process.env.RATE_LIMIT_MAX_REQUESTS || "100",
      10
    ),
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
    ],
  },
};


export default config;
