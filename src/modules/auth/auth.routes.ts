import { Router } from "express";
import * as authController from "./auth.controller";
import { validate } from "@middleware/validate";
import { authenticate } from "@middleware/authenticate";
import { authRateLimiter } from "@middleware/rateLimiter";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  updateProfileSchema,
} from "./auth.schema";

const router = Router();

router.post(
  "/register",
  authRateLimiter,
  validate({ body: registerSchema }),
  authController.register,
);

router.post(
  "/login",
  authRateLimiter,
  validate({ body: loginSchema }),
  authController.login,
);

router.post(
  "/refresh",
  validate({ body: refreshTokenSchema }),
  authController.refresh,
);

router.post("/logout", authenticate, authController.logout);

router.get("/me", authenticate, authController.getProfile);

router.patch(
  "/me",
  authenticate,
  validate({ body: updateProfileSchema }),
  authController.updateProfile,
);

export default router;
