import { Request } from "express";
import { Role } from "@prisma/client";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  type: "refresh";
  jti: string;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  fields?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
  search?: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

import { SORT_ORDER } from "../constants/prisma";
import { PAGINATION_DEFAULTS } from "../constants/pagination";

export function parsePagination(query: PaginationQuery): PaginationOptions {
  const page = Math.max(
    PAGINATION_DEFAULTS.PAGE,
    parseInt(query.page || PAGINATION_DEFAULTS.PAGE.toString(), 10) ||
      PAGINATION_DEFAULTS.PAGE,
  );
  const limit = Math.min(
    PAGINATION_DEFAULTS.MAX_LIMIT,
    Math.max(
      1,
      parseInt(query.limit || PAGINATION_DEFAULTS.LIMIT.toString(), 10) ||
        PAGINATION_DEFAULTS.LIMIT,
    ),
  );
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy || PAGINATION_DEFAULTS.SORT_BY;
  const sortOrder =
    query.sortOrder === SORT_ORDER.ASC
      ? SORT_ORDER.ASC
      : PAGINATION_DEFAULTS.SORT_ORDER;
  const search = query.search?.trim() || undefined;

  return { page, limit, skip, search, sortBy, sortOrder };
}
