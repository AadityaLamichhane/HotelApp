/**
 * Stable, machine-readable error codes.
 *
 * The API failure envelope carries one of these in `error`:
 *   { success: false, error: "<CODE>", message: "<user-safe copy>" }
 *
 * Rules:
 * - Add new codes here, never inline string literals.
 * - `message` is display copy; `error` is what the client switches on.
 * - Keep codes provider-agnostic where possible (AUTH_* prefix for anything
 *   auth-related so a future Apple/Facebook flow can share them).
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  ROUTE_NOT_FOUND: "ROUTE_NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  CONFLICT: "CONFLICT",
  TOKEN_MISSING: "TOKEN_MISSING",
  TOKEN_INVALID: "TOKEN_INVALID",
  ROLE_FORBIDDEN: "ROLE_FORBIDDEN",
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_ACCOUNT_USES_GOOGLE: "AUTH_ACCOUNT_USES_GOOGLE",
  AUTH_EMAIL_TAKEN: "AUTH_EMAIL_TAKEN",
  AUTH_GOOGLE_NOT_CONFIGURED: "AUTH_GOOGLE_NOT_CONFIGURED",
  AUTH_GOOGLE_TOKEN_INVALID: "AUTH_GOOGLE_TOKEN_INVALID",
  AUTH_GOOGLE_TOKEN_EXPIRED: "AUTH_GOOGLE_TOKEN_EXPIRED",
  AUTH_GOOGLE_EMAIL_MISSING: "AUTH_GOOGLE_EMAIL_MISSING",
  AUTH_GOOGLE_EMAIL_UNVERIFIED: "AUTH_GOOGLE_EMAIL_UNVERIFIED",
  AUTH_GOOGLE_LINKED_TO_OTHER: "AUTH_GOOGLE_LINKED_TO_OTHER",
  AUTH_LINKED_USER_MISSING: "AUTH_LINKED_USER_MISSING",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
