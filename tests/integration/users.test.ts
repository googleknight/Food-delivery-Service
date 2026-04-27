import {
  app,
  request,
  cleanupDatabase,
  seedAdmin,
  createAndLoginUser,
  loginAsAdmin,
} from "../helpers";

beforeEach(async () => {
  await cleanupDatabase();
  await seedAdmin();
});

describe("Admin User Management", () => {
  describe("GET /api/v1/admin/users", () => {
    it("should list all users for admin", async () => {
      const admin = await loginAsAdmin();
      await createAndLoginUser("CUSTOMER");
      await createAndLoginUser("RESTAURANT_OWNER");

      const res = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3); // admin + 2 users
      expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
    });

    it("should support pagination", async () => {
      const admin = await loginAsAdmin();
      // Create several users
      for (let i = 0; i < 5; i++) {
        await createAndLoginUser("CUSTOMER");
      }

      const res = await request(app)
        .get("/api/v1/admin/users?page=1&limit=2")
        .set("Authorization", `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.totalPages).toBeGreaterThanOrEqual(3);
    });

    it("should support field selection", async () => {
      const admin = await loginAsAdmin();
      await createAndLoginUser("CUSTOMER");

      const res = await request(app)
        .get("/api/v1/admin/users?fields=id,email,role")
        .set("Authorization", `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(200);
      const user = res.body.data[0];
      expect(user.id).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.role).toBeDefined();
      expect(user.name).toBeUndefined(); // not requested
    });

    it("should reject non-admin access", async () => {
      const customer = await createAndLoginUser("CUSTOMER");

      const res = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer ${customer.accessToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/v1/admin/users", () => {
    it("should allow admin to create user with any role", async () => {
      const admin = await loginAsAdmin();

      const res = await request(app)
        .post("/api/v1/admin/users")
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .send({
          email: "newadmin@test.com",
          password: "Test@123456",
          name: "New Admin",
          role: "ADMIN",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.role).toBe("ADMIN");
    });
  });

  describe("DELETE /api/v1/admin/users/:id", () => {
    it("should delete a user", async () => {
      const admin = await loginAsAdmin();
      const { user } = await createAndLoginUser("CUSTOMER");

      const res = await request(app)
        .delete(`/api/v1/admin/users/${user.id}`)
        .set("Authorization", `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(204);
    });

    it("should NOT allow deleting built-in admin", async () => {
      const admin = await loginAsAdmin();

      const res = await request(app)
        .delete(`/api/v1/admin/users/${admin.user.id}`)
        .set("Authorization", `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain("built-in admin");
    });
  });

  describe("PATCH /api/v1/admin/users/:id/block", () => {
    it("should block a user", async () => {
      const admin = await loginAsAdmin();
      const { user, accessToken } = await createAndLoginUser("CUSTOMER");

      const blockRes = await request(app)
        .patch(`/api/v1/admin/users/${user.id}/block`)
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .send({ isBlocked: true });

      expect(blockRes.status).toBe(200);
      expect(blockRes.body.data.isBlocked).toBe(true);

      // Blocked user should not be able to access API
      const meRes = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(meRes.status).toBe(401);
    });

    it("should unblock a user", async () => {
      const admin = await loginAsAdmin();
      const { user } = await createAndLoginUser("CUSTOMER");

      // Block first
      await request(app)
        .patch(`/api/v1/admin/users/${user.id}/block`)
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .send({ isBlocked: true });

      // Then unblock
      const res = await request(app)
        .patch(`/api/v1/admin/users/${user.id}/block`)
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .send({ isBlocked: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isBlocked).toBe(false);
    });

    it("should NOT block built-in admin", async () => {
      const admin = await loginAsAdmin();

      const res = await request(app)
        .patch(`/api/v1/admin/users/${admin.user.id}/block`)
        .set("Authorization", `Bearer ${admin.accessToken}`)
        .send({ isBlocked: true });

      expect(res.status).toBe(403);
    });
  });
});
