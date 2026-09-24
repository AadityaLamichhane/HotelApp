import { pool } from "@/config/db";
import type { IAuthRequest } from "@/routes";

/**
 * DB liveness probe (mounted at /api/db/health by plugin routeConfig).
 * Useful for deploy health checks; does not expose any data.
 */
const health = async (_req: IAuthRequest) => {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    return { database: "connected" };
  } finally {
    client.release();
  }
};

export default { health };
