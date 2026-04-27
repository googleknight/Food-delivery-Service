import { Request, Response, NextFunction } from "express";
import * as restaurantsService from "./restaurants.service";
import { sendSuccess } from "@utils/response";
import { AuthenticatedRequest, parsePagination, PaginationQuery } from "@types";

export async function listRestaurants(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const pagination = parsePagination(req.query as PaginationQuery);
    const fieldsParam = (req.query as PaginationQuery).fields;
    const { restaurants, total } = await restaurantsService.listRestaurants(
      pagination,
      user,
      fieldsParam,
    );
    sendSuccess(res, restaurants, 200, {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function getRestaurantById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const fieldsParam = (req.query as PaginationQuery).fields;
    const restaurant = await restaurantsService.getRestaurantById(
      req.params.id as string,
      user,
      fieldsParam,
    );
    sendSuccess(res, restaurant);
  } catch (error) {
    next(error);
  }
}

export async function createRestaurant(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const restaurant = await restaurantsService.createRestaurant(
      req.body,
      user.id,
    );
    sendSuccess(res, restaurant, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateRestaurant(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const restaurant = await restaurantsService.updateRestaurant(
      req.params.id as string,
      req.body,
      user,
    );
    sendSuccess(res, restaurant);
  } catch (error) {
    next(error);
  }
}

export async function deleteRestaurant(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    await restaurantsService.deleteRestaurant(req.params.id as string, user);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function blockRestaurant(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const restaurant = await restaurantsService.blockRestaurant(
      req.params.id as string,
      req.body.isBlocked,
    );
    sendSuccess(res, restaurant);
  } catch (error) {
    next(error);
  }
}
