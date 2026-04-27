import rateLimit from "express-rate-limit";
import { config } from "@config";
import { ERROR_MESSAGES } from "@constants/messages";

export const authRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: ERROR_MESSAGES.SYSTEM.RATE_LIMIT_EXCEEDED,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
