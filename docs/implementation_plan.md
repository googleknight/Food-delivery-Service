---
id: implementation-plan
title: Implementation Plan
sidebar_position: 4
---
# Food Delivery Service API — Implementation Plan

## Goal

Build a production-quality REST API for a food delivery service with three roles (Customer, Restaurant Owner, Admin), full order lifecycle management, coupon support, and comprehensive integration tests. The project must be runnable locally via Docker and testable via Postman.

---

## User Review Required

> [!IMPORTANT]
> **A26 — Customer Cancellation Window**: The plan restricts customers to canceling only orders in `PLACED` status. Once a restaurant starts `PROCESSING`, only the owner/admin can cancel. If you want customers to cancel at any stage, please flag this.

> [!NOTE]
> **Tax Calculation**: Designed as a future roadmap item (schema + calculation flow documented in tech-specs §19). NOT implemented in this version. Will be added in a future release.

---

## Proposed Changes

The implementation is broken into 8 phases, ordered by dependency.

---

### Phase 1: Project Scaffolding & Docker Setup

Set up the TypeScript project, install all dependencies, configure Docker for PostgreSQL.

#### [NEW] package.json
- All dependencies and devDependencies listed
- Scripts: `dev`, `build`, `test`, `db:migrate`, `db:seed`, `db:reset`
- Prisma seed configuration

#### [NEW] tsconfig.json
- Strict mode, ES2022 target, module resolution `node`
- Path aliases: `@/*` → `src/*`

#### [NEW] docker-compose.yml
- `db` service: PostgreSQL 16 on port 5432 (dev)
- `db-test` service: PostgreSQL 16 on port 5433 (tests)
- Volume for persistent data

#### [NEW] Dockerfile
- Multi-stage build: install → build → run
- For local dev parity if needed

#### [NEW] .env.example
- All environment variables documented with safe defaults

#### [NEW] .gitignore
- `node_modules`, `dist`, `.env`, `prisma/*.db`

#### [NEW] jest.config.ts
- TypeScript transform via `ts-jest`
- Test match pattern, module aliases
- Global setup/teardown for test DB

**Dependencies**:
```
express, cors, helmet, express-rate-limit, pino, pino-http,
jsonwebtoken, bcrypt, zod, dotenv, swagger-jsdoc, swagger-ui-express,
uuidv7, node-cache
```

**Dev Dependencies**:
```
typescript, tsx, ts-jest, jest, supertest, prisma,
@types/express, @types/cors, @types/jsonwebtoken, @types/bcrypt,
@types/jest, @types/supertest, @types/swagger-jsdoc, @types/swagger-ui-express,
eslint, prettier
```

---

### Phase 2: Database Schema (Prisma)

#### [NEW] prisma/schema.prisma
- 9 models: `User`, `Restaurant`, `Meal`, `Coupon`, `CouponUsage`, `Order`, `OrderItem`, `OrderStatusHistory`, `RefreshToken`
- 2 enums: `Role`, `OrderStatus`
- All primary keys use **UUIDv7** (time-ordered) for optimal B-tree index performance
- Indexes on foreign keys, unique constraints on `email`, `coupon.code`, `refreshToken.jti`
- Cascade deletes where appropriate (OrderItems cascade with Order)
- Coupon model includes `maxUsageTotal`, `maxUsagePerCustomer`, `currentUsageTotal`
- RefreshToken model with `userId`, `jti`, `expiresAt`, `isRevoked`

#### [NEW] prisma/seed.ts
- Seeds the built-in admin account from env vars
- Idempotent (checks if admin already exists)

---

### Phase 3: Core Infrastructure

#### [NEW] src/server.ts
- Entry point: starts Express, listens on `PORT`

#### [NEW] src/app.ts
- Express app factory: mounts middleware (cors, helmet, pino-http, json parser, rate limiter)
- Mounts API routes under `/api/v1`
- Mounts Swagger UI at `/api-docs`
- Global error handler as final middleware

