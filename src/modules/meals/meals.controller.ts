import { Request, Response, NextFunction } from "express";
import * as mealsService from "./meals.service";
import { sendSuccess } from "@utils/response";
import { AuthenticatedRequest, parsePagination, PaginationQuery } from "@types";

export async function listMeals(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const pagination = parsePagination(req.query as PaginationQuery);
    const fieldsParam = (req.query as PaginationQuery).fields;
    const { meals, total } = await mealsService.listMeals(
      req.params.restaurantId as string,
      pagination,
      user,
      fieldsParam,
    );
    sendSuccess(res, meals, 200, {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function getMealById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const fieldsParam = (req.query as PaginationQuery).fields;
    const meal = await mealsService.getMealById(
      req.params.restaurantId as string,
      req.params.id as string,
      fieldsParam,
    );
    sendSuccess(res, meal);
  } catch (error) {
    next(error);
  }
}

export async function createMeal(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const meal = await mealsService.createMeal(
      req.params.restaurantId as string,
      req.body,
      user,
    );
    sendSuccess(res, meal, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateMeal(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const meal = await mealsService.updateMeal(
      req.params.restaurantId as string,
      req.params.id as string,
      req.body,
      user,
    );
    sendSuccess(res, meal);
  } catch (error) {
    next(error);
  }
}

export async function deleteMeal(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    await mealsService.deleteMeal(
      req.params.restaurantId as string,
      req.params.id as string,
      user,
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
