import { Request, Response, NextFunction } from "express";
import * as authService from "./auth.service";
import { sendSuccess } from "@utils/response";
import { AuthenticatedRequest } from "@types";

export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await authService.register(req.body);
    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.refreshTokens(req.body.refreshToken);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as AuthenticatedRequest).user;
    await authService.logout(user.id);
    sendSuccess(res, { message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
}

export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const profile = await authService.getProfile(user.id);
    sendSuccess(res, profile);
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const profile = await authService.updateProfile(user.id, req.body);
    sendSuccess(res, profile);
  } catch (error) {
    next(error);
  }
}
