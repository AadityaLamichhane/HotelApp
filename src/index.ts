import { pool } from "./config/db";
import server from "./config/server";
import env from "./config/env";
import routeInit from "./routes";
import logger from "./config/logger";
import errorHandler from "./middlewares/errorHandler";

const startServer = async () => {
  try {
    // Fail fast if DB is unreachable (same as salespro/khumbaya entrypoint).
    const client = await pool.connect();
    client.release();
    logger.info("✅ Database connected");

    // Central error mapping must be registered before routes throw.
    errorHandler(server);

    // Mount /api/* module routes.
    await routeInit(server);

    // Unmatched routes are handled centrally: Elysia raises NOT_FOUND and
    // errorHandler maps it to the { success, error: ROUTE_NOT_FOUND, message }
    // envelope, so no catch-all route can drift from the shared shape.

    server.listen(env.PORT, () => {
      logger.info(`🚀 ${env.APP_NAME} server running at port ${env.PORT}`);
    });
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};

startServer();
