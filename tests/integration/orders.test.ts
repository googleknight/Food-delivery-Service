import {
  app,
  request,
  cleanupDatabase,
  seedAdmin,
  createAndLoginUser,
  createTestRestaurant,
  createTestMeal,
  createTestCoupon,
  loginAsAdmin,
  TestUserResponse,
  TestRestaurant,
} from "../helpers";

beforeEach(async () => {
  await cleanupDatabase();
  await seedAdmin();
});

describe("Order Lifecycle", () => {
  let customer: TestUserResponse;
  let owner: TestUserResponse;
  let restaurant: TestRestaurant;
  let meal1: { id: string; name: string; price: number };
  let meal2: { id: string; name: string; price: number };

  beforeEach(async () => {
    owner = await createAndLoginUser("RESTAURANT_OWNER");
    customer = await createAndLoginUser("CUSTOMER");
    restaurant = await createTestRestaurant(owner.accessToken);
    meal1 = await createTestMeal(owner.accessToken, restaurant.id, {
      name: "Burger",
      price: 10.0,
    });
    meal2 = await createTestMeal(owner.accessToken, restaurant.id, {
      name: "Fries",
      price: 5.0,
    });
  });

  describe("POST /api/v1/orders", () => {
    it("should place an order successfully", async () => {
      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [
            { mealId: meal1.id, quantity: 2 },
            { mealId: meal2.id, quantity: 1 },
          ],
          tipAmount: 3.0,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("PLACED");
      expect(Number(res.body.data.subtotal)).toBe(25.0); // 10*2 + 5*1
      expect(Number(res.body.data.tipAmount)).toBe(3.0);
      expect(Number(res.body.data.totalAmount)).toBe(28.0); // 25 + 3
      expect(res.body.data.items.length).toBe(2);
      expect(res.body.data.statusHistory).toBeDefined(); // included in response
    });

    it("should apply coupon discount", async () => {
      await createTestCoupon(owner.accessToken, restaurant.id, {
        code: "SAVE20",
        discountPercent: 20,
      });

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ mealId: meal1.id, quantity: 1 }],
          couponCode: "SAVE20",
          tipAmount: 0,
        });

      expect(res.status).toBe(201);
      expect(Number(res.body.data.subtotal)).toBe(10.0);
      expect(Number(res.body.data.discountAmount)).toBe(2.0); // 20% of 10
      expect(Number(res.body.data.totalAmount)).toBe(8.0); // 10 - 2
    });

    it("should reject order with meals from different restaurant", async () => {
      const owner2 = await createAndLoginUser("RESTAURANT_OWNER");
      const restaurant2 = await createTestRestaurant(owner2.accessToken);
      const otherMeal = await createTestMeal(
        owner2.accessToken,
        restaurant2.id,
      );

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ mealId: otherMeal.id, quantity: 1 }],
        });

      expect(res.status).toBe(400);
    });

    it("should reject order with duplicate meal IDs", async () => {
      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [
            { mealId: meal1.id, quantity: 1 },
            { mealId: meal1.id, quantity: 2 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe("Validation failed");
      expect(res.body.error.details[0].message).toContain("Duplicate meal IDs");
    });

    it("should reject order with expired coupon", async () => {
      await createTestCoupon(owner.accessToken, restaurant.id, {
        code: "EXPIRED",
        discountPercent: 10,
        expiresAt: new Date(Date.now() - 86400000).toISOString(), // yesterday
      });

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ mealId: meal1.id, quantity: 1 }],
          couponCode: "EXPIRED",
        });

      expect(res.status).toBe(422);
    });

    it("should enforce per-customer coupon usage limit", async () => {
      await createTestCoupon(owner.accessToken, restaurant.id, {
        code: "ONCE",
        discountPercent: 10,
        maxUsagePerCustomer: 1,
      });

      // First use — should work
      const res1 = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ mealId: meal1.id, quantity: 1 }],
          couponCode: "ONCE",
        });
      expect(res1.status).toBe(201);

      // Second use — should fail
      const res2 = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ mealId: meal1.id, quantity: 1 }],
          couponCode: "ONCE",
        });
      expect(res2.status).toBe(422);
    });

    it("should enforce total coupon usage limit", async () => {
      await createTestCoupon(owner.accessToken, restaurant.id, {
        code: "LIMITED",
        discountPercent: 10,
        maxUsageTotal: 1,
      });

      // First use
      await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ mealId: meal1.id, quantity: 1 }],
          couponCode: "LIMITED",
        });

      // Second customer tries
      const customer2 = await createAndLoginUser("CUSTOMER");
      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customer2.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ mealId: meal1.id, quantity: 1 }],
          couponCode: "LIMITED",
        });

      expect(res.status).toBe(422);
    });

    it("should NOT allow restaurant owner to place order", async () => {
      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ mealId: meal1.id, quantity: 1 }],
        });

      expect(res.status).toBe(403);
    });
  });

  describe("Order Status Transitions", () => {
    let orderId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ mealId: meal1.id, quantity: 1 }],
        });
      orderId = res.body.data.id;
    });

    it("should follow full lifecycle: PLACED → PROCESSING → IN_ROUTE → DELIVERED → RECEIVED", async () => {
      // PLACED → PROCESSING (owner)
      let res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ status: "PROCESSING" });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("PROCESSING");
      // Verify statusHistory is included and not stale (includes PLACED and PROCESSING)
      expect(res.body.data.statusHistory).toHaveLength(2);
      expect(res.body.data.statusHistory[0].status).toBe("PLACED");
      expect(res.body.data.statusHistory[1].status).toBe("PROCESSING");

      // PROCESSING → IN_ROUTE (owner)
      res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ status: "IN_ROUTE" });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("IN_ROUTE");

      // IN_ROUTE → DELIVERED (owner)
      res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ status: "DELIVERED" });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("DELIVERED");

      // DELIVERED → RECEIVED (customer)
      res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({ status: "RECEIVED" });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("RECEIVED");
    });

    it("should allow customer to cancel PLACED order", async () => {
      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({ status: "CANCELED" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("CANCELED");
    });

    it("should allow owner to cancel PLACED order", async () => {
      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ status: "CANCELED" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("CANCELED");
    });

    it("should NOT allow customer to transition to PROCESSING", async () => {
      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({ status: "PROCESSING" });

      expect(res.status).toBe(403);
    });

    it("should reject invalid transition (PLACED → DELIVERED)", async () => {
      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ status: "DELIVERED" });

      expect(res.status).toBe(422);
    });

    it("should NOT allow transition from terminal state (CANCELED)", async () => {
      // Cancel first
      await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({ status: "CANCELED" });

      // Try to reopen
      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ status: "PROCESSING" });

      expect(res.status).toBe(422);
    });

    it("should allow admin to perform any valid transition", async () => {
      const admin = await loginAsAdmin();

      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .send({ status: "PROCESSING" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("PROCESSING");
    });
  });

  describe("GET /api/v1/orders", () => {
    it("should list only own orders for customer", async () => {
      // Customer 1 places an order
      await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ mealId: meal1.id, quantity: 1 }],
        });

      // Customer 2 places an order
      const customer2 = await createAndLoginUser("CUSTOMER");
      await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customer2.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ mealId: meal1.id, quantity: 1 }],
        });

      // Customer 1 should see only 1 order
      const res = await request(app)
        .get("/api/v1/orders")
        .set("Authorization", `Bearer ${customer.accessToken}`);

      expect(res.body.data.length).toBe(1);
      // Verify statusHistory is included in list response
      expect(res.body.data[0].statusHistory).toBeDefined();
      expect(res.body.data[0].statusHistory).toHaveLength(1);
      expect(res.body.data[0].statusHistory[0].status).toBe("PLACED");
    });

    it("should list restaurant orders for owner", async () => {
      await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ mealId: meal1.id, quantity: 1 }],
        });

      const res = await request(app)
        .get("/api/v1/orders")
        .set("Authorization", `Bearer ${owner.accessToken}`);

      expect(res.body.data.length).toBe(1);
    });

    it("should filter orders by status", async () => {
      // Create a PROCESSING order
      const orderRes = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ mealId: meal1.id, quantity: 1 }],
        });
      const orderId = orderRes.body.data.id;

      await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ status: "PROCESSING" });

      // Create another PLACED order
      await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ mealId: meal2.id, quantity: 1 }],
        });

      // Filter by PROCESSING
      const res = await request(app)
        .get("/api/v1/orders?status=PROCESSING")
        .set("Authorization", `Bearer ${customer.accessToken}`);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].status).toBe("PROCESSING");
    });

    it("should return only selected fields", async () => {
      await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ mealId: meal1.id, quantity: 1 }],
        });

      const res = await request(app)
        .get("/api/v1/orders?fields=id,status")
        .set("Authorization", `Bearer ${customer.accessToken}`);

      expect(res.body.data[0]).toHaveProperty("id");
      expect(res.body.data[0]).toHaveProperty("status");
      expect(res.body.data[0]).not.toHaveProperty("totalAmount");
    });
  });

  describe("GET /api/v1/orders/:id", () => {
    it("should return order details with status history", async () => {
      const orderRes = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ mealId: meal1.id, quantity: 1 }],
        });

      const res = await request(app)
        .get(`/api/v1/orders/${orderRes.body.data.id}`)
        .set("Authorization", `Bearer ${customer.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("PLACED");
      expect(res.body.data.statusHistory).toBeDefined();
      expect(res.body.data.statusHistory).toHaveLength(1);
      expect(res.body.data.statusHistory[0].status).toBe("PLACED");
    });

    it("should NOT allow customer to view another customer order", async () => {
      const orderRes = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ mealId: meal1.id, quantity: 1 }],
        });

      const customer2 = await createAndLoginUser("CUSTOMER");
      const res = await request(app)
        .get(`/api/v1/orders/${orderRes.body.data.id}`)
        .set("Authorization", `Bearer ${customer2.accessToken}`);

      expect(res.status).toBe(403);
    });
  });
});
