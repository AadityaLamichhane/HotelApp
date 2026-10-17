import { z } from "zod";
import { paginationQuerySchema } from "@/utils/baseValidation";

// IDs are UUIDs (tables.id / hotels.id). createdBy is NEVER accepted —
// the service injects request.user.id (see rooms/validators.ts).
const hotelIdField = z.string().uuid("Valid hotelId is required");
const tableIdField = z.string().uuid("Invalid ID");
const seatsField = z.coerce.number().int().min(1, "Seats must be at least 1").max(100);

export const createTableValidationSchema = z.object({
  body: z.object({
    hotelId: hotelIdField,
    name: z.string().min(1, "Name is required").max(255),
    seats: seatsField.default(2),
    isAvailable: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateTableValidationSchema = z.object({
  params: z.object({ id: tableIdField }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    seats: seatsField.optional(),
    isAvailable: z.boolean().optional(),
  }),
});

export const tableIdParamValidationSchema = z.object({
  params: z.object({ id: tableIdField }),
});

export const listTablesValidationSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().max(255).optional(),
    hotelId: hotelIdField.optional(),
  }),
});

// Hotel-scoped list: hotel id comes from the PATH, never a client filter.
// NOTE: path param is `:id` to match `hotels/:id` (memoirist requires
// identical param names at the same position).
export const listHotelTablesValidationSchema = z.object({
  params: z.object({ id: hotelIdField }),
  query: paginationQuerySchema.extend({
    search: z.string().max(255).optional(),
  }),
});

export type CreateTableInput = z.infer<typeof createTableValidationSchema>;
export type UpdateTableInput = z.infer<typeof updateTableValidationSchema>;
