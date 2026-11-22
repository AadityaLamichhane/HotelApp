import { throwRateLimitedError } from "@/utils/error";

type RateLimitOptions = { windowMs?: number; max?: number };

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const clientIp = (ctx: any): string => {
  const forwarded = ctx?.request?.headers?.get?.("x-forwarded-for");
  if (typeof forwarded === "string") {
    const first = forwarded.split(",")[0];
    if (first) return first.trim();
  }
  try {
    const address = ctx?.server?.requestIP?.(ctx.request)?.address;
    if (typeof address === "string" && address) return address;
  } catch {
    /* no server/requestIP available */
  }
  return "unknown";
};

const sweep = (now: number) => {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

/**
 * Minimal in-memory, per-IP limiter for a single route. This is
 * per-process: it resets on restart and does not coordinate across
 * instances. That is acceptable while the API runs as one process.
 */
export const createRateLimiter = (options: RateLimitOptions = {}) => {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 10;

  return {
    beforeHandle: (ctx: any) => {
      const now = Date.now();
      sweep(now);

      const key = clientIp(ctx);
      const bucket = buckets.get(key);

      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return;
      }

      bucket.count += 1;
      if (bucket.count <= max) return;

      ctx.set.status = 429;
      ctx.set.headers = {
        ...(ctx.set.headers ?? {}),
        "retry-after": String(Math.ceil((bucket.resetAt - now) / 1000)),
      };
      // Thrown deliberately: the centralized error handler owns the response
      // envelope. The retry-after header set above is preserved.
      throwRateLimitedError("Too many sign-in attempts. Try again later.");
    },
  };
};
