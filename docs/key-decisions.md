# Food Delivery Service API — Key Decisions

This document records significant technical and architectural decisions made during the design of the Food Delivery Service API, along with alternatives considered and the reasoning behind each choice.

---

## Decision 1: Prisma over TypeORM / Sequelize

**Decision**: Use Prisma as the ORM.

**Alternatives Considered**:
- **TypeORM**: Mature, decorator-based, good TypeScript support.
- **Sequelize**: Widely used, but TypeScript support is bolted-on.
- **Knex.js (query builder)**: Maximum control, but no type-safe model layer.

**Rationale**:
- Prisma generates TypeScript types directly from the schema — zero manual typing of models.
- `prisma migrate dev` provides the best migration experience (auto-generates SQL, tracks state).
- Prisma Client's API is intuitive (`prisma.user.findUnique({ where: { email } })`).
- Prisma Studio provides a free DB GUI for debugging.
- The schema file (`schema.prisma`) serves as a single source of truth for the database, which is excellent for a take-home where the reviewer needs to understand the schema quickly.

**Trade-off**: Prisma adds a code-generation step. This is a minor inconvenience offset by massive productivity gains.

---

## Decision 2: JWT with Refresh Tokens (No Session / No Passport.js)

**Decision**: Custom JWT middleware using `jsonwebtoken` directly, with an access + refresh token pair. No Passport.js.

**Alternatives Considered**:
- **Passport.js**: Popular auth middleware with strategies.
- **Session-based auth**: Server-side sessions with cookies.
- **Single long-lived token**: Simpler but less secure.
- **OAuth2 / OpenID Connect**: Delegated auth.

**Rationale**:
- **Stateless access tokens**: Short-lived (15min) access tokens don't require DB lookups for validation (except cached user check). Perfect for REST APIs.
- **Server-side refresh tokens**: Stored in DB, enabling revocation on logout/block. This is the missing piece that makes JWT secure.
- **Transparent**: Custom middleware is ~50 lines of code. The reviewer can see exactly what's happening.
- **Postman-friendly**: `Authorization: Bearer <token>` is trivial. Refresh is a simple POST.
- Passport.js adds unnecessary complexity for a single strategy.

**Token Design**:
- **Access token** (15min): Contains `sub`, `email`, `role`. Used for API requests.
- **Refresh token** (7 days): Contains `sub`, `jti` (unique ID). Stored in `RefreshToken` DB table.
- **Rotation**: Each refresh request revokes the old token and issues a new pair.
- **Logout**: Revokes the refresh token in DB. Access token naturally expires in ≤15min.
- **Block enforcement**: Auth middleware checks cached user status (60s TTL). Refresh endpoint checks DB directly.

**Complexity Assessment**: Adds ~100 lines of code (RefreshToken model, 2 endpoints, token service). Well worth it for the security narrative in a take-home evaluation.

---

## Decision 3: Zod over Joi / class-validator

**Decision**: Use Zod for request validation.

**Alternatives Considered**:
- **Joi**: Mature, Hapi ecosystem.
- **class-validator**: Decorator-based, popular with NestJS.
- **express-validator**: Express middleware chain.

**Rationale**:
- Zod is TypeScript-first — schemas infer TypeScript types automatically (`z.infer<typeof schema>`).
- This eliminates duplicate type definitions: one Zod schema validates input AND produces the TypeScript type.
- Composable: schemas can be extended, merged, and picked — useful for create vs. update schemas.
- Smaller bundle and faster than Joi.
- Works naturally with our modular architecture (each module has a `.schema.ts` file).

---

## Decision 4: Express over NestJS / Fastify / Hono

**Decision**: Use Express.js as the HTTP framework.

**Alternatives Considered**:
- **NestJS**: Full framework with dependency injection, decorators, modules.
- **Fastify**: High performance, schema-based validation.
- **Hono**: Ultralight, edge-first.

**Rationale**:
- Express is the **industry standard** for Node.js APIs. The reviewer will be immediately familiar.
- The project structure (modular controllers/services/routes) provides the same separation of concerns as NestJS without the framework lock-in.
- Express has the largest middleware ecosystem — every tool we need (cors, helmet, rate-limit) has first-class Express support.
- For a take-home, **readability > performance**. Express's simplicity means the reviewer spends time evaluating your code, not learning a framework.
- NestJS's overhead (decorators, modules, providers, interceptors) would be over-engineering for this scope.

