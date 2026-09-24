import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./db/schema";
import env from "./env";
import logger from "./logger";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  min: 5,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: true,
  keepAlive: true,
});

pool.on("error", (err: any) => {
  logger.error("Database pool error:", err);
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Closing DB pool...`);
  try {
    await pool.end();
    logger.info("Database connections closed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during DB shutdown: %s", error);
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

const db = drizzle(pool, {
  schema,
  logger: env.MODE === "development",
});

export default db;

