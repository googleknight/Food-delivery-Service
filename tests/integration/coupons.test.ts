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

describe("Coupon CRUD", () => {
  let owner: TestUserResponse;
  let restaurant: TestRestaurant;

  beforeEach(async () => {
    owner = await createAndLoginUser("RESTAURANT_OWNER");
    restaurant = await createTestRestaurant(owner.accessToken);
  });

  describe("POST /api/v1/restaurants/:restaurantId/coupons", () => {
    it("should allow owner to create a coupon", async () => {
      const res = await request(app)
        .post(`/api/v1/restaurants/${restaurant.id}/coupons`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          code: "SAVE10",
          discountPercent: 10,
          maxUsageTotal: 100,
          maxUsagePerCustomer: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe("SAVE10");
      expect(Number(res.body.data.discountPercent)).toBe(10);
      expect(res.body.data.maxUsageTotal).toBe(100);
      expect(res.body.data.maxUsagePerCustomer).toBe(2);
      expect(res.body.data.currentUsageTotal).toBe(0);
      expect(res.body.data.isActive).toBe(true);
    });

    it("should normalize coupon code to uppercase", async () => {
      const res = await request(app)
        .post(`/api/v1/restaurants/${restaurant.id}/coupons`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ code: "lowercase", discountPercent: 10 });

      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe("LOWERCASE");
    });

    it("should reject duplicate coupon code", async () => {
      await createTestCoupon(owner.accessToken, restaurant.id, {
        code: "DUPE",
      });

      const res = await request(app)
        .post(`/api/v1/restaurants/${restaurant.id}/coupons`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ code: "DUPE", discountPercent: 10 });

      expect(res.status).toBe(409);
    });

    it("should NOT allow customer to create coupon", async () => {
      const customer = await createAndLoginUser("CUSTOMER");

      const res = await request(app)
        .post(`/api/v1/restaurants/${restaurant.id}/coupons`)
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({ code: "NOPE", discountPercent: 10 });

      expect(res.status).toBe(403);
    });

    it("should NOT allow owner to create coupon for another owner restaurant", async () => {
      const owner2 = await createAndLoginUser("RESTAURANT_OWNER");

      const res = await request(app)
        .post(`/api/v1/restaurants/${restaurant.id}/coupons`)
        .set("Authorization", `Bearer ${owner2.accessToken}`)
        .send({ code: "NOPE", discountPercent: 10 });

      expect(res.status).toBe(403);
    });

    it("should allow admin to create coupon for any restaurant", async () => {
      const admin = await loginAsAdmin();

      const res = await request(app)
        .post(`/api/v1/restaurants/${restaurant.id}/coupons`)
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .send({ code: "ADMIN10", discountPercent: 10 });

      expect(res.status).toBe(201);
    });

    it("should create coupon with expiration date", async () => {
      const futureDate = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const res = await request(app)
        .post(`/api/v1/restaurants/${restaurant.id}/coupons`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          code: "EXPIRING",
          discountPercent: 15,
          expiresAt: futureDate,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.expiresAt).toBeDefined();
    });

    it("should reject discount percent over 100", async () => {
      const res = await request(app)
        .post(`/api/v1/restaurants/${restaurant.id}/coupons`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ code: "BAD", discountPercent: 150 });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/restaurants/:restaurantId/coupons", () => {
    it("should list coupons for a restaurant", async () => {
      await createTestCoupon(owner.accessToken, restaurant.id, {
        code: "CODE1",
      });
      await createTestCoupon(owner.accessToken, restaurant.id, {
        code: "CODE2",
      });

      const res = await request(app)
        .get(`/api/v1/restaurants/${restaurant.id}/coupons`)
        .set("Authorization", `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(2);
    });

    it("should support search by code", async () => {
      await createTestCoupon(owner.accessToken, restaurant.id, {
        code: "PIZZA10",
      });
      await createTestCoupon(owner.accessToken, restaurant.id, {
        code: "BURGER20",
      });

      const res = await request(app)
        .get(`/api/v1/restaurants/${restaurant.id}/coupons?search=pizza`)
        .set("Authorization", `Bearer ${owner.accessToken}`);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].code).toBe("PIZZA10");
    });
  });

  describe("PATCH /api/v1/restaurants/:restaurantId/coupons/:id", () => {
    it("should allow owner to update coupon", async () => {
      const coupon = await createTestCoupon(owner.accessToken, restaurant.id, {
        code: "OLD",
      });

      const res = await request(app)
        .patch(`/api/v1/restaurants/${restaurant.id}/coupons/${coupon.id}`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ discountPercent: 25 });

      expect(res.status).toBe(200);
      expect(Number(res.body.data.discountPercent)).toBe(25);
    });

    it("should allow updating coupon code", async () => {
      const coupon = await createTestCoupon(owner.accessToken, restaurant.id, {
        code: "OLDCODE",
      });

      const res = await request(app)
        .patch(`/api/v1/restaurants/${restaurant.id}/coupons/${coupon.id}`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ code: "NEWCODE" });

      expect(res.status).toBe(200);
      expect(res.body.data.code).toBe("NEWCODE");
    });

    it("should reject updating to an existing coupon code", async () => {
      await createTestCoupon(owner.accessToken, restaurant.id, {
        code: "EXISTING",
      });
      const coupon = await createTestCoupon(owner.accessToken, restaurant.id, {
        code: "TOCHANGE",
      });

      const res = await request(app)
        .patch(`/api/v1/restaurants/${restaurant.id}/coupons/${coupon.id}`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ code: "EXISTING" });

      expect(res.status).toBe(409);
    });

    it("should deactivate a coupon", async () => {
      const coupon = await createTestCoupon(owner.accessToken, restaurant.id);

      const res = await request(app)
        .patch(`/api/v1/restaurants/${restaurant.id}/coupons/${coupon.id}`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });
  });

  describe("DELETE /api/v1/restaurants/:restaurantId/coupons/:id", () => {
    it("should allow owner to delete coupon", async () => {
      const coupon = await createTestCoupon(owner.accessToken, restaurant.id);

      const res = await request(app)
        .delete(`/api/v1/restaurants/${restaurant.id}/coupons/${coupon.id}`)
        .set("Authorization", `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(204);
    });

    it("should NOT allow other owner to delete coupon", async () => {
      const coupon = await createTestCoupon(owner.accessToken, restaurant.id);
      const owner2 = await createAndLoginUser("RESTAURANT_OWNER");

      const res = await request(app)
        .delete(`/api/v1/restaurants/${restaurant.id}/coupons/${coupon.id}`)
        .set("Authorization", `Bearer ${owner2.accessToken}`);

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-existent coupon", async () => {
      const res = await request(app)
        .delete(
          `/api/v1/restaurants/${restaurant.id}/coupons/00000000-0000-0000-0000-000000000000`,
        )
        .set("Authorization", `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(404);
    });
  });
});

describe("Coupon Usage in Orders", () => {
  let owner: TestUserResponse;
  let customer: TestUserResponse;
  let restaurant: TestRestaurant;
  let meal: { id: string; name: string; price: number };

  beforeEach(async () => {
    owner = await createAndLoginUser("RESTAURANT_OWNER");
    customer = await createAndLoginUser("CUSTOMER");
    restaurant = await createTestRestaurant(owner.accessToken);
    meal = await createTestMeal(owner.accessToken, restaurant.id, {
      price: 100,
    });
  });

  it("should track usage in CouponUsage records", async () => {
    await createTestCoupon(owner.accessToken, restaurant.id, {
      code: "TRACK",
      discountPercent: 10,
    });

    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({
        restaurantId: restaurant.id,
        items: [{ mealId: meal.id, quantity: 1 }],
        couponCode: "TRACK",
      });

    expect(res.status).toBe(201);
    expect(Number(res.body.data.discountAmount)).toBe(10); // 10% of 100
  });

  it("should enforce per-customer usage limit", async () => {
    await createTestCoupon(owner.accessToken, restaurant.id, {
      code: "ONCE",
      discountPercent: 10,
      maxUsagePerCustomer: 1,
    });

    // First use
    const res1 = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({
        restaurantId: restaurant.id,
        items: [{ mealId: meal.id, quantity: 1 }],
        couponCode: "ONCE",
      });
    expect(res1.status).toBe(201);

    // Second use — should fail
    const res2 = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({
        restaurantId: restaurant.id,
        items: [{ mealId: meal.id, quantity: 1 }],
        couponCode: "ONCE",
      });
    expect(res2.status).toBe(422);
    expect(res2.body.error.message).toContain("maximum number of times");
  });

  it("should enforce total usage limit", async () => {
    await createTestCoupon(owner.accessToken, restaurant.id, {
      code: "GLOBAL1",
      discountPercent: 10,
      maxUsageTotal: 1,
    });

    // First customer uses it
    await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({
        restaurantId: restaurant.id,
        items: [{ mealId: meal.id, quantity: 1 }],
        couponCode: "GLOBAL1",
      });

    // Second customer tries
    const customer2 = await createAndLoginUser("CUSTOMER");
    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer2.accessToken}`)
      .send({
        restaurantId: restaurant.id,
        items: [{ mealId: meal.id, quantity: 1 }],
        couponCode: "GLOBAL1",
      });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toContain("maximum usage limit");
  });

  it("should reject expired coupon", async () => {
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
        items: [{ mealId: meal.id, quantity: 1 }],
        couponCode: "EXPIRED",
      });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toContain("expired");
  });

  it("should reject inactive coupon", async () => {
    const coupon = await createTestCoupon(owner.accessToken, restaurant.id, {
      code: "INACTIVE",
      discountPercent: 10,
    });

    // Deactivate
    await request(app)
      .patch(`/api/v1/restaurants/${restaurant.id}/coupons/${coupon.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ isActive: false });

    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({
        restaurantId: restaurant.id,
        items: [{ mealId: meal.id, quantity: 1 }],
        couponCode: "INACTIVE",
      });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toContain("active");
  });

  it("should reject coupon from a different restaurant", async () => {
    const owner2 = await createAndLoginUser("RESTAURANT_OWNER");
    const restaurant2 = await createTestRestaurant(owner2.accessToken);
    await createTestCoupon(owner2.accessToken, restaurant2.id, {
      code: "WRONG_REST",
      discountPercent: 10,
    });

    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({
        restaurantId: restaurant.id,
        items: [{ mealId: meal.id, quantity: 1 }],
        couponCode: "WRONG_REST",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("not valid for this restaurant");
  });

  it("should reject non-existent coupon code", async () => {
    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({
        restaurantId: restaurant.id,
        items: [{ mealId: meal.id, quantity: 1 }],
        couponCode: "DOESNOTEXIST",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("Invalid coupon");
  });

  it("should allow different customers to use same coupon when limits allow", async () => {
    await createTestCoupon(owner.accessToken, restaurant.id, {
      code: "SHARED",
      discountPercent: 10,
      maxUsageTotal: 5,
      maxUsagePerCustomer: 1,
    });

    const customer2 = await createAndLoginUser("CUSTOMER");

    const res1 = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({
        restaurantId: restaurant.id,
        items: [{ mealId: meal.id, quantity: 1 }],
        couponCode: "SHARED",
      });
    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer2.accessToken}`)
      .send({
        restaurantId: restaurant.id,
        items: [{ mealId: meal.id, quantity: 1 }],
        couponCode: "SHARED",
      });
    expect(res2.status).toBe(201);
  });
});