#### [NEW] src/config/index.ts
- Loads and validates all env vars using Zod
- Exports typed config object

#### [NEW] src/utils/prisma.ts
- Prisma client singleton (prevents multiple instances in dev/test)

#### [NEW] src/utils/cache.ts
- node-cache instance with configurable TTL (default 60s)
- Abstracted behind a `CacheService` interface for future Redis swap
- Methods: `get<T>(key)`, `set(key, value, ttl?)`, `del(key)`

#### [NEW] src/utils/uuid.ts
- Wrapper around `uuidv7` package for generating UUIDv7 IDs
- Used as default ID generator across all Prisma models

#### [NEW] src/utils/fieldSelection.ts
- `parseFieldSelection(fieldsParam, whitelist)` → Prisma `select` object
- Validates requested fields against per-resource whitelist
- Rejects sensitive fields (`password`, etc.) with 400 error

#### [NEW] src/utils/errors.ts
- `AppError`, `NotFoundError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `BusinessLogicError`

#### [NEW] src/utils/response.ts
- `sendSuccess(res, data, statusCode, meta)` — standardized success response
- `sendError(res, error)` — standardized error response

#### [NEW] src/types/index.ts
- Extended Express `Request` type with `user` property
- Common interfaces

---

### Phase 4: Middleware

#### [NEW] src/middleware/authenticate.ts
- Extracts JWT from `Authorization: Bearer <token>`
- Verifies token signature and expiry (access token only)
- Checks **in-memory cache** (node-cache, 60s TTL) for user's `isBlocked` status
- On cache miss: loads user from DB, caches result
- Attaches user to `req.user`
- On user block in admin service: `cache.del('user:' + userId)` for immediate invalidation

#### [NEW] src/middleware/authorize.ts
- Factory function: `authorize(...roles: Role[])`
- Checks `req.user.role` against allowed roles
- Returns 403 if not authorized

#### [NEW] src/middleware/validate.ts
- Factory function: `validate(schema: ZodSchema)`
- Validates `req.body`, `req.query`, `req.params` against Zod schema
- Returns 400 with field-level error details

#### [NEW] src/middleware/errorHandler.ts
- Catches all errors thrown in routes/services
- Maps `AppError` subclasses to HTTP status codes
- Maps Prisma errors (P2002 unique violation → 409, P2025 not found → 404)
- Logs errors via Pino
- Returns standardized error response

#### [NEW] src/middleware/rateLimiter.ts
- Configurable rate limiter for auth endpoints (100 requests / 15 min window)

---

### Phase 5: Feature Modules

Each module follows the same pattern: `routes.ts` → `controller.ts` → `service.ts`, with `schema.ts` for validation.

#### Auth Module (`src/modules/auth/`)

| File | Responsibility |
|---|---|
| `auth.routes.ts` | `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `GET /me`, `PATCH /me` |
| `auth.controller.ts` | Parse request, call service, send response |
| `auth.service.ts` | Hash passwords (bcrypt), verify credentials, sign access + refresh JWTs, refresh token rotation, logout (revoke refresh token), update profile |
| `auth.schema.ts` | `registerSchema`, `loginSchema`, `refreshTokenSchema`, `updateProfileSchema` |

#### Users Module (`src/modules/users/`) — Admin only

| File | Responsibility |
|---|---|
| `users.routes.ts` | Full CRUD + block/unblock, all behind `authorize('ADMIN')`, prefixed with `/admin/users` |
| `users.controller.ts` | Parse request, call service, send response |
| `users.service.ts` | CRUD with guards (cannot delete built-in admin), pagination, blocking (+ cache invalidation on block), field selection |
| `users.schema.ts` | `createUserSchema`, `updateUserSchema`, `listUsersSchema`, `blockUserSchema` |

#### Restaurants Module (`src/modules/restaurants/`)

