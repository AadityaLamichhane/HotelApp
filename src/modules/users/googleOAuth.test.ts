/// <reference types="bun-types" />
import { describe, expect, it } from "bun:test";
import { profileFromGooglePayload } from "./googleOAuth";
import { googleOAuthValidationSchema } from "./validators";
import { AppError } from "@/utils/error";
import { ERROR_CODES, type ErrorCode } from "@/utils/errorCodes";

const expectCode = (fn: () => unknown, code: ErrorCode) => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    return;
  }
  throw new Error(`Expected function to throw ${code}`);
};

describe("profileFromGooglePayload", () => {
  it("maps a verified Google payload to a provider profile", () => {
    expect(
      profileFromGooglePayload({
        sub: "google-sub-1",
        email: "Aadi@Example.com",
        email_verified: true,
        name: "Aadi",
        picture: "https://example.com/a.png",
      }),
    ).toEqual({
      provider: "google",
      providerAccountId: "google-sub-1",
      email: "Aadi@Example.com",
      emailVerified: true,
      name: "Aadi",
      avatarUrl: "https://example.com/a.png",
    });
  });

  it("rejects a payload without a subject", () => {
    expectCode(
      () => profileFromGooglePayload({ email: "a@b.com", email_verified: true }),
      ERROR_CODES.AUTH_GOOGLE_TOKEN_INVALID,
    );
  });

  it("rejects a payload without an email", () => {
    expectCode(
      () => profileFromGooglePayload({ sub: "s", email_verified: true }),
      ERROR_CODES.AUTH_GOOGLE_EMAIL_MISSING,
    );
  });

  it("rejects an unverified email", () => {
    expectCode(
      () => profileFromGooglePayload({ sub: "s", email: "a@b.com", email_verified: false }),
      ERROR_CODES.AUTH_GOOGLE_EMAIL_UNVERIFIED,
    );
  });

  it("rejects a payload that omits email_verified", () => {
    expectCode(
      () => profileFromGooglePayload({ sub: "s", email: "a@b.com" }),
      ERROR_CODES.AUTH_GOOGLE_EMAIL_UNVERIFIED,
    );
  });

  it("rejects a null payload", () => {
    expectCode(
      () => profileFromGooglePayload(null),
      ERROR_CODES.AUTH_GOOGLE_TOKEN_INVALID,
    );
  });
});

describe("googleOAuthValidationSchema", () => {
  it("accepts a body with idToken", () => {
    expect(googleOAuthValidationSchema.safeParse({ body: { idToken: "abc" } }).success).toBe(true);
  });

  it("rejects an empty idToken", () => {
    expect(googleOAuthValidationSchema.safeParse({ body: { idToken: "" } }).success).toBe(false);
  });

  it("rejects a missing body", () => {
    expect(googleOAuthValidationSchema.safeParse({}).success).toBe(false);
  });
});