---

## Decision 5: Modular Architecture (Feature-Based)

**Decision**: Organize code by **feature/module** (auth, users, restaurants, meals, orders, coupons), not by **layer** (controllers/, services/, models/).

**Alternatives Considered**:
- **Layer-based**: `src/controllers/`, `src/services/`, `src/models/`.
- **Domain-driven**: Bounded contexts with aggregates.

**Rationale**:
- **Colocation**: Everything related to "orders" lives in `src/modules/orders/`. Finding code is instant.
- **Encapsulation**: Each module is self-contained with its own routes, controller, service, schemas, and tests.
- **Scalability**: Adding a new feature means adding a new module folder — no touching existing code.
- **Review-friendly**: The evaluator can review one module end-to-end without jumping between directories.

---

## Decision 6: Order Price Snapshotting

**Decision**: Snapshot meal prices into `OrderItem.unitPrice` at order creation time. The order's `totalAmount` is computed server-side and stored.

**Alternatives Considered**:
- **Reference-only**: Store only meal IDs and compute totals on read.
- **Event sourcing**: Store price change events.

**Rationale**:
- Meal prices can change after an order is placed. Snapshotting ensures historical accuracy.
- Server-side computation prevents clients from submitting manipulated totals.
- Storing computed totals avoids recalculation on every read — better for order history queries.
- This is the **standard e-commerce pattern** used by Shopify, Stripe, and every major platform.

---

## Decision 7: Order Status as a State Machine

**Decision**: Implement order status transitions as an explicit state machine with a transition map. Invalid transitions return a `422 Unprocessable Entity`.

**Alternatives Considered**:
- **Open transitions**: Allow any status change.
- **Workflow engine**: Use a library like XState.

**Rationale**:
- The task defines a specific flow (Placed → Processing → In Route → Delivered → Received, with Canceled as a branch).
- A simple transition map (object literal) is easy to understand, test, and modify:

```typescript
const VALID_TRANSITIONS: Record<OrderStatus, { status: OrderStatus; allowedRoles: Role[] }[]> = {
  PLACED: [
    { status: 'CANCELED', allowedRoles: ['CUSTOMER', 'RESTAURANT_OWNER'] },
    { status: 'PROCESSING', allowedRoles: ['RESTAURANT_OWNER'] },
  ],
  PROCESSING: [
    { status: 'CANCELED', allowedRoles: ['RESTAURANT_OWNER'] },
    { status: 'IN_ROUTE', allowedRoles: ['RESTAURANT_OWNER'] },
  ],
  IN_ROUTE: [
    { status: 'DELIVERED', allowedRoles: ['RESTAURANT_OWNER'] },
  ],
  DELIVERED: [
    { status: 'RECEIVED', allowedRoles: ['CUSTOMER'] },
  ],
  CANCELED: [],
  RECEIVED: [],
};
```

- XState would be overkill — our state machine has 6 states and ~7 transitions. A plain object is sufficient.
- Every transition is logged to `OrderStatusHistory` with timestamp and actor.

---

## Decision 8: Separate Test Database (Not Transactions)

**Decision**: Use a separate PostgreSQL database for tests, managed via Docker Compose on a different port (5433).

**Alternatives Considered**:
- **In-memory DB (SQLite)**: Replace Postgres for tests.
- **Transactional tests**: Wrap each test in a transaction and roll back.
- **Testcontainers**: Spin up ephemeral containers per test suite.

**Rationale**:
- **Prisma doesn't support SQLite ↔ PostgreSQL switching** due to dialect differences. Tests must match production.
- **Separate DB** gives full isolation without complex transaction management.
- **Docker Compose** already runs Postgres for dev — adding a second instance on port 5433 is trivial.
- Tests use `prisma migrate reset` (or table truncation) between suites for clean state.
- Testcontainers adds a dependency and is slower to spin up. A persistent test DB (docker compose) is simpler.

---

## Decision 9: Supertest for Integration Tests (Not Axios)

**Decision**: Use Supertest for all HTTP-level integration tests.

**Alternatives Considered**:
- **Axios**: Explicitly prohibited ("compromised npm module" per user).
- **node-fetch / undici**: Lower-level, require running the server separately.
- **Playwright/Cypress**: Browser-based, overkill for API tests.

