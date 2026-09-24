import { z } from "zod";
import { paginationQuerySchema } from "@/utils/baseValidation";

// IDs are UUIDs now: hotels.id is uuid PK, rooms.id is uuid PK, and
// rooms.hotel_id is a uuid FK. createdBy is NEVER accepted — the service
// injects request.user.id.
const hotelIdField = z.string().uuid("Valid hotelId is required");
const roomIdField = z.string().uuid("Invalid ID");
const priceField = z.coerce.number().int().positive("Price must be a positive number");

export const createRoomValidationSchema = z.object({
  body: z.object({
    hotelId: hotelIdField,
    name: z.string().min(1, "Name is required").max(255),
    description: z.string().max(2000).optional().nullable(),
    price: priceField,
    isAvailable: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateRoomValidationSchema = z.object({
  params: z.object({ id: roomIdField }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional().nullable(),
    price: priceField.optional(),
    isAvailable: z.boolean().optional(),
  }),
});

export const roomIdParamValidationSchema = z.object({
  params: z.object({ id: roomIdField }),
});

export const listRoomsValidationSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().max(255).optional(),
    hotelId: hotelIdField.optional(),
  }),
});

// Hotel-scoped list for regular users: hotelId comes from the PATH
// (their hotel), never from a client-chosen filter they could widen.
export const listHotelRoomsValidationSchema = z.object({
  params: z.object({ hotelId: hotelIdField }),
  query: paginationQuerySchema.extend({
    search: z.string().max(255).optional(),
  }),
});

export type CreateRoomInput = z.infer<typeof createRoomValidationSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomValidationSchema>;
