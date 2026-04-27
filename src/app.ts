import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import pino from "pino";
import swaggerUi from "swagger-ui-express";

import { errorHandler } from "./middleware/errorHandler";
import { swaggerSpec } from "./config/swagger";

// Routes
import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import restaurantsRoutes from "./modules/restaurants/restaurants.routes";
import mealsRoutes from "./modules/meals/meals.routes";
import ordersRoutes from "./modules/orders/orders.routes";
import couponsRoutes from "./modules/coupons/coupons.routes";

const app = express();

// ─── Global Middleware ──────────────────────────────────────────────────────

app.use(helmet());
app.use(cors());
app.use(express.json());

// HTTP request logging (silent in test mode)
if (process.env.NODE_ENV !== "test") {
  app.use(
    pinoHttp({
      logger: pino({
        level: "info",
        ...(process.env.NODE_ENV !== "production" && {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
            },
          },
        }),
      }),
      autoLogging: {
        ignore: (req) => req.url === "/health",
      },
    }),
  );
}

// ─── Swagger API Docs ───────────────────────────────────────────────────────

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "Food Delivery API Docs",
    customCss: ".swagger-ui .topbar { display: none }",
  }),
);

// ─── Health Check ───────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── API Routes ─────────────────────────────────────────────────────────────

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin/users", usersRoutes);
app.use("/api/v1/restaurants", restaurantsRoutes);
app.use("/api/v1/restaurants/:restaurantId/meals", mealsRoutes);
app.use("/api/v1/restaurants/:restaurantId/coupons", couponsRoutes);
app.use("/api/v1/orders", ordersRoutes);

// ─── 404 Handler ────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "The requested endpoint does not exist",
    },
  });
});

// ─── Global Error Handler ───────────────────────────────────────────────────

app.use(errorHandler);

export default app;
