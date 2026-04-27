# Food Delivery Service API — Technical Specification

## 1. Overview

A RESTful API for a food delivery service where customers can order meals from restaurants. The system supports three roles — **Customer**, **Restaurant Owner**, and **Administrator** — each with distinct permission levels. The API handles authentication, authorization, CRUD operations, order lifecycle management, coupon discounts, tipping, and order history.

---

## 2. Technology Stack

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| **Runtime** | Node.js | 20 LTS | Stable, excellent TypeScript support, long-term support |
| **Language** | TypeScript | 5.x | Type safety, better DX, catches bugs at compile time |
| **Framework** | Express.js | 4.x | Industry standard, minimal, well-documented, huge middleware ecosystem |
| **Database** | PostgreSQL | 16 | ACID compliance, relational integrity for orders/meals, JSON support, robust |
| **ORM** | Prisma | 7.7.0 | Type-safe queries auto-generated from schema, excellent migration system, great DX. Uses driver adapters for better connection management. |
| **Authentication** | JWT (jsonwebtoken) | 9.x | Stateless auth, perfect for REST APIs, well-understood pattern |
| **Password Hashing** | bcrypt | 5.x | Industry standard for password hashing, adaptive cost factor |
| **Validation** | Zod | 3.x | TypeScript-first schema validation, excellent inference, composable |
| **Testing** | Jest + Supertest | 29.x / 7.x | Jest: full-featured test runner; Supertest: HTTP assertion library for integration tests |
| **Containerization** | Docker + Docker Compose | latest | Consistent dev environment, easy PostgreSQL setup, reproducible builds |
| **API Documentation** | Swagger/OpenAPI via swagger-jsdoc + swagger-ui-express | - | Auto-generated interactive docs, doubles as Postman-importable spec |
| **Logging** | Pino | 8.x | Fast structured JSON logging, low overhead |
| **Environment Config** | dotenv | 17.x | Simple `.env.local` / `.env.test` file loading |
| **HTTP Client (tests)** | Supertest (NOT axios) | 7.x | Direct HTTP testing without axios, tests Express app in-process |
| **UUID Generation** | `uuidv7` (npm) | 1.x | UUIDv7 is time-ordered — dramatically better B-tree index performance vs UUIDv4 |
| **In-Memory Cache** | node-cache | 5.x | Lightweight TTL cache for auth user lookups; avoids Redis dependency |
| **Rate Limiting** | express-rate-limit | 7.x | Protects auth endpoints, simple setup |
| **CORS** | cors | 2.x | Cross-origin support for Postman/frontend clients |
| **Helmet** | helmet | 7.x | Security headers out of the box |
| **Postgres Driver** | pg | 8.x | Robust PostgreSQL client for Node.js, used as the driver for Prisma |
| **Prisma Adapter** | @prisma/adapter-pg | 7.x | Official adapter for Prisma to use `pg` as the database driver |

### Why NOT these alternatives?

| Rejected | Reason |
|---|---|
| **Axios** | Explicitly excluded per requirement (compromised npm module) |
| **TypeORM** | Prisma offers better type safety, migration UX, and developer experience |
| **Sequelize** | Dated API, weaker TypeScript support compared to Prisma |
| **NestJS** | Over-engineered for a focused take-home; Express is leaner and more transparent |
| **MongoDB** | Relational data (orders → meals → restaurants) benefits from PostgreSQL's referential integrity |
| **Passport.js** | Adds abstraction we don't need; custom JWT middleware is simpler and more transparent |

---

## 3. Project Structure

