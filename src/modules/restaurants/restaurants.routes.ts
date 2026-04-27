import { Router } from "express";
import * as restaurantsController from "./restaurants.controller";
import { Role } from "@prisma/client";
import { authenticate } from "@middleware/authenticate";
import { authorize } from "@middleware/authorize";
import { validate } from "@middleware/validate";
import {
  createRestaurantSchema,
  updateRestaurantSchema,
  restaurantIdParamSchema,
  blockRestaurantSchema,
} from "./restaurants.schema";

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get("/", restaurantsController.listRestaurants);

router.get(
  "/:id",
  validate({ params: restaurantIdParamSchema }),
  restaurantsController.getRestaurantById,
);

router.post(
  "/",
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  validate({ body: createRestaurantSchema }),
  restaurantsController.createRestaurant,
);

router.patch(
  "/:id",
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  validate({ params: restaurantIdParamSchema, body: updateRestaurantSchema }),
  restaurantsController.updateRestaurant,
);

router.delete(
  "/:id",
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  validate({ params: restaurantIdParamSchema }),
  restaurantsController.deleteRestaurant,
);

// Admin-only block endpoint
router.patch(
  "/:id/block",
  authorize(Role.ADMIN),
  validate({ params: restaurantIdParamSchema, body: blockRestaurantSchema }),
  restaurantsController.blockRestaurant,
);

export default router;
