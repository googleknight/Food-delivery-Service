import { Router } from "express";
import * as usersController from "./users.controller";
import { Role } from "@prisma/client";
import { authenticate } from "@middleware/authenticate";
import { authorize } from "@middleware/authorize";
import { validate } from "@middleware/validate";
import {
  createUserSchema,
  updateUserSchema,
  blockUserSchema,
  userIdParamSchema,
} from "./users.schema";

const router = Router();

// All routes require admin
router.use(authenticate, authorize(Role.ADMIN));

router.get("/", usersController.listUsers);

router.get(
  "/:id",
  validate({ params: userIdParamSchema }),
  usersController.getUserById,
);

router.post(
  "/",
  validate({ body: createUserSchema }),
  usersController.createUser,
);

router.patch(
  "/:id",
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  usersController.updateUser,
);

router.delete(
  "/:id",
  validate({ params: userIdParamSchema }),
  usersController.deleteUser,
);

router.patch(
  "/:id/block",
  validate({ params: userIdParamSchema, body: blockUserSchema }),
  usersController.blockUser,
);

export default router;