| File | Responsibility |
|---|---|
| `restaurants.routes.ts` | CRUD + block (owner+admin can write; all auth users can read) |
| `restaurants.controller.ts` | Parse request, call service, send response |
| `restaurants.service.ts` | Ownership checks, block guards, active order checks before delete |
| `restaurants.schema.ts` | `createRestaurantSchema`, `updateRestaurantSchema`, `listRestaurantsSchema` |

#### Meals Module (`src/modules/meals/`)

| File | Responsibility |
|---|---|
| `meals.routes.ts` | Nested under `/restaurants/:restaurantId/meals` |
| `meals.controller.ts` | Parse request, call service, send response |
| `meals.service.ts` | Ownership via restaurant, active order checks before delete |
| `meals.schema.ts` | `createMealSchema`, `updateMealSchema` |

#### Orders Module (`src/modules/orders/`)

| File | Responsibility |
|---|---|
| `orders.routes.ts` | `POST /orders`, `GET /orders`, `GET /orders/:id`, `PATCH /orders/:id/status` |
| `orders.controller.ts` | Parse request, call service, send response |
| `orders.service.ts` | Order creation (validate meals, compute totals, apply coupon), status transitions (state machine), history, role-scoped listing |
| `orders.schema.ts` | `createOrderSchema`, `updateOrderStatusSchema`, `listOrdersSchema` |

**Order creation logic** (in service, inside `prisma.$transaction()`):
1. Validate all meal IDs exist and belong to the same restaurant
2. If coupon provided: validate it's active, not expired, belongs to the restaurant
3. **Check coupon usage limits**: total usage < `maxUsageTotal`, customer usage < `maxUsagePerCustomer`
4. Snapshot meal prices into OrderItems
5. Calculate subtotal, discount, total
6. Create Order + OrderItems + initial OrderStatusHistory (PLACED)
7. If coupon: create CouponUsage record + increment `currentUsageTotal`
8. All steps 6-7 are atomic within the transaction

#### Coupons Module (`src/modules/coupons/`)

| File | Responsibility |
|---|---|
| `coupons.routes.ts` | Nested under `/restaurants/:restaurantId/coupons` |
| `coupons.controller.ts` | Parse request, call service, send response |
| `coupons.service.ts` | CRUD with ownership checks, unique code validation, usage limit configuration |
| `coupons.schema.ts` | `createCouponSchema` (includes `maxUsageTotal`, `maxUsagePerCustomer`), `updateCouponSchema` |

---

### Phase 6: Swagger / OpenAPI Documentation

#### [MODIFY] src/app.ts
- Add swagger-jsdoc configuration with OpenAPI 3.0 spec
- Mount swagger-ui-express at `/api-docs`
- JSDoc comments on all route handlers for auto-generation

Each route file will include JSDoc annotations for Swagger auto-generation.

---

### Phase 7: Integration Tests

All tests use **Supertest** to make HTTP requests directly to the Express app (no server startup needed).

#### [NEW] tests/setup.ts
- Reset test database before all tests
- Run migrations
- Seed built-in admin

#### [NEW] tests/helpers.ts
- `loginAs(role)`: Creates a user, logs in, returns token
- `createRestaurant(token)`: Creates a test restaurant
- `createMeal(token, restaurantId)`: Creates a test meal
- `createOrder(token, ...)`: Creates a test order

#### [NEW] tests/integration/auth.test.ts
- Registration (happy path, duplicate email, invalid data, role selection)
- Login (happy path, wrong password, non-existent email, blocked user)
- Get/update profile

#### [NEW] tests/integration/users.test.ts
- Admin CRUD users
- Cannot delete built-in admin
- Block/unblock user
- Non-admin access denied (403)

#### [NEW] tests/integration/restaurants.test.ts
- Owner creates, reads, updates, deletes own restaurant
- Owner cannot modify other owner's restaurant
- Customer can list and view restaurants (read-only)
- Admin can CRUD any restaurant
- Block/unblock restaurant

