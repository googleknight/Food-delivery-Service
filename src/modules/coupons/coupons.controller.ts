import { Request, Response, NextFunction } from "express";
import * as couponsService from "./coupons.service";
import { sendSuccess } from "@utils/response";
import { AuthenticatedRequest, parsePagination, PaginationQuery } from "@types";

export async function listCoupons(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const pagination = parsePagination(req.query as PaginationQuery);
    const fieldsParam = (req.query as PaginationQuery).fields;
    const { coupons, total } = await couponsService.listCoupons(
      req.params.restaurantId as string,
      pagination,
      fieldsParam,
    );
    sendSuccess(res, coupons, 200, {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function createCoupon(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const coupon = await couponsService.createCoupon(
      req.params.restaurantId as string,
      req.body,
      user,
    );
    sendSuccess(res, coupon, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateCoupon(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const coupon = await couponsService.updateCoupon(
      req.params.restaurantId as string,
      req.params.id as string,
      req.body,
      user,
    );
    sendSuccess(res, coupon);
  } catch (error) {
    next(error);
  }
}

export async function deleteCoupon(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    await couponsService.deleteCoupon(
      req.params.restaurantId as string,
      req.params.id as string,
      user,
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
