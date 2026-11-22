import { z } from "zod";
import logger from "@/config/logger";
import { throwErrorOnValidation } from "@/utils/error";

/**
 * Khumbaya-style Zod validation, adapted for Elysia.
 *
 * Khumbaya (Express): `validate(schema)` returns `(req,res,next)` middleware
 * that safeParses `{ body, query, params }`.
 *
 * Here: `validate(schema)` returns an Elysia hook object
 * `{ beforeHandle }` so routes can declare:
 *
 *   { method: "post", path: "rooms", controller, validation: validate(CreateRoomSchema) }
 *
 * The hook short-circuits with 400 on failure and overwrites
 * `body/query/params` with the parsed (coerced + defaulted) values on success.
 */
export type ZodRequestSchema = z.ZodType<{
  body?: unknown;
  query?: unknown;
  params?: unknown;
}>;

export const validate = (schema: ZodRequestSchema) => ({
  beforeHandle: async ({ body, query, params, path }: any) => {
    const result = await (schema as any).safeParseAsync({ body, query, params });

    if (!result.success) {
      logger.debug(`Validation failed for ${path}: ${JSON.stringify(body)}`);
      logger.debug(JSON.stringify(result.error.flatten()));
      // Thrown deliberately: the centralized error handler owns the response
      // envelope and the 422 status.
      throwErrorOnValidation(result.error);
    }

    // Elysia exposes body/query/params on the context object by reference
    // for most transports, but reassignment is not guaranteed to propagate,
    // so mutate in place where the target is an object.
    const data = result.data as any;
    // NOTE: callers receive the raw context; the route handler below merges
    // `context.body ?? parsed.body`. For plain object bodies this mutation
    // keeps controller code reading `req.body` (Khumbaya style).
    try {
      if (data?.body !== undefined && body !== undefined && typeof body === "object") {
        for (const k of Object.keys(body)) delete (body as any)[k];
        Object.assign(body as any, data.body);
      }
    } catch {
      /* non-object body (e.g. string) — leave as-is */
    }
  },
});

/**
 * Service-layer validation (Khumbaya services sometimes validate again
 * or controllers validate when no route middleware is attached).
 * Parses `data` and throws a `ValidationError` with a readable message.
 */
export const parseOrThrow = <T>(schema: z.ZodType<T>, data: unknown): T => {
  const result = (schema as any).safeParse(data);
  if (!result.success) {
    throwErrorOnValidation(result.error);
  }
  return (result as any).data as T;
};
