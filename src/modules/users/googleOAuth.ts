import { OAuth2Client } from "google-auth-library";
import env from "@/config/env";
import { throwServiceUnavailableError, throwUnauthorizedError } from "@/utils/error";
import { ERROR_CODES } from "@/utils/errorCodes";
import type { GoogleIdTokenPayload, VerifiedOAuthProfile } from "./oauthTypes";

const client = new OAuth2Client();

// Comma-separated client IDs. Every platform (web/Android/iOS) has its own
// client ID, and the id_token's `aud` is whichever client requested it.
export const googleAudiences = (): string[] =>
  String(env.GOOGLE_CLIENT_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

const isExpiredTokenError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /token used too late|expired|jwt expired/i.test(message);
};

// Pure claim validation so it can be tested without Google's JWKS.
// Google only sets email_verified for addresses it has verified; linking an
// unverified email to an existing password account would be account takeover.
export const profileFromGooglePayload = (
  payload: GoogleIdTokenPayload | null | undefined,
): VerifiedOAuthProfile => {
  if (!payload || !payload.sub) {
    throw throwUnauthorizedError("Invalid Google token", ERROR_CODES.AUTH_GOOGLE_TOKEN_INVALID);
  }
  const email = payload.email;
  if (!email) {
    throw throwUnauthorizedError(
      "Google account has no email",
      ERROR_CODES.AUTH_GOOGLE_EMAIL_MISSING,
    );
  }
  if (payload.email_verified !== true) {
    throw throwUnauthorizedError(
      "Google email is not verified",
      ERROR_CODES.AUTH_GOOGLE_EMAIL_UNVERIFIED,
    );
  }
  return {
    provider: "google",
    providerAccountId: payload.sub,
    email,
    emailVerified: true,
    name: payload.name ?? null,
    avatarUrl: payload.picture ?? null,
  };
};

export const verifyGoogleIdToken = async (idToken: string): Promise<VerifiedOAuthProfile> => {
  const audience = googleAudiences();
  if (audience.length === 0) {
    throw throwServiceUnavailableError(
      "Google sign-in is not configured",
      ERROR_CODES.AUTH_GOOGLE_NOT_CONFIGURED,
    );
  }

  let payload: GoogleIdTokenPayload | undefined;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience });
    payload = ticket.getPayload() as GoogleIdTokenPayload | undefined;
  } catch (error) {
    // verifyIdToken checks signature, issuer, audience and expiry.
    if (isExpiredTokenError(error)) {
      throw throwUnauthorizedError(
        "Google sign-in expired",
        ERROR_CODES.AUTH_GOOGLE_TOKEN_EXPIRED,
      );
    }
    throw throwUnauthorizedError(
      "Invalid Google token",
      ERROR_CODES.AUTH_GOOGLE_TOKEN_INVALID,
    );
  }
  return profileFromGooglePayload(payload);
};
