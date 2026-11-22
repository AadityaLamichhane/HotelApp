/// <reference types="bun-types" />
import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { z } from "zod";
import errorHandler from "./errorHandler";
import { validate } from "./zodValidation";
import { AppError, throwNotFoundError } from "@/utils/error";
import { ERROR_CODES } from "@/utils/errorCodes";

const buildApp = () => {
  const app = new Elysia();
  errorHandler(app);

  app.get("/coded", () => {
    throw new AppError(
      ERROR_CODES.AUTH_ACCOUNT_USES_GOOGLE,
      401,
      "This account uses Google sign-in",
    );
  });
  app.get("/legacy", () => {
    throw new Error("UNAUTHORIZED: No token was found in the header");
  });
  app.get("/missing", () => throwNotFoundError("User"));
  app.get("/boom", () => {
    throw new Error("database exploded");
  });
  app.post("/validated", () => ({ ok: true }), {
    beforeHandle: validate(
      z.object({ body: z.object({ email: z.string().email("Valid email is required") }) }),
    ).beforeHandle as any,
  });

  return app;
};

const call = async (path: string, init?: RequestInit) => {
  const response = await buildApp().handle(new Request(`http://localhost${path}`, init));
  return { status: response.status, body: (await response.json()) as Record<string, any> };
};

describe("errorHandler", () => {
  it("serializes AppError using its code and clean message", async () => {
    const { status, body } = await call("/coded");

    expect(status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toBe(ERROR_CODES.AUTH_ACCOUNT_USES_GOOGLE);
    expect(body.message).toBe("This account uses Google sign-in");
  });

  it("strips internal prefixes from legacy errors", async () => {
    const { status, body } = await call("/legacy");

    expect(status).toBe(401);
    expect(body.error).toBe(ERROR_CODES.TOKEN_INVALID);
    expect(body.message).toBe("No token was found in the header");
    expect(body.message).not.toContain("UNAUTHORIZED");
  });

  it("maps helper-thrown not-found errors", async () => {
    const { status, body } = await call("/missing");

    expect(status).toBe(404);
    expect(body.error).toBe(ERROR_CODES.ROUTE_NOT_FOUND);
    expect(body.message).toBe("User not found");
  });

  it("maps unmatched routes to ROUTE_NOT_FOUND", async () => {
    const { status, body } = await call("/does-not-exist");

    expect(status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe(ERROR_CODES.ROUTE_NOT_FOUND);
  });

  it("maps hook-thrown validation errors to the shared envelope", async () => {
    const { status, body } = await call("/validated", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });

    expect(status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.error).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(body.message).toContain("Valid email is required");
    expect(body.message).not.toContain("Body.");
    expect(body.details).toBeDefined();
  });

  it("maps unknown errors to INTERNAL_ERROR without leaking the raw message in production", async () => {
    const { status, body } = await call("/boom");

    expect(status).toBe(500);
    expect(body.error).toBe(ERROR_CODES.INTERNAL_ERROR);
  });
});
