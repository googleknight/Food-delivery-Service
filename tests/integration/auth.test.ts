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

describe("POST /api/v1/auth/register", () => {
  it("should register a new customer", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: "customer@test.com",
      password: "Test@123456",
      name: "Test Customer",
      role: "CUSTOMER",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe("customer@test.com");
    expect(res.body.data.user.role).toBe("CUSTOMER");
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.password).toBeUndefined();
  });

  it("should register a restaurant owner", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: "owner@test.com",
      password: "Test@123456",
      name: "Test Owner",
      role: "RESTAURANT_OWNER",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe("RESTAURANT_OWNER");
  });

  it("should reject duplicate email", async () => {
    await request(app).post("/api/v1/auth/register").send({
      email: "dup@test.com",
      password: "Test@123456",
      name: "User 1",
      role: "CUSTOMER",
    });

    const res = await request(app).post("/api/v1/auth/register").send({
      email: "dup@test.com",
      password: "Test@123456",
      name: "User 2",
      role: "CUSTOMER",
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("should reject registration with ADMIN role", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: "admin2@test.com",
      password: "Test@123456",
      name: "Fake Admin",
      role: "ADMIN",
    });

    expect(res.status).toBe(400);
  });

  it("should reject weak password", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: "weak@test.com",
      password: "123",
      name: "Weak",
      role: "CUSTOMER",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should normalize email to lowercase", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: "Upper@Test.COM",
      password: "Test@123456",
      name: "Upper",
      role: "CUSTOMER",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe("upper@test.com");
  });
});

describe("POST /api/v1/auth/login", () => {
  it("should login with valid credentials", async () => {
    await createAndLoginUser("CUSTOMER", { email: "login@test.com" });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "login@test.com", password: "Test@123456" });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe("login@test.com");
  });

  it("should reject invalid password", async () => {
    await createAndLoginUser("CUSTOMER", { email: "wrongpw@test.com" });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "wrongpw@test.com", password: "WrongPass@123" });

    expect(res.status).toBe(401);
  });

  it("should reject non-existent email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nonexistent@test.com", password: "Test@123456" });

    expect(res.status).toBe(401);
  });

  it("should reject blocked user login", async () => {
    const { user } = await createAndLoginUser("CUSTOMER", {
      email: "blocked@test.com",
    });
    const admin = await loginAsAdmin();

    // Block the user
    await request(app)
      .patch(`/api/v1/admin/users/${user.id}/block`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ isBlocked: true });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "blocked@test.com", password: "Test@123456" });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain("blocked");
  });
});

describe("POST /api/v1/auth/refresh", () => {
  it("should return new tokens with valid refresh token", async () => {
    const { refreshToken } = await createAndLoginUser("CUSTOMER");

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    // New refresh token should be different (rotation)
    expect(res.body.data.refreshToken).not.toBe(refreshToken);
  });

  it("should reject reused refresh token (rotation)", async () => {
    const { refreshToken } = await createAndLoginUser("CUSTOMER");

    // Use it once
    await request(app).post("/api/v1/auth/refresh").send({ refreshToken });

    // Try to reuse the old one
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/auth/me", () => {
  it("should return current user profile", async () => {
    const { accessToken } = await createAndLoginUser("CUSTOMER", {
      email: "me@test.com",
      name: "Me User",
    });

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("me@test.com");
    expect(res.body.data.name).toBe("Me User");
  });

  it("should reject unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/v1/auth/me", () => {
  it("should update user name", async () => {
    const { accessToken } = await createAndLoginUser("CUSTOMER");

    const res = await request(app)
      .patch("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Updated Name" });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Updated Name");
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("should revoke refresh tokens on logout", async () => {
    const { accessToken, refreshToken } = await createAndLoginUser("CUSTOMER");

    const logoutRes = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(logoutRes.status).toBe(200);

    // Refresh token should no longer work
    const refreshRes = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken });

    expect(refreshRes.status).toBe(401);
  });
});
