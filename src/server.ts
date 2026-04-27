import { config } from "./config";
import app from "./app";
import { prisma } from "./utils/prisma";

const PORT = config.PORT;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 Health check: http://localhost:${PORT}/health`);
  console.log(`😎 Swagger docs: http://localhost:${PORT}/api-docs`);
  console.log(`🔑 Environment: ${config.NODE_ENV}`);
});

/**
 * Handles graceful shutdown by closing the HTTP server and database connections.
 */
async function handleShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  // 1. Stop accepting new requests
  server.close(async (err) => {
    if (err) {
      console.error("Error closing HTTP server:", err);
      process.exit(1);
    }
    console.log("HTTP server closed.");

    try {
      // 2. Disconnect from database
      await prisma.$disconnect();
      console.log("Database connection closed.");
      process.exit(0);
    } catch (dbErr) {
      console.error("Error disconnecting from database:", dbErr);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds if graceful shutdown is stuck
  setTimeout(() => {
    console.error("Graceful shutdown timed out. Forcefully shutting down...");
    process.exit(1);
  }, 10000);
}

// Listen for termination signals
process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
