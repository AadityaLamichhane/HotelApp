/// <reference types="bun-types" />
import { describe, expect, it } from "bun:test";
import { createRateLimiter } from "../../middlewares/rateLimit";
import { AppError } from "../../utils/error";
import { ERROR_CODES } from "../../utils/errorCodes";

const makeCtx = (ip: string) => ({
  request: { headers: new Headers({ "x-forwarded-for": ip }) },
  set: {} as { status?: number; headers?: Record<string, string> },
});

describe("createRateLimiter", () => {
  it("allows up to max requests, then throws RATE_LIMITED", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    const ctx = makeCtx(`ip-${crypto.randomUUID()}`);

    expect(limiter.beforeHandle(ctx)).toBeUndefined();
    expect(limiter.beforeHandle(ctx)).toBeUndefined();

    let blocked: unknown;
    try {
      limiter.beforeHandle(ctx);
    } catch (error) {
      blocked = error;
    }
    expect(blocked).toBeInstanceOf(AppError);
    expect((blocked as AppError).code).toBe(ERROR_CODES.RATE_LIMITED);
    expect((blocked as AppError).status).toBe(429);
    expect(ctx.set.status).toBe(429);
    expect(ctx.set.headers?.["retry-after"]).toBeDefined();
  });

  it("tracks different IPs independently", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const a = makeCtx(`ip-${crypto.randomUUID()}`);
    const b = makeCtx(`ip-${crypto.randomUUID()}`);

    expect(limiter.beforeHandle(a)).toBeUndefined();
    expect(limiter.beforeHandle(b)).toBeUndefined();
    expect(() => limiter.beforeHandle(a)).toThrow();
  });
});
