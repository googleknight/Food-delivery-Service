---
id: assumptions
title: Assumptions
sidebar_position: 2
---
# Food Delivery Service API — Assumptions

This document lists all assumptions made during the design and implementation of the Food Delivery Service API. These assumptions help clarify scope, guide implementation decisions, and set expectations for the evaluator.

---

## 1. Authentication & Users

| # | Assumption | Rationale |
|---|---|---|
| A1 | **No email verification** is required during registration. | Take-home scope; focus is on API design and authorization, not email infrastructure. |
| A2 | **Refresh token mechanism is implemented.** Short-lived access tokens (15 min) + long-lived refresh tokens (7 days) with DB-backed revocation. | Production-ready auth pattern. Refresh tokens stored in DB allow server-side invalidation on logout/block. Adds moderate complexity but significantly improves security posture. |
| A3 | **Users self-select their role** (Customer or Restaurant Owner) during registration. Admins are only created by other admins or via the seed. | The task says "Implement 2 roles" for self-service; Admin is system-managed. |
| A4 | **A user cannot change their own role.** Only admins can change a user's role. | Prevents privilege escalation. |
| A5 | **"Blocking" a user** means they cannot authenticate (JWT middleware rejects blocked users). Their data remains intact. | Soft-block approach; blocking ≠ deletion. |
| A6 | **The built-in admin** is seeded on first migration/seed run with credentials from environment variables. | Meets requirement: "one built-in admin that cannot be deleted." |
| A7 | **Passwords** must be at least 8 characters with at least one uppercase, one lowercase, one number, and one special character. | Reasonable security without being overly restrictive for a demo. |
| A8 | **Email uniqueness** is case-insensitive. Emails are stored in lowercase. | Prevents `User@email.com` and `user@email.com` from being separate accounts. |

---

## 2. Restaurants

| # | Assumption | Rationale |
|---|---|---|
| A9 | **A Restaurant Owner can own multiple restaurants.** | The task says "A restaurant should have a name and description." It doesn't restrict owners to one restaurant, and real-world owners often have multiple locations. |
| A10 | **Restaurant "description" is the description of the type of food** they serve (e.g., "Italian cuisine, wood-fired pizzas"). | Directly from task: "description of the type of food they serve." |
| A11 | **Deleting a restaurant** soft-deletes it or is blocked if it has active (non-terminal) orders. | Protects order integrity. We'll prevent hard-delete if there are orders in PLACED, PROCESSING, or IN_ROUTE status. |
| A12 | **Blocked restaurants** are not visible to customers but remain accessible to their owners and admins. | Blocking is an admin moderation tool. |

---

## 3. Meals

| # | Assumption | Rationale |
|---|---|---|
| A13 | **Meal prices are stored as decimal** (Prisma `Decimal` / PostgreSQL `NUMERIC(10,2)`). | Avoids floating-point precision issues with currency. |
| A14 | **Meals belong to exactly one restaurant.** No shared meals across restaurants. | Domain model: each restaurant manages its own menu. |
| A15 | **Meal prices can be updated** without affecting existing orders. Order items snapshot the price at order time via `OrderItem.unitPrice`. | Standard e-commerce pattern. Historical orders must reflect the price at time of purchase. |
| A16 | **Deleting a meal** is blocked if it appears in any active (non-terminal) orders. | Protects order integrity. |

---

## 4. Orders

| # | Assumption | Rationale |
|---|---|---|
| A17 | **An order must contain at least one meal.** Empty orders are rejected. | Logical business constraint. |
| A18 | **All meals in an order must belong to the same restaurant.** | Explicitly stated in the task: "An order should be placed for a single restaurant only." |
| A19 | **Order total calculation**: `totalAmount = subtotal - discountAmount + tipAmount`, where `subtotal = Σ(quantity × unitPrice)` and `discountAmount = subtotal × (coupon.discountPercent / 100)`. | The server computes totals; clients cannot set arbitrary totals. |
| A20 | **Tip amount** is optional, defaults to 0, and must be non-negative. | Tips are a positive gesture; negative tips don't make sense. |
| A21 | **A coupon is optional** when placing an order. If provided, it must be valid (active, not expired, belongs to the same restaurant). | Coupon validation happens server-side. |
| A22 | **Coupon usage is tracked** with both per-coupon total limits and per-customer limits. A `CouponUsage` table records each redemption. `maxUsageTotal` caps overall uses; `maxUsagePerCustomer` caps per-customer uses. Either can be `null` for unlimited. | Provides realistic coupon management. Enforced atomically within the order creation transaction to prevent race conditions. |
| A23 | **Order status history** records every transition with timestamp and the user who changed it. | Task: "Orders should have a history of the date and time of the status change." |
| A24 | **Canceled orders are terminal.** A canceled order cannot be reopened. | Standard business logic; prevents confusion. |
| A25 | **Received orders are terminal.** Once marked received, no further changes. | Final state in the lifecycle. |
| A26 | **Customers can only cancel orders in PLACED status.** After processing begins, only the restaurant owner (or admin) can cancel. | Reasonable business rule: once cooking starts, the customer shouldn't be able to cancel unilaterally. The task says "Canceled: If the customer or restaurant owner cancels the order" — we interpret this as the PLACED→CANCELED transition for customers. |
| A27 | **Admins can perform any valid status transition** regardless of the role restriction. | Admin has full permissions. |

