import { Router } from "express";
import * as mealsController from "./meals.controller";
import { Role } from "@prisma/client";
import { authenticate } from "@middleware/authenticate";
import { authorize } from "@middleware/authorize";
import { validate } from "@middleware/validate";
import {
  createMealSchema,
  updateMealSchema,
  mealParamsSchema,
  restaurantIdParamSchema,
} from "./meals.schema";

const router = Router({ mergeParams: true }); // mergeParams to access :restaurantId

router.use(authenticate);

router.get(
  "/",
  validate({ params: restaurantIdParamSchema }),
  mealsController.listMeals,
);

router.get(
  "/:id",
  validate({ params: mealParamsSchema }),
  mealsController.getMealById,
);

router.post(
  "/",
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  validate({ params: restaurantIdParamSchema, body: createMealSchema }),
  mealsController.createMeal,
);

router.patch(
  "/:id",
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  validate({ params: mealParamsSchema, body: updateMealSchema }),
  mealsController.updateMeal,
);

router.delete(
  "/:id",
  authorize(Role.RESTAURANT_OWNER, Role.ADMIN),
  validate({ params: mealParamsSchema }),
  mealsController.deleteMeal,
);

export default router;
