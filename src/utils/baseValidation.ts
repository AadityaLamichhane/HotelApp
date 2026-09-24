import { z } from "zod";

// Shared date input: accepts Date, ISO datetime string, or plain date
// string, and normalizes to a Date. Mirrors khumbaya's
// src/utils/baseValidation.ts `dateSchema`.
export const dateSchema = z
  .union([z.date(), z.string().datetime(), z.string().date()])
  .transform((val) => (val instanceof Date ? val : new Date(val)))
  .optional();

// Accepts `number | numeric-string`, validates it is numeric,
// and normalizes to string (useful for form-data / query values).
export const numericStringSchema = z
  .union([z.number(), z.string()])
  .refine((val) => !isNaN(Number(val)), "Must be a valid number")
  .transform((val) => String(val));

// Coerced positive-int id used for `:id` params.
export const idParamSchema = z.coerce
  .number()
  .int()
  .positive("Invalid ID");

// Standard pagination query used by list endpoints.
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});