```
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── .env.local
├── .env.test
├── package.json
├── tsconfig.json
├── jest.config.ts
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── migrations/            # Auto-generated migrations
│   └── seed.ts                # Seed built-in admin + test data
├── src/
│   ├── app.ts                 # Express app setup (middleware, routes)
│   ├── server.ts              # Server entry point (listen)
│   ├── config/
│   │   └── index.ts           # Environment config with validation
│   ├── middleware/
│   │   ├── authenticate.ts    # JWT verification middleware
│   │   ├── authorize.ts       # Role-based permission middleware
│   │   ├── validate.ts        # Zod schema validation middleware
│   │   ├── errorHandler.ts    # Global error handler
│   │   └── rateLimiter.ts     # Rate limiting for auth endpoints
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.schema.ts       # Zod validation schemas
│   │   │   └── auth.test.ts
│   │   ├── users/
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.routes.ts
│   │   │   ├── users.schema.ts
│   │   │   └── users.test.ts
│   │   ├── restaurants/
│   │   │   ├── restaurants.controller.ts
│   │   │   ├── restaurants.service.ts
│   │   │   ├── restaurants.routes.ts
│   │   │   ├── restaurants.schema.ts
│   │   │   └── restaurants.test.ts
│   │   ├── meals/
│   │   │   ├── meals.controller.ts
│   │   │   ├── meals.service.ts
│   │   │   ├── meals.routes.ts
│   │   │   ├── meals.schema.ts
│   │   │   └── meals.test.ts
│   │   ├── orders/
│   │   │   ├── orders.controller.ts
│   │   │   ├── orders.service.ts
│   │   │   ├── orders.routes.ts
│   │   │   ├── orders.schema.ts
│   │   │   └── orders.test.ts
│   │   └── coupons/
│   │       ├── coupons.controller.ts
│   │       ├── coupons.service.ts
│   │       ├── coupons.routes.ts
│   │       ├── coupons.schema.ts
│   │       └── coupons.test.ts
│   ├── utils/
│   │   ├── errors.ts          # Custom error classes (AppError, NotFoundError, etc.)
│   │   ├── prisma.ts          # Prisma client singleton
│   │   └── response.ts        # Standardized API response helpers
│   └── types/
│       └── index.ts           # Shared TypeScript types/interfaces
├── docs/
│   ├── tech-specs.md          # This document
│   ├── assumptions.md         # Assumptions document
│   └── key-decisions.md       # Key decisions document
└── tests/
    ├── setup.ts               # Global test setup (DB reset, seed admin)
    ├── helpers.ts             # Test utilities (login, create fixtures)
    └── integration/           # End-to-end API tests
        ├── auth.test.ts
        ├── users.test.ts
        ├── restaurants.test.ts
        ├── meals.test.ts
        ├── orders.test.ts
        └── coupons.test.ts
```

---

## 4. Database Schema (Prisma)

