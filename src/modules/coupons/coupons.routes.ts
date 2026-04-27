import { Router } from "express";
import * as couponsController from "./coupons.controller";
import { Role } from "@prisma/client";
import { authenticate } from "@middleware/authenticate";
import { authorize } from "@middleware/authorize";
import { validate } from "@middleware/validate";
import {
  createCouponSchema,
  updateCouponSchema,
  couponParamsSchema,
  couponRestaurantParamSchema,
} from "./coupons.schema";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get(
  "/",
  validate({ params: couponRestaurantParamSchema }),
  couponsController.listCoupons,
);

router.post(
  "/",
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  validate({ params: couponRestaurantParamSchema, body: createCouponSchema }),
  couponsController.createCoupon,
);

router.patch(
  "/:id",
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  validate({ params: couponParamsSchema, body: updateCouponSchema }),
  couponsController.updateCoupon,
);

router.delete(
  "/:id",
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  validate({ params: couponParamsSchema }),
  couponsController.deleteCoupon,
);

export default router;