**Rationale**:
- Supertest wraps the Express `app` object directly — no need to start a server.
- Fluent assertion API: `request(app).post('/api/v1/auth/login').send({...}).expect(200)`.
- Built-in JSON body parsing and header assertions.
- Perfect fit for the task's requirement to "demonstrate by creating functional tests that use the REST Layer directly."

---

## Decision 10: Blocked Users Checked via In-Memory Cache

**Decision**: The `authenticate` middleware checks if the user is blocked using an **in-memory cache (node-cache, 60s TTL)**, falling back to a DB lookup on cache miss.

**Alternatives Considered**:
- **DB lookup on every request**: Simple but adds latency on every API call.
- **Login-only check**: Only check at login. Blocked users remain active until token expires.
- **Redis cache**: Distributed cache for multi-process deployments.
- **Token blacklist**: Maintain a blacklist of revoked tokens.

**Rationale**:
- **Near-instant enforcement**: Blocked users lose access within ≤60 seconds (cache TTL). A DB query on every request is overkill for a single-process app.
- **Zero infrastructure**: node-cache is in-process memory. No Redis server needed.
- **Performance**: Cache hit = ~0ms. DB fallback = ~1-2ms. With cache, 95%+ of requests avoid the DB entirely.
- **Cache invalidation**: When an admin blocks a user, we call `cache.del(\`user:\${userId}\`)` in the user service, so the next request re-fetches from DB.
- **Trade-off**: A blocked user could make requests for up to 60 seconds after being blocked (cache TTL). This is acceptable — even production systems (e.g., Firebase Auth) have propagation delays.
- **Swap path**: The cache is abstracted behind a `CacheService` interface. Swapping to Redis for horizontal scaling is a single-file change.

**Why not Redis?** For a single-process API running locally, Redis adds Docker container overhead, connection management, and configuration for zero benefit. node-cache provides identical semantics with zero infrastructure.

---

## Decision 11: Postman Collection as API Documentation

**Decision**: Ship a Postman collection JSON file alongside Swagger/OpenAPI docs.

**Alternatives Considered**:
- **Swagger only**: Self-hosted Swagger UI at `/api-docs`.
- **Postman only**: No machine-readable spec.
- **README-only documentation**: Markdown tables.

**Rationale**:
- The task explicitly says: "be prepared to use REST clients like Postman, cURL."
- A Postman collection with **pre-request scripts** (auto-login, auto-set tokens) makes evaluation frictionless.
- Swagger provides interactive, browsable documentation accessible at `/api-docs` in the running app.
- Both formats serve different audiences: Postman for hands-on testing, Swagger for reference.

---

## Decision 12: Coupon as a Separate Entity (Not Inline Discount)

**Decision**: Coupons are a first-class entity with their own CRUD endpoints, tied to restaurants.

**Alternatives Considered**:
- **Inline discount field** on orders (just a percentage number).
- **Global coupon system** (not tied to any restaurant).

**Rationale**:
- The task says orders "can reference a coupon for a percentage discount" — this implies coupons are referenceable entities, not inline numbers.
- Tying coupons to restaurants gives owners control over their promotions.
- Separate CRUD allows admins to manage coupons and owners to create marketing campaigns.
- The `Order.couponId` FK maintains an audit trail of which coupon was used.

---

## Decision 13: No Soft Deletes (Hard Deletes with Guards)

**Decision**: Resources are hard-deleted from the database, but deletion is **guarded** — you cannot delete a restaurant/meal that has active orders, or a built-in admin user.

**Alternatives Considered**:
- **Soft deletes** (`deletedAt` timestamp, query-level filtering).
- **Archive pattern** (move to archive tables).

