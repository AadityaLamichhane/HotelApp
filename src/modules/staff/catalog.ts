import { sql } from "drizzle-orm";
import db from "@/config/db";
import { PERMISSION_CATALOG } from "./constants";
import { permissionsSchema } from "./schema";

let ready: Promise<void> | null = null;

/**
 * Idempotently upsert the permission catalog. Called lazily (once per
 * process) by the staff service so the API works even on a database where
 * the seed migration has not been applied. The migration also seeds the same
 * rows, so this is normally a cheap no-op.
 */
export const ensurePermissionCatalog = (): Promise<void> => {
  if (!ready) {
    ready = (async () => {
      await db
        .insert(permissionsSchema)
        .values(
          PERMISSION_CATALOG.map((permission) => ({
            key: permission.key,
            module: permission.module,
            action: permission.action,
            description: permission.description,
          })),
        )
        .onConflictDoUpdate({
          target: permissionsSchema.key,
          set: {
            module: sql`excluded.module`,
            action: sql`excluded.action`,
            description: sql`excluded.description`,
          },
        });
    })().catch((error) => {
      // Let the next call retry after a transient DB failure.
      ready = null;
      throw error;
    });
  }
  return ready;
};
