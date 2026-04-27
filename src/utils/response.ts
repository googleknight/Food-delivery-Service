import { Response } from "express";

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: PaginationMeta,
): void {
  const response: Record<string, unknown> = {
    success: true,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, string>[],
): void {
  const response: Record<string, unknown> = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details && details.length > 0) {
    (response.error as Record<string, unknown>).details = details;
  }

  res.status(statusCode).json(response);
}
