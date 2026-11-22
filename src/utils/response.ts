import { ERROR_CODES, type ErrorCode } from "./errorCodes";

/** Shared success envelope. Controllers normally return through the route
 * handler, which wraps their return value in `{ success, data, message }`. */
export const ok = (data: unknown) => ({ success: true, data, message: "SUCCESS" as const });

/** Shared failure envelope. Prefer throwing an `AppError` so the centralized
 * error handler owns logging and status mapping. */
export const fail = (code: ErrorCode, message: string, details?: unknown) => ({
  success: false,
  error: code,
  message,
  ...(details !== undefined ? { details } : {}),
});

export { ERROR_CODES };
