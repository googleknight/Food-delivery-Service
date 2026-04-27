import { Request, Response, NextFunction } from "express";
import * as ordersService from "./orders.service";
import { sendSuccess } from "@utils/response";
import { AuthenticatedRequest, parsePagination, PaginationQuery } from "@types";

export async function createOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const order = await ordersService.createOrder(req.body, user);
    sendSuccess(res, order, 201);
  } catch (error) {
    next(error);
  }
}

export async function listOrders(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const pagination = parsePagination(req.query as PaginationQuery);
    const fieldsParam = (req.query as PaginationQuery).fields;
    const statusFilter = req.query.status as string | undefined;
    const { orders, total } = await ordersService.listOrders(
      pagination,
      user,
      fieldsParam,
      statusFilter,
    );
    sendSuccess(res, orders, 200, {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function getOrderById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const order = await ordersService.getOrderById(
      req.params.id as string,
      user,
    );
    sendSuccess(res, order);
  } catch (error) {
    next(error);
  }
}

export async function updateOrderStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const order = await ordersService.updateOrderStatus(
      req.params.id as string,
      req.body,
      user,
    );
    sendSuccess(res, order);
  } catch (error) {
    next(error);
  }
}