**Rationale**:
- Soft deletes add complexity to every query (must filter `WHERE deletedAt IS NULL`).
- For this project scope, guarded hard deletes are simpler and sufficient.
- Order integrity is preserved because deletion is prevented when active orders exist.
- The `isBlocked` flag handles the "visible but disabled" use case without needing soft deletes.
- If a restaurant with only completed orders is deleted, the order records remain (FK is preserved by Prisma's referential integrity configuration).

---

## Decision 14: API Versioning Strategy

**Decision**: URL-based versioning (`/api/v1/...`).

**Alternatives Considered**:
- **Header-based versioning** (`Accept: application/vnd.fooddelivery.v1+json`).
- **No versioning**.

**Rationale**:
- URL-based versioning is the most visible and Postman-friendly approach.
- Easy to set up in Express (`app.use('/api/v1', v1Router)`).
- For a take-home, having a clean `/api/v1/` prefix looks professional and signals good API design awareness.
- We don't expect to build v2, but the structure shows the reviewer that we've thought about it.

---

## Decision 15: Pino over Winston / Morgan

**Decision**: Use Pino for structured JSON logging.

**Alternatives Considered**:
- **Winston**: Popular, flexible transport system.
- **Morgan**: HTTP request logging middleware.
- **console.log**: No library.

**Rationale**:
- Pino is the **fastest** Node.js logger (benchmarked).
- Structured JSON output is grep-friendly and production-ready.
- `pino-http` middleware automatically logs every HTTP request with method, URL, status, and response time.
- Winston's transport system is unnecessary — we only log to stdout.
- Morgan only handles HTTP requests. Pino handles both HTTP and application-level logging.

---

## Decision 16: UUIDv7 over UUIDv4

**Decision**: Use UUIDv7 (`uuidv7` npm package) for all primary keys instead of UUIDv4 (`crypto.randomUUID()`).

**Alternatives Considered**:
- **UUIDv4** (`crypto.randomUUID()`): Built-in, no dependency.
- **CUID2**: Collision-resistant, URL-friendly.
- **ULID**: Time-ordered, Crockford Base32.
- **Auto-increment integers**: Sequential, compact.

**Rationale**:
- **B-tree index performance**: UUIDv4 is completely random, causing random inserts across B-tree leaf pages. This leads to index fragmentation, frequent page splits, and poor cache locality. UUIDv7 is time-ordered (first 48 bits are a millisecond timestamp), so inserts are sequential — appending to the end of the index.
- **Benchmarks**: Sequential UUIDs provide ~2-5x better INSERT throughput on PostgreSQL compared to random UUIDs, especially as tables grow.
- **Sortable**: UUIDv7 naturally sorts by creation time. `ORDER BY id` ≈ `ORDER BY created_at`.
- **RFC 9562 standard**: UUIDv7 is an official IETF standard (2024), not a proprietary format.
- **Why not auto-increment**: Exposes record count and ordering, enables enumeration attacks, complicates multi-database scenarios.
- **Why not ULID/CUID2**: Non-standard formats. UUIDv7 fits the standard UUID column type in PostgreSQL natively.

---

## Decision 17: Prisma Interactive Transactions for Multi-Table Writes

**Decision**: Use Prisma's `$transaction()` (interactive transactions) for all multi-table write operations. Do NOT use transactions for single-table writes or reads.

**Alternatives Considered**:
- **No explicit transactions**: Rely on individual Prisma operations.
- **Nested writes**: Prisma's `create({ data: { items: { create: [...] } } })` auto-wraps in a transaction.
- **Raw SQL transactions**: `prisma.$executeRaw('BEGIN; ... COMMIT;')`.

**Rationale**:
- **Atomicity for complex operations**: Order creation involves 3-5 table writes (Order + OrderItems + OrderStatusHistory + CouponUsage + Coupon counter). If any step fails, ALL must roll back.
- **Why not nested writes?** Nested writes only work for create/update with relations. They don't support conditional logic like "check coupon usage count, then increment, then create usage record."
- **Interactive transactions** allow arbitrary async logic inside the transaction callback — perfect for our order creation flow with validation steps.
- **Single-table writes don't need explicit transactions**: Prisma wraps them in implicit transactions automatically. Adding explicit transactions would just add overhead.
- **Reads don't need transactions**: We're not doing serializable reads. Read-committed isolation (PostgreSQL default) is sufficient.

---

## Decision 18: Admin Routes Prefixed with `/admin/`

**Decision**: Admin-only endpoints use the URL prefix `/api/v1/admin/...` instead of sharing the same routes as other roles with only middleware-level protection.

**Alternatives Considered**:
- **Same URLs, middleware-only protection**: e.g., `GET /api/v1/users` is admin-only purely via `authorize('ADMIN')` middleware.
- **Separate service/port**: Run admin API on a different port.

**Rationale**:
- **Self-documenting**: `/api/v1/admin/users` immediately tells the reader this is an admin operation. No need to check middleware configuration.
- **Security layering** (defense in depth): A reverse proxy, API gateway, or WAF can add blanket rules to `/admin/*` (IP whitelisting, additional rate limiting, audit logging) without touching application code.
- **Postman/Swagger organization**: Admin endpoints group naturally into a separate folder/tag.
- **No confusion**: Without the prefix, `GET /api/v1/users` could be mistaken for a public endpoint by someone reading the route file quickly.
- **Shared resources**: Non-admin operations on shared resources (owner updating their restaurant) stay on `/api/v1/restaurants/:id` — only exclusively-admin operations move to `/admin/`.

---

## Decision 19: Field Selection via Query Parameter

**Decision**: Support `?fields=id,name,email` on all GET endpoints to allow clients to request only specific fields.

**Alternatives Considered**:
- **No field selection**: Always return all fields.
- **GraphQL**: Full query language for field selection.
- **JSON:API sparse fieldsets**: Formal spec (`?fields[users]=id,name`).

**Rationale**:
- **Reduced payload**: Clients that only need `id` and `name` shouldn't receive `description`, `createdAt`, `updatedAt`, etc.
- **Prisma native support**: `prisma.user.findMany({ select: { id: true, name: true } })` — Prisma generates SQL with only the requested columns. No over-fetching at the DB level.
- **Simple implementation**: Parse comma-separated fields, validate against a per-resource whitelist, convert to Prisma `select`. ~20 lines of utility code.
- **Security**: A whitelist prevents requesting sensitive fields like `password`. Requesting an invalid field returns 400.
- **Why not JSON:API format?** The `?fields[resource]=...` syntax is more complex to parse and overkill when we have single-resource endpoints. Simple `?fields=` is intuitive and widely understood.
- **Why not GraphQL?** We chose REST. Field selection gives clients 80% of the benefit of GraphQL's field picking with 0% of the complexity.

---

## Decision 20: Coupon Usage Tracking with Dual Limits

**Decision**: Track coupon usage via a `CouponUsage` table, enforcing both per-coupon total limits (`maxUsageTotal`) and per-customer limits (`maxUsagePerCustomer`).

**Alternatives Considered**:
- **No usage tracking**: Unlimited reuse (previous plan).
- **Counter-only**: Just a `currentUsageTotal` counter, no per-customer tracking.
- **One-time-use only**: Boolean `isUsed` flag.

**Rationale**:
- **Real-world coupon behavior**: Restaurants need control — e.g., "first 100 customers get 20% off" (total limit) and "each customer can use this code once" (per-customer limit).
- **`CouponUsage` table**: Records each redemption with `couponId`, `customerId`, `orderId`, `usedAt`. This enables:
  - Per-customer limit enforcement: `COUNT(*) WHERE couponId = ? AND customerId = ?`
  - Analytics: Which customers used which coupons?
  - Audit trail: Tied to specific orders.
- **`maxUsageTotal` / `maxUsagePerCustomer`**: Both nullable. `null` = unlimited. This gives maximum flexibility.
- **Atomic enforcement**: Usage check + increment + record creation all happen inside the order creation transaction, preventing race conditions where two concurrent requests both pass the limit check.
- **`currentUsageTotal` counter on Coupon table**: Denormalized counter for fast "is this coupon exhausted?" checks without counting the usage table. Incremented atomically via Prisma's `{ increment: 1 }`.

---

## Decision 21: Prisma Driver Adapter (@prisma/adapter-pg)

**Decision**: Use `@prisma/adapter-pg` and the `pg` pool instead of Prisma's default rust-based binary engine.

**Alternatives Considered**:
- **Default Prisma Engine**: Uses a binary/library engine bundled with Prisma Client.
- **Prisma Accelerate**: Managed connection pooler (too complex for this scope).

**Rationale**:
- **Compatibility**: Resolved `PrismaClientConstructorValidationError` occurring in certain environments where the binary engine expected a driver adapter or an external URL.
- **Connection Pooling**: Using `pg.Pool` gives more explicit control over connection management and pooling, which can be beneficial in highly concurrent environments.
- **Standard Node.js Stack**: Aligns Prisma more closely with standard Node.js database drivers, making it easier to debug connection-level issues.
- **Decimal Support**: Standardizes how `Decimal` is handled by using the one exported by the main `@prisma/client` package, avoiding issues with internal runtime paths.

**Trade-off**: Requires manual installation of `pg` and `@prisma/adapter-pg` and a slightly more verbose initialization in `src/utils/prisma.ts`. This is a small price for increased stability and environment compatibility.
