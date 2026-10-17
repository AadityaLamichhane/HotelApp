import { z } from "zod";
import { paginationQuerySchema } from "@/utils/baseValidation";

// rooms.id is a uuid PK. createdBy is NEVER accepted — the service injects
// request.user.id (see rooms/validators.ts).
const hotelIdField = z.string().uuid("Valid hotelId is required");
const roomIdField = z.string().uuid("Invalid room id");
const entryIdField = z.coerce.number().int().positive("Invalid entry id");
const guestIdField = z.coerce.number().int().positive().optional().nullable();

const guestsField = z.coerce.number().int().min(1, "At least 1 guest").max(50);

export const checkInValidationSchema = z.object({
  body: z.object({
    hotelId: hotelIdField,
    roomId: roomIdField,
    customerName: z.string().min(1, "Guest name is required").max(255),
    guestId: guestIdField,
    identityNumber: z.string().max(255).optional().nullable(),
    mobileNumber: z.string().max(50).optional().nullable(),
    numberOfguest: guestsField.default(1),
    malesCount: z.coerce.number().int().min(0).max(50).default(0),
    femalesCount: z.coerce.number().int().min(0).max(50).default(0),
    purpose: z.string().max(255).optional().nullable(),
    // Defaults to the room's current price at check-in. Pass an explicit
    // value only for negotiated rates.
    roomRate: z.coerce.number().int().min(0).optional(),
    checkInDate: z.union([z.string().datetime(), z.string().date()]).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const checkOutValidationSchema = z.object({
  params: z.object({ id: entryIdField }),
  body: z.object({
    checkOutDate: z.union([z.string().datetime(), z.string().date()]).optional(),
  }),
});

export const updateEntryValidationSchema = z.object({
  params: z.object({ id: entryIdField }),
  body: z.object({
    customerName: z.string().min(1).max(255).optional(),
    guestId: guestIdField,
    identityNumber: z.string().max(255).optional().nullable(),
    mobileNumber: z.string().max(50).optional().nullable(),
    numberOfguest: guestsField.optional(),
    malesCount: z.coerce.number().int().min(0).max(50).optional(),
    femalesCount: z.coerce.number().int().min(0).max(50).optional(),
    purpose: z.string().max(255).optional().nullable(),
    signature: z.string().optional().nullable(),
  }),
});

export const entryIdParamValidationSchema = z.object({
  params: z.object({ id: entryIdField }),
});

export const listEntriesValidationSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().max(255).optional(),
    hotelId: hotelIdField.optional(),
    status: z.enum(["open", "closed"]).optional(),
  }),
});

export const listHotelEntriesValidationSchema = z.object({
  params: z.object({ id: hotelIdField }),
  query: paginationQuerySchema.extend({
    search: z.string().max(255).optional(),
    status: z.enum(["open", "closed"]).optional(),
  }),
});

// `?roomId=` answers "who is in room 204 right now" — used by the QR/room
// in-room-ordering flow to resolve the current stay server-side.
export const roomEntriesByRoomValidationSchema = z.object({
  params: z.object({ id: roomIdField }),
  query: z.object({
    status: z.enum(["open", "closed"]).default("open"),
  }),
});

export type CheckInInput = z.infer<typeof checkInValidationSchema>;
export type UpdateEntryInput = z.infer<typeof updateEntryValidationSchema>;