### 4.1 Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Restaurant : owns
    User ||--o{ Order : places
    Restaurant ||--o{ Meal : has
    Restaurant ||--o{ Order : receives
    Restaurant ||--o{ Coupon : offers
    Order ||--o{ OrderItem : contains
    Order ||--o{ OrderStatusHistory : tracks
    Order }o--o| Coupon : uses
    Meal ||--o{ OrderItem : "included in"

    User {
        uuid id PK
        string email UK
        string password
        string name
        enum role
        boolean isBlocked
        boolean isBuiltInAdmin
        datetime createdAt
        datetime updatedAt
    }

    Restaurant {
        uuid id PK
        string name
        string description
        uuid ownerId FK
        boolean isBlocked
        datetime createdAt
        datetime updatedAt
    }

    Meal {
        uuid id PK
        string name
        string description
        decimal price
        uuid restaurantId FK
        boolean isAvailable
        boolean isBlocked
        datetime createdAt
        datetime updatedAt
    }

    Coupon {
        uuid id PK
        string code UK
        decimal discountPercent
        uuid restaurantId FK
        boolean isActive
        integer maxUsageTotal
        integer maxUsagePerCustomer
        integer currentUsageTotal
        datetime expiresAt
        datetime createdAt
    }

    CouponUsage {
        uuid id PK
        uuid couponId FK
        uuid customerId FK
        uuid orderId FK
        datetime usedAt
    }

    Order {
        uuid id PK
        uuid customerId FK
        uuid restaurantId FK
        enum status
        decimal subtotal
        decimal discountAmount
        decimal tipAmount
        decimal totalAmount
        uuid couponId FK
        datetime createdAt
        datetime updatedAt
    }

    OrderItem {
        uuid id PK
        uuid orderId FK
        uuid mealId FK
        integer quantity
        decimal unitPrice
        decimal itemTotal
    }

    OrderStatusHistory {
        uuid id PK
        uuid orderId FK
        enum status
        uuid changedById FK
        datetime changedAt
    }
```

### 4.2 Enums

```typescript
enum Role {
  CUSTOMER       = 'CUSTOMER'
  RESTAURANT_OWNER = 'RESTAURANT_OWNER'
  ADMIN          = 'ADMIN'
}

enum OrderStatus {
  PLACED      = 'PLACED'
  CANCELED    = 'CANCELED'
  PROCESSING  = 'PROCESSING'
  IN_ROUTE    = 'IN_ROUTE'
  DELIVERED   = 'DELIVERED'
  RECEIVED    = 'RECEIVED'
}
```

### 4.3 Key Schema Details

- **User.isBuiltInAdmin**: `true` only for the seeded admin; prevents deletion.
- **Meal.isAvailable**: Soft toggle for restaurant owners to hide meals without deleting.
- **Meal.isBlocked / Restaurant.isBlocked / User.isBlocked**: Admin-level blocking support.
- **OrderItem.unitPrice**: Snapshot of the meal price at order time (prices may change later).
- **Order.subtotal**: Sum of all `OrderItem.itemTotal` values before discount/tip.
- **Order.discountAmount**: Calculated from coupon percentage × subtotal.
- **Order.totalAmount**: `subtotal - discountAmount + tipAmount`.
- **Coupon.maxUsageTotal**: Maximum number of times this coupon can be used across all customers. `null` = unlimited.
- **Coupon.maxUsagePerCustomer**: Maximum uses per individual customer. `null` = unlimited.
- **Coupon.currentUsageTotal**: Counter tracking total redemptions (incremented atomically in a transaction).
- **CouponUsage**: Join table tracking which customer used which coupon on which order. Used for per-customer limit enforcement.
- **UUIDv7**: All primary keys use UUIDv7 (time-ordered). This ensures sequential inserts into B-tree indexes, providing ~2-5x better insert performance compared to random UUIDv4.

---

## 5. API Endpoints

### 5.1 Authentication

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Register a new user (Customer or Restaurant Owner) | Public |
| POST | `/api/v1/auth/login` | Login and receive access + refresh tokens | Public |
| POST | `/api/v1/auth/refresh` | Exchange refresh token for new access token | Public (refresh token in body) |
| POST | `/api/v1/auth/logout` | Invalidate refresh token | Authenticated |
| GET | `/api/v1/auth/me` | Get current user profile | Authenticated |
| PATCH | `/api/v1/auth/me` | Update own profile (name, password) | Authenticated |

### 5.2 Users (Admin only)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/v1/users` | List all users (paginated, filterable) | Admin |
| GET | `/api/v1/users/:id` | Get user by ID | Admin |
| POST | `/api/v1/users` | Create a user (any role) | Admin |
| PATCH | `/api/v1/users/:id` | Update user info | Admin |
| DELETE | `/api/v1/users/:id` | Delete user (not built-in admin) | Admin |
| PATCH | `/api/v1/users/:id/block` | Block/unblock a user | Admin |

### 5.3 Restaurants

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/v1/restaurants` | List all restaurants (paginated) | Authenticated |
| GET | `/api/v1/restaurants/:id` | Get restaurant details | Authenticated |
| POST | `/api/v1/restaurants` | Create restaurant | Owner, Admin |
| PATCH | `/api/v1/restaurants/:id` | Update restaurant | Owner (own), Admin |
| DELETE | `/api/v1/restaurants/:id` | Delete restaurant | Owner (own), Admin |
| PATCH | `/api/v1/restaurants/:id/block` | Block/unblock restaurant | Admin |

### 5.4 Meals

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/v1/restaurants/:restaurantId/meals` | List meals for a restaurant | Authenticated |
| GET | `/api/v1/restaurants/:restaurantId/meals/:id` | Get meal details | Authenticated |
| POST | `/api/v1/restaurants/:restaurantId/meals` | Create meal | Owner (own restaurant), Admin |
| PATCH | `/api/v1/restaurants/:restaurantId/meals/:id` | Update meal | Owner (own restaurant), Admin |
| DELETE | `/api/v1/restaurants/:restaurantId/meals/:id` | Delete meal | Owner (own restaurant), Admin |

### 5.5 Orders

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/v1/orders` | Place a new order | Customer |
| GET | `/api/v1/orders` | List orders (own orders for customer; restaurant orders for owner; all for admin) | Authenticated |
| GET | `/api/v1/orders/:id` | Get order details with status history | Authenticated |
| PATCH | `/api/v1/orders/:id/status` | Update order status | Customer, Owner, Admin |

### 5.6 Coupons

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/v1/restaurants/:restaurantId/coupons` | List coupons for a restaurant | Authenticated |
| POST | `/api/v1/restaurants/:restaurantId/coupons` | Create coupon | Owner (own restaurant), Admin |
| PATCH | `/api/v1/restaurants/:restaurantId/coupons/:id` | Update coupon | Owner (own restaurant), Admin |
| DELETE | `/api/v1/restaurants/:restaurantId/coupons/:id` | Delete coupon | Owner (own restaurant), Admin |

---

## 6. Authentication & Authorization

### 6.1 Authentication Flow

```
┌──────────┐     POST /auth/login      ┌──────────┐
│  Client   │ ──────────────────────▶  │  Server   │
│ (Postman) │     {email, password}     │           │
│           │                           │  Verify   │
│           │  ◀──────────────────────  │  Password │
│           │     {accessToken,         │  + Issue  │
│           │      user}                │    JWT    │
└──────────┘                           └──────────┘
                                            │
     Subsequent requests:                   │
     Authorization: Bearer <token>          │
                                            ▼
                                       Middleware
                                       verifies
                                       JWT on every
                                       protected route
```

### 6.2 JWT Token Design

**Access Token** (short-lived):
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "CUSTOMER",
  "type": "access",
  "iat": 1712700000,
  "exp": 1712700900
}
```

**Refresh Token** (long-lived):
```json
{
  "sub": "user-uuid",
  "type": "refresh",
  "jti": "unique-token-id",
  "iat": 1712700000,
  "exp": 1713304800
}
```

| Token | TTL | Purpose |
|---|---|---|
| **Access Token** | 15 minutes | Used in `Authorization: Bearer <token>` for API requests |
| **Refresh Token** | 7 days | Used to obtain new access tokens without re-login |

- **Access Secret**: `JWT_ACCESS_SECRET` env var.
- **Refresh Secret**: `JWT_REFRESH_SECRET` env var (separate secret for defense in depth).
- **Algorithm**: HS256.
- **Refresh Token Storage**: Stored in DB (`RefreshToken` table) with `userId`, `jti`, `expiresAt`, `isRevoked`. This allows server-side invalidation on logout or user block.
- **Rotation**: On each `/auth/refresh`, the old refresh token is revoked and a new pair (access + refresh) is issued.

### 6.3 Authorization Middleware

```typescript
// Usage in routes:
router.post('/restaurants',
  authenticate,                        // Verifies JWT, attaches req.user
  authorize('RESTAURANT_OWNER', 'ADMIN'), // Checks role
  validate(createRestaurantSchema),    // Validates body
  controller.create
);
```

- `authenticate`: Extracts and verifies JWT from `Authorization: Bearer <token>` header. Rejects blocked users.
- `authorize(...roles)`: Checks if `req.user.role` is in the allowed roles list.
- `validate(schema)`: Validates `req.body` / `req.query` / `req.params` against Zod schemas.

### 6.4 Ownership Checks

Beyond role checks, resource-level authorization ensures:
- Restaurant Owners can only modify **their own** restaurants and meals.
- Customers can only view/modify **their own** orders.
- These checks happen in the **service layer**, not middleware, for cleaner separation.

---

## 7. Order Status State Machine

```mermaid
stateDiagram-v2
    [*] --> Placed : Customer places order
    Placed --> Canceled : Customer OR Owner
    Placed --> Processing : Owner
    Processing --> Canceled : Owner
    Processing --> InRoute : Owner
    InRoute --> Delivered : Owner
    Delivered --> Received : Customer
```

### Valid Transitions Matrix

| Current Status | → Canceled | → Processing | → In Route | → Delivered | → Received |
|---|---|---|---|---|---|
| **Placed** | Customer, Owner | Owner | ✗ | ✗ | ✗ |
| **Processing** | Owner | — | Owner | ✗ | ✗ |
| **In Route** | ✗ | ✗ | — | Owner | ✗ |
| **Delivered** | ✗ | ✗ | ✗ | — | Customer |
| **Canceled** | — | ✗ | ✗ | ✗ | ✗ |
| **Received** | ✗ | ✗ | ✗ | ✗ | — |

> **Admin** can perform any valid transition regardless of the role column above.

---

## 8. Request/Response Format

### Standard Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

### HTTP Status Codes Used

| Code | Usage |
|---|---|
| 200 | Successful GET, PATCH |
| 201 | Successful POST (resource created) |
| 204 | Successful DELETE |
| 400 | Validation errors |
| 401 | Missing/invalid authentication |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (duplicate email, etc.) |
| 422 | Business logic error (invalid status transition, etc.) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## 9. Pagination & Field Selection

All list (GET collection) endpoints support pagination, search, sorting, and field selection by default. Single-resource GET endpoints support field selection only.

### 9.1 Pagination Parameters

```
GET /api/v1/restaurants?page=2&limit=10&search=pizza&sortBy=name&sortOrder=asc
```

| Param | Default | Description |
|---|---|---|
| `page` | 1 | Page number |
| `limit` | 20 | Items per page (max 100) |
| `search` | — | Search by name (where applicable) |
| `sortBy` | `createdAt` | Sort field |
| `sortOrder` | `desc` | `asc` or `desc` |

### 9.2 Field Selection (Sparse Fieldsets)

All GET endpoints support the `fields` query parameter to return only requested fields:

```
GET /api/v1/users?fields=id,email,name,role
GET /api/v1/restaurants/abc-123?fields=id,name,description
```

- If `fields` is omitted, all fields are returned (default behavior).
- Field names are validated against a **whitelist** per resource — requesting non-existent or sensitive fields (e.g., `password`) returns a 400 error.
- Implementation: The `fields` query param is parsed into a Prisma `select` object. Since Prisma natively supports `select`, this is a lightweight addition.
- Nested relations are NOT selectable via this param (use dedicated endpoints instead).

```typescript
// Example: controller parses fields into Prisma select
const select = parseFieldSelection(req.query.fields, USER_SELECTABLE_FIELDS);
const users = await prisma.user.findMany({ select, ...pagination });
```

---

## 10. Testing Strategy

### 10.1 Test Categories

| Category | Tool | Scope |
|---|---|---|
| **Integration Tests** | Jest + Supertest | Full HTTP request → DB → response cycle |
| **Unit Tests** | Jest | Service-layer business logic (status transitions, calculations) |

### 10.2 Test Database Strategy

- A **separate test database** (`food_delivery_test`) spun up via Docker Compose.
- Tests run migrations before execution.
- Each test suite uses **transactions** (or truncation) to isolate test data.
- Global setup seeds the built-in admin account.

### 10.3 Test Coverage Goals

| Module | Key Test Cases |
|---|---|
| **Auth** | Register, login, duplicate email, invalid credentials, blocked user |
| **Users** | Admin CRUD, block/unblock, cannot delete built-in admin, role validation |
| **Restaurants** | Owner CRUD, customer read-only, admin CRUD, blocked restaurant |
| **Meals** | Owner CRUD under own restaurant, price validation, admin override |
| **Orders** | Place order, status transitions (all valid/invalid), tip, coupon discount, history |
| **Coupons** | Create, apply to order, expired coupon, invalid coupon |

### 10.4 Postman Collection

- A **Postman collection** (`postman/food-delivery-api.postman_collection.json`) will be exported.
- Uses **environment variables** (`{{baseUrl}}`, `{{accessToken}}`).
- Includes **pre-request scripts** to auto-login and set tokens.
- Covers all endpoints with example requests and expected responses.

---

## 11. Docker Setup

### docker-compose.yml

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: food_delivery
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  db-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: food_delivery_test
    ports:
      - "5433:5432"

  app:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - db
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/food_delivery
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run dev

volumes:
  pgdata:
```

---

## 12. Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/food_delivery

# JWT
JWT_ACCESS_SECRET=your-access-secret-key-minimum-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-minimum-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Built-in Admin
ADMIN_EMAIL=admin@fooddelivery.com
ADMIN_PASSWORD=Admin@123456
ADMIN_NAME=System Admin

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Cache
USER_CACHE_TTL_SECONDS=60
```

---

## 13. Scripts (package.json)

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:migrate": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:seed": "prisma db seed",
    "db:reset": "prisma migrate reset --force",
    "db:studio": "prisma studio",
    "test": "jest --runInBand --forceExit",
    "test:watch": "jest --watch --runInBand",
    "test:coverage": "jest --coverage --runInBand --forceExit",
    "lint": "eslint src/ tests/",
    "format": "prettier --write 'src/**/*.ts' 'tests/**/*.ts'"
  }
}
```

---

## 14. Error Handling Architecture

```typescript
// Custom error hierarchy
class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any[]
  ) { super(message); }
}

class NotFoundError extends AppError { /* 404 */ }
class ValidationError extends AppError { /* 400 */ }
class UnauthorizedError extends AppError { /* 401 */ }
class ForbiddenError extends AppError { /* 403 */ }
class ConflictError extends AppError { /* 409 */ }
class BusinessLogicError extends AppError { /* 422 */ }
```

Global error handler middleware catches all errors, logs them, and returns standardized responses. Prisma-specific errors (unique constraint, not found) are mapped to appropriate HTTP responses.

---

## 15. Security Considerations

| Concern | Mitigation |
|---|---|
| Password storage | bcrypt with cost factor 12 |
| SQL injection | Prisma parameterized queries (ORM prevents raw SQL injection) |
| XSS | Helmet security headers, no HTML rendering |
| Rate limiting | express-rate-limit on auth endpoints |
| Input validation | Zod schemas on all inputs |
| CORS | Configurable origins |
| Secrets | Environment variables, never committed |
| Blocked users | JWT middleware checks `isBlocked` status (cached with 60s TTL) |
| Token revocation | Refresh tokens stored in DB, revoked on logout/block |
| Admin protection | Built-in admin cannot be deleted (enforced in service layer) |

---

## 16. Caching Strategy

We use **node-cache** (in-process, TTL-based) to avoid a DB round-trip on every authenticated request.

### What is cached

| Cache Key | TTL | Data | Invalidation |
|---|---|---|---|
| `user:{id}` | 60 seconds | `{ id, role, isBlocked }` | On user update/block (cache.del) |

### Why node-cache, not Redis?

| Factor | node-cache | Redis |
|---|---|---|
| Infrastructure | None (in-process) | Separate server/container |
| Latency | ~0ms (memory) | ~0.5ms (network) |
| Scalability | Single-process only | Multi-process/multi-server |
| Fit for take-home | ✅ Perfect | ❌ Over-engineered |

For a single-process API (which this is), node-cache is the right tool. In production with horizontal scaling, we'd swap to Redis. The cache interface is abstracted behind a `CacheService` so this swap is a single-file change.

### How it works in the auth middleware

```typescript
// authenticate.ts
const cached = cache.get<UserCacheData>(`user:${decoded.sub}`);
if (cached) {
  if (cached.isBlocked) throw new UnauthorizedError('Account is blocked');
  req.user = { id: cached.id, role: cached.role, ...decoded };
  return next();
}
// Cache miss → DB lookup → cache.set(`user:${id}`, data, TTL)
```

**Worst case**: A blocked user retains access for up to 60 seconds before the cache expires. This is an acceptable trade-off vs. hitting the DB on every single request.

---

## 17. Transaction Strategy

### When we use Prisma transactions

| Operation | Transaction? | Reason |
|---|---|---|
| **Order creation** | ✅ `prisma.$transaction()` | Creates Order + OrderItems + OrderStatusHistory + CouponUsage + increments coupon counter atomically. Partial creation would leave orphan records. |
| **Order status change** | ✅ `prisma.$transaction()` | Updates Order.status + creates OrderStatusHistory entry. Both must succeed or neither. |
| **User deletion** | ✅ `prisma.$transaction()` | Deletes user + revokes all refresh tokens + cascades related data. |
| **Restaurant deletion** | ✅ `prisma.$transaction()` | Guards against active orders, then deletes restaurant + meals + coupons atomically. |
| **Single-row CRUD** | ❌ No transaction | `prisma.user.create()`, `prisma.meal.update()` etc. are inherently atomic — Prisma wraps single operations in implicit transactions. |
| **Read-only queries** | ❌ No transaction | No mutation = no consistency risk. |

### Why explicit transactions for multi-table writes?

Without a transaction, a failure between steps leaves the database in an inconsistent state:
- Order created but OrderItems missing → customer sees empty order.
- Coupon usage counter incremented but order creation fails → coupon wasted.

Prisma's `$transaction()` uses PostgreSQL's `BEGIN...COMMIT/ROLLBACK`, ensuring atomicity.

```typescript
// Example: Order creation transaction
const order = await prisma.$transaction(async (tx) => {
  const newOrder = await tx.order.create({ data: orderData });
  await tx.orderItem.createMany({ data: itemsData });
  await tx.orderStatusHistory.create({ data: { orderId: newOrder.id, status: 'PLACED', ... } });
  if (coupon) {
    await tx.coupon.update({ where: { id: coupon.id }, data: { currentUsageTotal: { increment: 1 } } });
    await tx.couponUsage.create({ data: { couponId: coupon.id, customerId, orderId: newOrder.id } });
  }
  return newOrder;
});
```

---

## 18. Admin API URL Design

Admin-only endpoints live under `/api/v1/admin/...` to provide a clear separation.

| Endpoint Pattern | Who accesses it |
|---|---|
| `/api/v1/auth/*` | Everyone (public + authenticated) |
| `/api/v1/restaurants/*`, `/api/v1/orders/*` | Customers + Owners (role-checked in middleware) |
| `/api/v1/admin/users/*` | Admin only |
| `/api/v1/admin/restaurants/:id/block` | Admin only |
| `/api/v1/admin/users/:id/block` | Admin only |

**Why prefix admin routes?**
- **Self-documenting**: Anyone reading the URL immediately knows it's an admin operation.
- **Security layering**: A reverse proxy or API gateway can add extra protection (IP whitelisting, additional auth) to `/admin/*` routes without touching application code.
- **Postman organization**: Admin routes group naturally in a dedicated folder.
- **Audit logging**: Easy to add middleware that logs all `/admin/*` requests for compliance.

Non-admin operations on shared resources (e.g., owner updating their own restaurant) stay on the standard `/api/v1/restaurants/:id` routes with role checks in middleware.

---

## 19. Tax Calculation — Future Roadmap

> **Note**: Tax calculation is **not implemented** in the current version. This section documents the planned approach for a future release.

### Planned Schema Additions

```prisma
model TaxConfig {
  id             String   @id @default(uuid())
  name           String   // e.g., "GST", "Sales Tax", "VAT"
  rate           Decimal  @db.Decimal(5, 4)  // e.g., 0.0825 for 8.25%
  isInclusive    Boolean  @default(false)    // true = tax included in meal price
  region         String?  // e.g., "US-CA", "IN-MH" — nullable for flat-rate
  restaurantId   String?  // nullable = global; set = restaurant-specific override
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
}

// Order model additions:
model Order {
  // ... existing fields ...
  taxRate        Decimal? @db.Decimal(5, 4)
  taxAmount      Decimal? @db.Decimal(10, 2)
  // totalAmount becomes: subtotal - discountAmount + taxAmount + tipAmount
}
```

### Calculation Flow

```
subtotal = Σ(quantity × unitPrice)
discountAmount = subtotal × (couponPercent / 100)
taxableAmount = subtotal - discountAmount
taxAmount = taxableAmount × taxRate
totalAmount = taxableAmount + taxAmount + tipAmount
```

### Design Decisions (Future)
- Tax rate is **snapshotted** into the Order at creation time (same pattern as price snapshotting).
- Tax is applied **after discount, before tip** (standard practice).
- `isInclusive` flag supports both tax-exclusive (US) and tax-inclusive (EU/India) models.
- Restaurant-level overrides allow different tax rates per restaurant (useful for multi-state/multi-country).
- Admin can CRUD TaxConfig entries.

---

## 20. Development Workflow

1. `docker compose up -d db db-test` — Start PostgreSQL instances
2. `npm install` — Install dependencies
3. `npx prisma migrate dev` — Run migrations
4. `npx prisma db seed` — Seed built-in admin
5. `npm run dev` — Start development server
6. `npm test` — Run all tests
7. Import Postman collection for manual testing