---

## 5. Coupons

| # | Assumption | Rationale |
|---|---|---|
| A28 | **Coupons are restaurant-specific.** Each coupon belongs to one restaurant. | Coupons are created by restaurant owners for their restaurants. |
| A29 | **Coupon discount is a percentage** (0-100) applied to the order subtotal. | Task says "percentage discount." |
| A30 | **Coupon codes are unique** across the entire system (not just per-restaurant). | Simplicity; prevents confusion when customers try to apply codes. |
| A31 | **Expired or inactive coupons** cannot be applied to new orders but remain in the database for historical reference. | Orders that used them retain the discount info. |

---

## 6. API Design

| # | Assumption | Rationale |
|---|---|---|
| A32 | **RESTful API** with JSON request/response bodies. No GraphQL. | The task says "REST/GraphQL API." REST is the simpler, more common choice and easier to demonstrate with Postman/cURL. |
| A33 | **API versioning** via URL prefix (`/api/v1/`). | Future-proofing without over-engineering. |
| A34 | **Pagination** uses offset-based pagination (`page` + `limit` query params). Available by default on **all** list (GET collection) endpoints. | Simple, stateless, sufficient for the data volumes in a take-home project. |
| A34a | **Field selection** is available via `?fields=` query param on **all** GET endpoints (list and single-resource). | Reduces bandwidth; fields are validated against a per-resource whitelist; `password` and internal fields are never selectable. |
| A35 | **No file uploads.** Restaurant images, meal photos, etc., are out of scope. | Not mentioned in the task. Focus is on CRUD, orders, and auth. |
| A36 | **No real-time features** (WebSockets, push notifications). | Not mentioned in the task. Order status is polled via GET. |
| A36a | **Admin-only endpoints** are prefixed with `/api/v1/admin/...` for clear separation and security layering. | Self-documenting URLs; enables easy reverse-proxy/gateway rules; better Postman organization. |
| A36b | **Tax calculation** is documented as a future roadmap item, not implemented. | Not in the task requirements. Schema and calculation logic are designed but deferred. |

---

## 7. Infrastructure & Operations

| # | Assumption | Rationale |
|---|---|---|
| A37 | **No deployment** is needed. The app runs locally via Docker Compose or direct `npm run dev`. | User explicitly stated: "I do not need to deploy it." |
| A38 | **No CI/CD pipeline.** Tests are run locally via `npm test`. | Take-home scope. |
| A39 | **Single PostgreSQL instance** (no read replicas, no clustering). | Local development only. |
| A40 | **In-memory caching** via node-cache (60s TTL) is used for auth user lookups. No Redis. | Reduces DB load on the most frequent operation (auth middleware user check) without adding infrastructure. Single-process app doesn't need distributed cache. |
| A41 | **Logging** is structured JSON via Pino, output to stdout. No log aggregation. | Sufficient for development and debugging. |

---

## 7a. Database & IDs

| # | Assumption | Rationale |
|---|---|---|
| A42a | **UUIDv7** is used for all primary keys instead of UUIDv4. | UUIDv7 is time-ordered (RFC 9562), meaning sequential inserts land in adjacent B-tree leaf pages. This provides ~2-5x better insert performance and eliminates index fragmentation issues caused by random UUIDv4. |
| A42b | **Prisma interactive transactions** (`$transaction()`) are used for all multi-table writes (order creation, order status change, user deletion, restaurant deletion). | Ensures atomicity — partial writes (e.g., order created but items missing) are impossible. Single-row operations use Prisma's implicit transactions. |
| A42c | **Field selection** (`?fields=id,name,email`) is supported on all GET endpoints. | Reduces response payload for clients that only need specific fields. Prisma's native `select` makes this efficient at the DB level (only requested columns are queried). |
+| A46  | **Prisma Driver Adapter (@prisma/adapter-pg)** is used for database connectivity. | Using the `pg` pool with the official adapter provides better control over connection pooling and resolves certain runtime engine constructor validation issues in some Node.js environments. |
+
 ---
 
 ## 8. Testing

---

## 8. Testing

| # | Assumption | Rationale |
|---|---|---|
| A42 | **Integration tests** are the primary testing strategy, testing the full HTTP → service → DB flow via Supertest. | Task says: "demonstrate by creating functional tests that use the REST Layer directly." |
| A43 | **Tests use a separate database** (`food_delivery_test`) to avoid polluting development data. | Standard practice. |
| A44 | **Tests are deterministic and isolated.** Each test suite cleans up after itself. | Ensures tests can run in any order without side effects. |
| A45 | **No load/performance testing.** | Out of scope for a take-home project. |
