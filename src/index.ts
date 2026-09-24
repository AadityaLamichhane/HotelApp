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

    // 404s AFTER routes so they never shadow real endpoints.
    server.all("/api/*", ({ set, path }: any) => {
      logger.warn(`API route not found: ${path}`);
      set.status = 404;
      return { success: false, error: "Not Found", message: `Api:${path} not found` };
    });
    server.all("*", ({ set, path }: any) => {
      set.status = 404;
      return { success: false, error: "Not Found", message: `Route ${path} not found` };
    });

    server.listen(env.PORT, () => {
      logger.info(`🚀 ${env.APP_NAME} server running at port ${env.PORT}`);
    });
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};

startServer();
