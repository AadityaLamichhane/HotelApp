import type { ZodError, ZodIssue } from "zod";
import { HTTP_ERROR_LITERALS } from "./helper";

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

const capitalize = (str: string): string => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
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
      const path = issue.path.filter((p) => p !== undefined && p !== "").join(".");
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
// Throwing with name = "ValidationError" lets the Elysia errorHandler
// map it to 422 automatically.
export const throwErrorOnValidation = (validationInput: string | ZodError | ZodIssue[]): never => {
  void HTTP_ERROR_LITERALS; // keep helper import meaningful (literals documented there)
  const validationstring = formatZodError(validationInput);
  const errorMessage = new Error(validationstring);
  errorMessage.name = "ValidationError";
  throw errorMessage;
};

export const throwNotFoundError = (resource: string): never => {
  const error = new Error(`NOT_FOUND: ${resource} not found`);
  error.name = "NOT_FOUND";
  throw error;
};

export const throwUnauthorizedError = (message = "Unauthorized access"): never => {
  const error = new Error(`UNAUTHORIZED: ${message}`);
  error.name = "UNAUTHORIZED";
  throw error;
};

export const throwForbiddenError = (message = "Access denied"): never => {
  const error = new Error(`Forbidden: ${message}`);
  error.name = "Forbidden";
  throw error;
};

