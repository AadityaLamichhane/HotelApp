import type { AnyElysia } from "elysia";
import logger from "@/config/logger";
import { HTTP_STATUS } from "@/utils/error";

/**
 * Central Elysia error handler (same shape as
 * nayapurano-salespro-backend/src/middlewares/errorHandler.ts,
 * plus Zod-aware formatting via error.name === "ValidationError").
 */
const errorHandler = (app: AnyElysia) => {
  app.onError(({ code, error, set }: any) => {
    logger.error(error);

    if (
      error?.name === "ValidationError" ||
      error?.name === "Validation Error" ||
      error?.message?.includes("ValidationError")
    ) {
      set.status = HTTP_STATUS.VALIDATION_ERROR;
      return {
        success: false,
        error: "Validation Error",
        message: error.message,
      };
    }

    if (error?.name === "UNAUTHORIZED" || error?.message?.includes("UNAUTHORIZED")) {
      set.status = HTTP_STATUS.UNAUTHORIZED;
      return {
        success: false,
        error: "UNAUTHORIZED: You cannot access the data",
        message: error.message,
      };
    }

    if (error?.name === "NOT_FOUND" || error?.message?.includes("NOT_FOUND")) {
      set.status = HTTP_STATUS.NOT_FOUND;
      return {
        success: false,
        error: "Not Found",
        message: error.message,
      };
    }

    if (error?.name === "Forbidden" || error?.message?.includes("Forbidden:")) {
      set.status = HTTP_STATUS.FORBIDDEN;
      return {
        success: false,
        error: "Forbidden Error",
        message: error.message,
      };
    }

    if (error?.name)
      switch (code) {
        case "NOT_FOUND":
          set.status = 404;
          return { success: false, error: "Not Found", message: error.message };
        case "INTERNAL_SERVER_ERROR":
          set.status = 500;
          return { success: false, error: "Internal Server Error", message: error.message };
        case "VALIDATION":
          set.status = 422;
          return { success: false, error: "Validation Error", message: error.message };
        default:
          set.status = 500;
          return {
            success: false,
            error: "An unexpected error occurred",
            message: error?.message || "Something went wrong",
          };
      }
  });
};

export default errorHandler;