#### [NEW] tests/integration/meals.test.ts
- Owner CRUD meals for own restaurant
- Owner cannot add meals to another owner's restaurant
- Customer can view meals
- Price validation (positive, decimal)

#### [NEW] tests/integration/orders.test.ts
- Customer places order (happy path)
- Order with invalid meals (wrong restaurant, non-existent)
- Order with coupon (valid, expired, wrong restaurant)
- Order with tip
- Full status lifecycle: PLACED → PROCESSING → IN_ROUTE → DELIVERED → RECEIVED
- Cancellation flows (customer cancels PLACED, owner cancels PROCESSING)
- Invalid transitions return 422
- Order history (status change timestamps)
- Customer list own orders, owner list restaurant orders, admin list all

#### [NEW] tests/integration/coupons.test.ts
- Owner CRUD coupons
- Unique code validation
- Expired coupon cannot be applied
- **Coupon total usage limit enforcement**
- **Coupon per-customer usage limit enforcement**
- Usage tracking (CouponUsage records created)

#### [NEW] tests/integration/field-selection.test.ts
- `?fields=id,name` returns only requested fields
- `?fields=password` returns 400 (sensitive field)
- `?fields=nonexistent` returns 400 (invalid field)
- Omitted `fields` returns all fields

---

### Phase 8: Postman Collection

#### [NEW] postman/food-delivery-api.postman_collection.json
- Environment variables: `{{baseUrl}}`, `{{adminToken}}`, `{{customerToken}}`, `{{ownerToken}}`
- Pre-request scripts to auto-login
- All endpoints organized by folder (Auth, Users, Restaurants, Meals, Orders, Coupons)
- Example request bodies and descriptions

#### [NEW] postman/food-delivery-api.postman_environment.json
- Local environment with `baseUrl = http://localhost:3000/api/v1`

## Resolved Questions

| Question | Resolution |
|---|---|
| Blocked restaurant visibility | Customers see only unblocked restaurants; owners and admins see all |
| Meal availability model | Simple `isAvailable` boolean toggle (no stock tracking) |
| Postman test data | Pre-filled example data (restaurants, meals, coupons, orders) |
| Coupon usage limits | Implemented: per-coupon total limit + per-customer limit |
| Refresh tokens | Implemented: 15min access + 7d refresh with DB-backed revocation |
| Admin URL prefix | Implemented: `/api/v1/admin/...` for admin-only routes |
| Caching | In-memory node-cache (60s TTL) for auth user lookups |
| UUID version | UUIDv7 for optimal B-tree index performance |
| Transactions | Prisma `$transaction()` for all multi-table writes |
| Field selection | `?fields=` supported on all GET endpoints |
| Tax calculation | Documented as future roadmap in tech-specs §19, not implemented |

---

## Verification Plan

### Automated Tests

1. **Integration tests**: `npm test` — runs all Supertest-based tests against the test database
2. **Coverage report**: `npm run test:coverage` — ensures ≥80% line coverage across modules
3. **TypeScript compilation**: `npm run build` — verifies zero type errors
4. **Lint**: `npm run lint` — catches code style issues

### Manual Verification

1. **Docker**: `docker compose up -d` — verify both databases start
2. **Postman**: Import collection, run all requests sequentially
3. **Swagger**: Open `http://localhost:3000/api-docs` — verify interactive docs render
4. **Order lifecycle**: Walk through a full order flow manually via Postman (register → create restaurant → add meals → place order → transition statuses)
5. **Admin flows**: Login as admin → CRUD users → block/unblock → verify blocked user cannot authenticate
6. **Refresh token flow**: Login → use access token → wait for expiry → refresh → verify new tokens work
7. **Coupon limits**: Create coupon with limits → use until exhausted → verify rejection
8. **Field selection**: Test `?fields=id,name` on various endpoints
