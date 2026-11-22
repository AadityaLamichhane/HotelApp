import { z } from "zod";
import { paginationQuerySchema } from "@/utils/baseValidation";

const hotelIdField = z.string().uuid("Valid hotelId is required");
const tableIdField = z.string().uuid("Valid tableId is required");
const guestSessionIdField = z.coerce.number().int().positive("Invalid guest id");
const bookingIdField = z.string().uuid("Invalid booking id").optional().nullable();
const roomEntryIdField = z.coerce.number().int().positive("Invalid room entry id").optional().nullable();

export const createGuestValidationSchema = z.object({
  body: z.object({
    hotelId: hotelIdField,
    tableId: tableIdField,
    guestName: z.string().max(255).optional().nullable(),
    guestCount: z.coerce.number().int().min(1, "At least 1 guest").max(100).default(1),
    bookingId: bookingIdField,
    roomEntryId: roomEntryIdField,
    notes: z.string().optional().nullable(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateGuestValidationSchema = z.object({
  params: z.object({ id: guestSessionIdField }),
  body: z.object({
    guestName: z.string().max(255).optional().nullable(),
    guestCount: z.coerce.number().int().min(1).max(100).optional(),
    tableId: tableIdField.optional(),
    bookingId: bookingIdField,
    roomEntryId: roomEntryIdField,
    notes: z.string().optional().nullable(),
    status: z.enum(["open", "completed", "cancelled"]).optional(),
  }),
});

export const linkRoomValidationSchema = z.object({
  params: z.object({ id: guestSessionIdField }),
  body: z.object({
    bookingId: bookingIdField,
    roomEntryId: roomEntryIdField,
  }),
});

export const guestIdParamValidationSchema = z.object({
  params: z.object({ id: guestSessionIdField }),
});

export const completeGuestValidationSchema = z.object({
  params: z.object({ id: guestSessionIdField }),
  body: z
    .object({
      roomEntryId: roomEntryIdField,
    })
    .optional(),
});

export const listGuestsValidationSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().max(255).optional(),
    hotelId: hotelIdField.optional(),
    tableId: tableIdField.optional(),
    status: z.enum(["open", "completed", "cancelled"]).optional(),
  }),
});

export const listHotelGuestsValidationSchema = z.object({
  params: z.object({ id: hotelIdField }),
  query: paginationQuerySchema.extend({
    search: z.string().max(255).optional(),
    tableId: tableIdField.optional(),
    status: z.enum(["open", "completed", "cancelled"]).optional(),
  }),
});

export const tableGuestsValidationSchema = z.object({
  params: z.object({ id: tableIdField }),
  query: z.object({
    status: z.enum(["open", "completed", "cancelled"]).optional(),
  }),
});

export type CreateGuestInput = z.infer<typeof createGuestValidationSchema>;
export type UpdateGuestInput = z.infer<typeof updateGuestValidationSchema>;
export type LinkRoomInput = z.infer<typeof linkRoomValidationSchema>;
