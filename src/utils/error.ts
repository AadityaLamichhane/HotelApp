import type { ZodError, ZodIssue } from "zod";
import { ERROR_CODES, type ErrorCode } from "./errorCodes";

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export { ERROR_CODES, type ErrorCode };

const capitalize = (str: string): string => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Central application error. Every deliberate failure is thrown as an
 * `AppError`; only the Elysia error handler serializes it into the HTTP
 * envelope. Domain code never builds response bodies.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, status: number, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const zodDetails = (input: string | ZodError | ZodIssue[]): unknown => {
  if (typeof input === "string") return undefined;
  if (Array.isArray(input)) return { formErrors: [], fieldErrors: {}, issues: input };
  if (typeof (input as ZodError).flatten === "function") return (input as ZodError).flatten();
  return undefined;
};

/**
 * Turn a ZodError / ZodIssue[] / plain string into a single
 * human-readable message. Ported from khumbaya backend
 * (src/utils/error.ts) so validation responses read the same.
 */
export const formatZodError = (error: ZodError | ZodIssue[] | string): string => {
  if (typeof error === "string") {
    return capitalize(error);
  }

  const issues: ZodIssue[] = Array.isArray(error) ? error : (error as ZodError)?.issues || [];
  if (!issues || issues.length === 0) {
    return "Validation failed";
  }

  return issues
    .map((issue) => {
      const rawPath = issue.path.filter((p) => p !== undefined && p !== "").join(".");
      // Don't leak transport containers (Body./Query./Params.) into user copy.
      const path = rawPath.replace(/^(?:body|query|params)(?:\.|$)/i, "");
      const msg = issue.message;

      // "expected string, received undefined" -> "Body.field is required"
      if (
        issue.code === "invalid_type" &&
        ((issue as any).received === "undefined" ||
          (msg.includes("expected") && msg.includes("received undefined")))
      ) {
        return capitalize(path ? `${path} is required` : "Field is required");
      }

      if (path) {
        if (msg.toLowerCase().startsWith(path.toLowerCase())) {
          return capitalize(msg);
        }
        return `${capitalize(path)}: ${msg}`;
      }

      return capitalize(msg);
    })
    .join(", ");
};

// Validation Error Thrower — accepts a message, a ZodError, or issues.
export const throwErrorOnValidation = (
  validationInput: string | ZodError | ZodIssue[],
  code: ErrorCode = ERROR_CODES.VALIDATION_ERROR,
): never => {
  void HTTP_STATUS;
  throw new AppError(code, HTTP_STATUS.VALIDATION_ERROR, formatZodError(validationInput), zodDetails(validationInput));
};

export const throwNotFoundError = (
  resource: string,
  code: ErrorCode = ERROR_CODES.ROUTE_NOT_FOUND,
): never => {
  throw new AppError(code, HTTP_STATUS.NOT_FOUND, `${capitalize(resource)} not found`);
};

export const throwUnauthorizedError = (
  message = "Unauthorized access",
  code: ErrorCode = ERROR_CODES.TOKEN_INVALID,
): never => {
  throw new AppError(code, HTTP_STATUS.UNAUTHORIZED, message);
};

export const throwForbiddenError = (
  message = "Access denied",
  code: ErrorCode = ERROR_CODES.ROLE_FORBIDDEN,
): never => {
  throw new AppError(code, HTTP_STATUS.FORBIDDEN, message);
};

export const throwConflictError = (
  message = "Conflict",
  code: ErrorCode = ERROR_CODES.CONFLICT,
): never => {
  throw new AppError(code, HTTP_STATUS.CONFLICT, message);
};

export const throwRateLimitedError = (
  message = "Too many attempts. Try again later.",
  code: ErrorCode = ERROR_CODES.RATE_LIMITED,
): never => {
  throw new AppError(code, 429, message);
};

export const throwServiceUnavailableError = (
  message = "Service unavailable",
  code: ErrorCode = ERROR_CODES.SERVICE_UNAVAILABLE,
): never => {
  throw new AppError(code, 503, message);
};
