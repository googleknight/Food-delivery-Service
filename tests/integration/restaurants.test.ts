import {
  app,
  request,
  cleanupDatabase,
  seedAdmin,
  createAndLoginUser,
  loginAsAdmin,
  createTestRestaurant,
} from "../helpers";

beforeEach(async () => {
  await cleanupDatabase();
  await seedAdmin();
});

describe("Restaurant CRUD", () => {
  describe("POST /api/v1/restaurants", () => {
    it("should allow owner to create restaurant", async () => {
      const owner = await createAndLoginUser("RESTAURANT_OWNER");

      const res = await request(app)
        .post("/api/v1/restaurants")
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          name: "Pizza Palace",
          description: "Italian cuisine, wood-fired pizzas",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("Pizza Palace");
      expect(res.body.data.ownerId).toBe(owner.user.id);
    });

    it("should NOT allow customer to create restaurant", async () => {
      const customer = await createAndLoginUser("CUSTOMER");

      const res = await request(app)
        .post("/api/v1/restaurants")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({ name: "Nope", description: "Should fail" });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/v1/restaurants", () => {
    it("should list restaurants for authenticated user", async () => {
      const owner = await createAndLoginUser("RESTAURANT_OWNER");
      await createTestRestaurant(owner.accessToken, { name: "Rest 1" });
      await createTestRestaurant(owner.accessToken, { name: "Rest 2" });

      const customer = await createAndLoginUser("CUSTOMER");
      const res = await request(app)
        .get("/api/v1/restaurants")
        .set("Authorization", `Bearer ${customer.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(2);
    });

    it("should hide blocked restaurants from customers", async () => {
      const owner = await createAndLoginUser("RESTAURANT_OWNER");
      const restaurant = await createTestRestaurant(owner.accessToken);
      const admin = await loginAsAdmin();

      // Block the restaurant
      await request(app)
        .patch(`/api/v1/restaurants/${restaurant.id}/block`)
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .send({ isBlocked: true });

      const customer = await createAndLoginUser("CUSTOMER");
      const res = await request(app)
        .get("/api/v1/restaurants")
        .set("Authorization", `Bearer ${customer.accessToken}`);

      expect(res.body.data.length).toBe(0);
    });

    it("should support search", async () => {
      const owner = await createAndLoginUser("RESTAURANT_OWNER");
      await createTestRestaurant(owner.accessToken, { name: "Pizza Palace" });
      await createTestRestaurant(owner.accessToken, { name: "Sushi Bar" });

      const res = await request(app)
        .get("/api/v1/restaurants?search=pizza")
        .set("Authorization", `Bearer ${owner.accessToken}`);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe("Pizza Palace");
    });
  });

  describe("PATCH /api/v1/restaurants/:id", () => {
    it("should allow owner to update own restaurant", async () => {
      const owner = await createAndLoginUser("RESTAURANT_OWNER");
      const restaurant = await createTestRestaurant(owner.accessToken);

      const res = await request(app)
        .patch(`/api/v1/restaurants/${restaurant.id}`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ name: "Updated Name" });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Updated Name");
    });

    it("should NOT allow owner to update other owner restaurant", async () => {
      const owner1 = await createAndLoginUser("RESTAURANT_OWNER");
      const owner2 = await createAndLoginUser("RESTAURANT_OWNER");
      const restaurant = await createTestRestaurant(owner1.accessToken);

      const res = await request(app)
        .patch(`/api/v1/restaurants/${restaurant.id}`)
        .set("Authorization", `Bearer ${owner2.accessToken}`)
        .send({ name: "Hacked" });

      expect(res.status).toBe(403);
    });

    it("should allow admin to update any restaurant", async () => {
      const owner = await createAndLoginUser("RESTAURANT_OWNER");
      const restaurant = await createTestRestaurant(owner.accessToken);
      const admin = await loginAsAdmin();

      const res = await request(app)
        .patch(`/api/v1/restaurants/${restaurant.id}`)
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .send({ name: "Admin Updated" });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Admin Updated");
    });
  });

  describe("DELETE /api/v1/restaurants/:id", () => {
    it("should allow owner to delete own restaurant", async () => {
      const owner = await createAndLoginUser("RESTAURANT_OWNER");
      const restaurant = await createTestRestaurant(owner.accessToken);

      const res = await request(app)
        .delete(`/api/v1/restaurants/${restaurant.id}`)
        .set("Authorization", `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(204);
    });
  });
});
