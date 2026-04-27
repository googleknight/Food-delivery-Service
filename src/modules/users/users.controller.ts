import { Request, Response, NextFunction } from "express";
import * as usersService from "./users.service";
import { sendSuccess } from "@utils/response";
import { parsePagination, PaginationQuery } from "@types";

export async function listUsers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const pagination = parsePagination(req.query as PaginationQuery);
    const fieldsParam = (req.query as PaginationQuery).fields;
    const { users, total } = await usersService.listUsers(
      pagination,
      fieldsParam,
    );
    sendSuccess(res, users, 200, {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function getUserById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const fieldsParam = (req.query as PaginationQuery).fields;
    const user = await usersService.getUserById(
      req.params.id as string,
      fieldsParam,
    );
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
}

export async function createUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await usersService.createUser(req.body);
    sendSuccess(res, user, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await usersService.updateUser(
      req.params.id as string,
      req.body,
    );
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    await usersService.deleteUser(req.params.id as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function blockUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await usersService.blockUser(
      req.params.id as string,
      req.body.isBlocked,
    );
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
}
