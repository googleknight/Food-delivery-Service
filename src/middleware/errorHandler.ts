import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "@utils/errors";
import { sendError } from "@utils/response";
import pino from "pino";
import { ERROR_MESSAGES } from "@constants/messages";

const logger = pino({
  level: process.env.NODE_ENV === "test" ? "silent" : "error",
});

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Custom AppError hierarchy
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        const target = (err.meta?.target as string[])?.join(", ") || "field";
        sendError(res, 409, "CONFLICT", ERROR_MESSAGES.SYSTEM.CONFLICT(target));
        return;
      }
      case "P2025": {
        sendError(
          res,
          404,
          "NOT_FOUND",
          ERROR_MESSAGES.SYSTEM.RECORD_NOT_FOUND,
        );
        return;
      }
      case "P2003": {
        sendError(
          res,
          400,
          "FOREIGN_KEY_ERROR",
          ERROR_MESSAGES.SYSTEM.REFERENCE_ERROR,
        );
        return;
      }
      default:
        break;
    }
  }

  // Prisma validation error
  if (err instanceof Prisma.PrismaClientValidationError) {
    sendError(res, 400, "VALIDATION_ERROR", ERROR_MESSAGES.SYSTEM.INVALID_DATA);
    return;
  }

  // JWT errors (caught in authenticate middleware, but just in case)
  if (err.name === "JsonWebTokenError") {
    sendError(
      res,
      401,
      "UNAUTHORIZED",
      ERROR_MESSAGES.AUTH.INVALID_TOKEN_ACCESS,
    );
    return;
  }

  if (err.name === "TokenExpiredError") {
    sendError(
      res,
      401,
      "UNAUTHORIZED",
      ERROR_MESSAGES.AUTH.TOKEN_EXPIRED_ACCESS,
    );
    return;
  }

  // Unexpected errors
  logger.error({ err }, "Unhandled error");
  sendError(
    res,
    500,
    "INTERNAL_SERVER_ERROR",
    process.env.NODE_ENV === "production"
      ? ERROR_MESSAGES.SYSTEM.UNEXPECTED_ERROR
      : err.message,
  );
}
