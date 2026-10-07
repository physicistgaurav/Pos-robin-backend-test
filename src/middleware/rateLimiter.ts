import rateLimit from "express-rate-limit";
import config from "../config/environment";

export const generalLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  message: "Too many requests from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: "Too many authentication attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// Per IP address:

// ❌ Max 5 failed auth attempts

// ⏱️ Within 15 minutes

// ✅ Successful attempts don’t count

// ⛔ On 6th failed attempt → blocked for 15 minutes
