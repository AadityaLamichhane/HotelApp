import { z } from "zod";
import { paginationQuerySchema } from "@/utils/baseValidation";

// IDs are UUIDs: logistics.id / hotel_id / room_id all uuid. createdBy is
// NEVER accepted — the service injects request.user.id.
const hotelIdField = z.string().uuid("Valid hotelId is required");
const logisticsIdField = z.string().uuid("Invalid ID");
const roomIdField = z.string().uuid("Invalid roomId");
const nameField = z.string().min(1, "Name is required").max(255);
const quantityField = z.coerce
  .number()
  .int("Quantity must be a whole number")
  .min(0, "Quantity cannot be negative")
  .max(1_000_000, "Quantity is too large");

export const createLogisticsValidationSchema = z.object({
  body: z.object({
    hotelId: hotelIdField,
    name: nameField,
    quantity: quantityField,
    roomId: roomIdField.optional().nullable(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateLogisticsValidationSchema = z.object({
  params: z.object({ id: logisticsIdField }),
  body: z.object({
    name: nameField.optional(),
    quantity: quantityField.optional(),
    // null clears the room assignment (moves stock back to general).
    roomId: roomIdField.optional().nullable(),
  }),
});

export const logisticsIdParamValidationSchema = z.object({
  params: z.object({ id: logisticsIdField }),
});

// ADMIN panel list — cross-hotel, optional hotelId filter.
export const listLogisticsValidationSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().max(255).optional(),
    hotelId: hotelIdField.optional(),
    roomId: roomIdField.optional(),
  }),
});

// HOTEL-SCOPED list: hotel id comes from the PATH (`:id` — memoirist
// requires the same param name at the same position as `hotels/:id`).
export const listHotelLogisticsValidationSchema = z.object({
  params: z.object({ id: hotelIdField }),
  query: paginationQuerySchema.extend({
    search: z.string().max(255).optional(),
    roomId: roomIdField.optional(),
  }),
});

export type CreateLogisticsInput = z.infer<typeof createLogisticsValidationSchema>;
export type UpdateLogisticsInput = z.infer<typeof updateLogisticsValidationSchema>;
