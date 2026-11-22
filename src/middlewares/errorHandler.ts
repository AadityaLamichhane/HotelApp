import type { AnyElysia } from "elysia";
import env from "@/config/env";
import logger from "@/config/logger";
import { AppError, formatZodError, HTTP_STATUS } from "@/utils/error";
import { ERROR_CODES, type ErrorCode } from "@/utils/errorCodes";

/**
 * Central Elysia error handler — the ONLY place that serializes failures.
 *
 * Failure envelope (keep in sync with frontend/src/lib/api-client.ts):
 *   { success: false, error: "<CODE>", message: "<user-safe copy>", details? }
 *
 * `error` is the stable machine-readable code; `message` is display copy.
 * Internal prefixes, stacks and provider errors stay in the logs.
 */
type ErrorPayload = {
  code: ErrorCode;
  status: number;
  message: string;
  details?: unknown;
};

const isProduction = () => env.MODE === "production";

const stripInternalPrefixes = (message: string): string =>
  message.replace(/^(?:UNAUTHORIZED|NOT_FOUND|FORBIDDEN|Forbidden|CONFLICT):\s*/i, "").trim();

const fromElysiaCode = (code: string, error: unknown, path?: string): ErrorPayload => {
  const rawMessage =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Something went wrong.";

  switch (code) {
    case "VALIDATION":
      return {
        code: ERROR_CODES.VALIDATION_ERROR,
        status: HTTP_STATUS.VALIDATION_ERROR,
        message: formatZodError(rawMessage),
      };
    case "PARSE":
      return {
        code: ERROR_CODES.VALIDATION_ERROR,
        status: HTTP_STATUS.BAD_REQUEST,
        message: "Invalid request body",
      };
    case "NOT_FOUND":
      return {
        code: ERROR_CODES.ROUTE_NOT_FOUND,
        status: HTTP_STATUS.NOT_FOUND,
        message: path ? `Route ${path} not found` : "Route not found",
      };
    default:
      return {
        code: ERROR_CODES.INTERNAL_ERROR,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: isProduction() ? "Something went wrong." : rawMessage,
      };
  }
};

/** Map anything thrown (AppError, legacy prefix errors, Elysia built-ins). */
const toErrorPayload = (error: unknown, code: string, path?: string): ErrorPayload => {
  if (error instanceof AppError) {
    return {
      code: error.code,
      status: error.status,
      message: error.message,
      details: error.details,
    };
  }

  // Legacy throws that were not migrated to AppError. Kept so a stray
  // `new Error("UNAUTHORIZED: ...")` can never leak its prefix to clients.
  const rawMessage =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const cleanMessage = stripInternalPrefixes(rawMessage);

  if (error instanceof Error && error.name === "SERVICE_UNAVAILABLE") {
    return {
      code: ERROR_CODES.SERVICE_UNAVAILABLE,
      status: 503,
      message: cleanMessage || "Service unavailable",
    };
  }
  if (/^UNAUTHORIZED\b/i.test(rawMessage)) {
    return {
      code: ERROR_CODES.TOKEN_INVALID,
      status: HTTP_STATUS.UNAUTHORIZED,
      message: cleanMessage || "Please sign in again.",
    };
  }
  if (/^NOT_FOUND\b/i.test(rawMessage)) {
    return {
      code: ERROR_CODES.ROUTE_NOT_FOUND,
      status: HTTP_STATUS.NOT_FOUND,
      message: cleanMessage || "Not found.",
    };
  }
  if (/^(?:FORBIDDEN|Forbidden):/i.test(rawMessage)) {
    return {
      code: ERROR_CODES.ROLE_FORBIDDEN,
      status: HTTP_STATUS.FORBIDDEN,
      message: cleanMessage || "Access denied.",
    };
  }

  return fromElysiaCode(code, error, path);
};

const errorHandler = (app: AnyElysia) => {
  app.onError(({ code, error, set, path }: any) => {
    logger.error(error);

    const payload = toErrorPayload(error, code, path);
    set.status = payload.status;

    return {
      success: false,
      error: payload.code,
      message: payload.message,
      ...(payload.details !== undefined ? { details: payload.details } : {}),
    };
  });
};

export default errorHandler;
