import app from "./app";
import config from "./config/environment";
import { pool } from "./config/database";
import { logger } from "./utils/logger";

const startServer = async () => {
  try {
    // Test database connection
    await pool.query("SELECT NOW()");
    logger.info("✓ Database connected successfully");

    // Check if migrations are applied
    const migrationCheck = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'schema_migrations')"
    );

    if (!migrationCheck.rows[0].exists) {
      logger.warn(
        "⚠ Warning: Migrations table not found. Please run migrations."
      );
      logger.warn("Run: npm run migrate:up");
    }

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`✓ Server running in ${config.env} mode`);
      logger.info(`✓ Listening on port ${config.port}`);
      logger.info(
        `✓ API: http://localhost:${config.port}/api/${config.apiVersion}`
      );
      logger.info(
        `✓ Health: http://localhost:${config.port}/api/${config.apiVersion}/health`
      );
    });

    // Graceful shutdown --Close server + DB safely
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received: closing HTTP server`);
      server.close(async () => {
        logger.info("HTTP server closed");
        await pool.end();
        logger.info("Database pool closed");
        process.exit(0);
      });

      // Force close after 10 seconds-- Avoid hanging process
      setTimeout(() => {
        logger.error("Forcing shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    // Handle Ctrl+C / container stop
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
};

// Handle unhandled rejections -- Catch async bugs
process.on("unhandledRejection", (reason: Error) => {
  logger.error(`Unhandled Rejection: ${reason.message}`);
  logger.error(reason.stack || "");
  process.exit(1);
});

// Handle uncaught exceptions -- Catch fatal sync crashes
process.on("uncaughtException", (error: Error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  logger.error(error.stack || "");
  process.exit(1);
});

startServer();
