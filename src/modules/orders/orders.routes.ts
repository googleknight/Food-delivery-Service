import { Router } from "express";
import * as ordersController from "./orders.controller";
import { Role } from "@prisma/client";
import { authenticate } from "@middleware/authenticate";
import { authorize } from "@middleware/authorize";
import { validate } from "@middleware/validate";
import {
  createOrderSchema,
  updateOrderStatusSchema,
  orderIdParamSchema,
} from "./orders.schema";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  authorize(Role.CUSTOMER),
  validate({ body: createOrderSchema }),
  ordersController.createOrder,
);

router.get("/", ordersController.listOrders);

router.get(
  "/:id",
  validate({ params: orderIdParamSchema }),
  ordersController.getOrderById,
);

router.patch(
  "/:id/status",
  validate({ params: orderIdParamSchema, body: updateOrderStatusSchema }),
  ordersController.updateOrderStatus,
);

export default router;
