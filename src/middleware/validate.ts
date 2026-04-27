import { Request, Response, NextFunction } from "express";
import { ZodType, ZodError } from "zod";
import { ValidationError } from "@utils/errors";
import { ERROR_MESSAGES } from "@constants/messages";

interface ValidateOptions {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export function validate(schemas: ValidateOptions) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(
          req.query,
        ) as unknown as typeof req.query;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(
          req.params,
        ) as unknown as typeof req.params;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));
        next(
          new ValidationError(ERROR_MESSAGES.SYSTEM.VALIDATION_FAILED, details),
        );
      } else {
        next(error);
      }
    }
  };
}
