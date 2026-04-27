import {
  app,
  request,
  cleanupDatabase,
  seedAdmin,
  createAndLoginUser,
  createTestRestaurant,
  createTestMeal,
  loginAsAdmin,
  TestUserResponse,
  TestRestaurant,
} from "../helpers";

beforeEach(async () => {
  await cleanupDatabase();
  await seedAdmin();
});

describe("Meal CRUD", () => {
  let owner: TestUserResponse;
  let restaurant: TestRestaurant;

  beforeEach(async () => {
    owner = await createAndLoginUser("RESTAURANT_OWNER");
    restaurant = await createTestRestaurant(owner.accessToken);
  });

  describe("POST /api/v1/restaurants/:restaurantId/meals", () => {
    it("should allow owner to create a meal", async () => {
      const res = await request(app)
        .post(`/api/v1/restaurants/${restaurant.id}/meals`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          name: "Burger",
          description: "Juicy beef burger",
          price: 12.99,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("Burger");
      expect(Number(res.body.data.price)).toBe(12.99);
      expect(res.body.data.restaurantId).toBe(restaurant.id);
      expect(res.body.data.isAvailable).toBe(true);
    });

    it("should NOT allow customer to create a meal", async () => {
      const customer = await createAndLoginUser("CUSTOMER");

      const res = await request(app)
        .post(`/api/v1/restaurants/${restaurant.id}/meals`)
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({
          name: "Burger",
          description: "Juicy beef burger",
          price: 12.99,
        });

      expect(res.status).toBe(403);
    });

    it("should NOT allow owner to create meal for other owner restaurant", async () => {
      const owner2 = await createAndLoginUser("RESTAURANT_OWNER");

      const res = await request(app)
        .post(`/api/v1/restaurants/${restaurant.id}/meals`)
        .set("Authorization", `Bearer ${owner2.accessToken}`)
        .send({
          name: "Burger",
          description: "Juicy beef burger",
          price: 12.99,
        });

      expect(res.status).toBe(403);
    });

    it("should allow admin to create meal for any restaurant", async () => {
      const admin = await loginAsAdmin();

      const res = await request(app)
        .post(`/api/v1/restaurants/${restaurant.id}/meals`)
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .send({
          name: "Admin Meal",
          description: "Created by admin",
          price: 9.99,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("Admin Meal");
    });

    it("should reject negative price", async () => {
      const res = await request(app)
        .post(`/api/v1/restaurants/${restaurant.id}/meals`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ name: "Bad Meal", description: "Invalid", price: -5 });

      expect(res.status).toBe(400);
    });

    it("should reject missing required fields", async () => {
      const res = await request(app)
        .post(`/api/v1/restaurants/${restaurant.id}/meals`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ name: "No Price" });

      expect(res.status).toBe(400);
    });

    it("should return 404 for non-existent restaurant", async () => {
      const res = await request(app)
        .post("/api/v1/restaurants/00000000-0000-0000-0000-000000000000/meals")
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          name: "Burger",
          description: "Juicy beef burger",
          price: 12.99,
        });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/v1/restaurants/:restaurantId/meals", () => {
    it("should list meals for a restaurant", async () => {
      await createTestMeal(owner.accessToken, restaurant.id, {
        name: "Meal 1",
        price: 10,
      });
      await createTestMeal(owner.accessToken, restaurant.id, {
        name: "Meal 2",
        price: 15,
      });

      const customer = await createAndLoginUser("CUSTOMER");
      const res = await request(app)
        .get(`/api/v1/restaurants/${restaurant.id}/meals`)
        .set("Authorization", `Bearer ${customer.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(2);
    });

    it("should hide unavailable meals from customers", async () => {
      const meal = await createTestMeal(owner.accessToken, restaurant.id);

      // Mark as unavailable
      await request(app)
        .patch(`/api/v1/restaurants/${restaurant.id}/meals/${meal.id}`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ isAvailable: false });

      const customer = await createAndLoginUser("CUSTOMER");
      const res = await request(app)
        .get(`/api/v1/restaurants/${restaurant.id}/meals`)
        .set("Authorization", `Bearer ${customer.accessToken}`);

      expect(res.body.data.length).toBe(0);
    });

    it("should show unavailable meals to owner", async () => {
      const meal = await createTestMeal(owner.accessToken, restaurant.id);

      await request(app)
        .patch(`/api/v1/restaurants/${restaurant.id}/meals/${meal.id}`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ isAvailable: false });

      const res = await request(app)
        .get(`/api/v1/restaurants/${restaurant.id}/meals`)
        .set("Authorization", `Bearer ${owner.accessToken}`);

      expect(res.body.data.length).toBe(1);
    });

    it("should support search", async () => {
      await createTestMeal(owner.accessToken, restaurant.id, {
        name: "Pizza Margherita",
      });
      await createTestMeal(owner.accessToken, restaurant.id, {
        name: "Caesar Salad",
      });

      const res = await request(app)
        .get(`/api/v1/restaurants/${restaurant.id}/meals?search=pizza`)
        .set("Authorization", `Bearer ${owner.accessToken}`);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe("Pizza Margherita");
    });

    it("should support pagination", async () => {
      for (let i = 0; i < 5; i++) {
        await createTestMeal(owner.accessToken, restaurant.id, {
          name: `Meal ${i}`,
        });
      }

      const res = await request(app)
        .get(`/api/v1/restaurants/${restaurant.id}/meals?page=1&limit=2`)
        .set("Authorization", `Bearer ${owner.accessToken}`);

      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(5);
      expect(res.body.meta.totalPages).toBe(3);
    });
  });

  describe("GET /api/v1/restaurants/:restaurantId/meals/:id", () => {
    it("should return a single meal by ID", async () => {
      const meal = await createTestMeal(owner.accessToken, restaurant.id, {
        name: "Special Meal",
        price: 19.99,
      });

      const customer = await createAndLoginUser("CUSTOMER");
      const res = await request(app)
        .get(`/api/v1/restaurants/${restaurant.id}/meals/${meal.id}`)
        .set("Authorization", `Bearer ${customer.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Special Meal");
    });

    it("should return 404 for non-existent meal", async () => {
      const customer = await createAndLoginUser("CUSTOMER");
      const res = await request(app)
        .get(
          `/api/v1/restaurants/${restaurant.id}/meals/00000000-0000-0000-0000-000000000000`,
        )
        .set("Authorization", `Bearer ${customer.accessToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/restaurants/:restaurantId/meals/:id", () => {
    it("should allow owner to update own meal", async () => {
      const meal = await createTestMeal(owner.accessToken, restaurant.id);

      const res = await request(app)
        .patch(`/api/v1/restaurants/${restaurant.id}/meals/${meal.id}`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ name: "Updated Meal", price: 15.99 });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Updated Meal");
      expect(Number(res.body.data.price)).toBe(15.99);
    });

    it("should NOT allow other owner to update meal", async () => {
      const meal = await createTestMeal(owner.accessToken, restaurant.id);
      const owner2 = await createAndLoginUser("RESTAURANT_OWNER");

      const res = await request(app)
        .patch(`/api/v1/restaurants/${restaurant.id}/meals/${meal.id}`)
        .set("Authorization", `Bearer ${owner2.accessToken}`)
        .send({ name: "Hacked" });

      expect(res.status).toBe(403);
    });

    it("should toggle availability", async () => {
      const meal = await createTestMeal(owner.accessToken, restaurant.id);

      const res = await request(app)
        .patch(`/api/v1/restaurants/${restaurant.id}/meals/${meal.id}`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ isAvailable: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isAvailable).toBe(false);
    });
  });

  describe("DELETE /api/v1/restaurants/:restaurantId/meals/:id", () => {
    it("should allow owner to delete own meal", async () => {
      const meal = await createTestMeal(owner.accessToken, restaurant.id);

      const res = await request(app)
        .delete(`/api/v1/restaurants/${restaurant.id}/meals/${meal.id}`)
        .set("Authorization", `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(204);
    });

    it("should NOT allow deletion of meal with active orders", async () => {
      const meal = await createTestMeal(owner.accessToken, restaurant.id, {
        price: 10,
      });

      // Place an order for this meal
      const customer = await createAndLoginUser("CUSTOMER");
      await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ mealId: meal.id, quantity: 1 }],
        });

      // Try to delete the meal
      const res = await request(app)
        .delete(`/api/v1/restaurants/${restaurant.id}/meals/${meal.id}`)
        .set("Authorization", `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(422);
      expect(res.body.error.message).toContain("active orders");
    });

    it("should NOT allow other owner to delete meal", async () => {
      const meal = await createTestMeal(owner.accessToken, restaurant.id);
      const owner2 = await createAndLoginUser("RESTAURANT_OWNER");

      const res = await request(app)
        .delete(`/api/v1/restaurants/${restaurant.id}/meals/${meal.id}`)
        .set("Authorization", `Bearer ${owner2.accessToken}`);

      expect(res.status).toBe(403);
    });
  });
});
