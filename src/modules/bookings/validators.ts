import { z } from "zod";
import { paginationQuerySchema } from "@/utils/baseValidation";

// hotels.id and rooms.id are uuid PKs. `createdBy` and `roomEntryId` are
// NEVER accepted from the client — the service injects request.user.id and
// resolves the entry itself (see AGENTS.md rule 4).
const hotelIdField = z.string().uuid("Valid hotelId is required");
const roomIdField = z.string().uuid("Invalid room id");

// Date-only (YYYY-MM-DD), not a timestamp. A reservation is a set of NIGHTS,
// and a timestamp invites timezone bugs that silently shift a guest's first
// or last night by a day. `checkOut` is EXCLUSIVE.
const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

const statusField = z.enum(["pending", "confirmed", "checked_in", "cancelled", "no_show"]);
const sourceField = z.enum(["direct", "whatsapp", "phone", "walk_in", "channel"]);

/**
 * Half-open interval validation: the guest must be arriving BEFORE departing.
 * Rejecting `checkOut <= checkIn` at the route layer means the service never
 * has to defend against a zero- or negative-length stay, and an empty
 * `daterange` can never reach the availability query.
 */
const stayWindow = {
  checkIn: dateField,
  checkOut: dateField,
};

export const createBookingValidationSchema = z
  .object({
    body: z
      .object({
        hotelId: hotelIdField,
        roomId: roomIdField,
        guestName: z.string().min(1, "Guest name is required").max(255),
        guestPhone: z.string().max(50).optional().nullable(),
        guestCountry: z.string().max(100).optional().nullable(),
        identityNumber: z.string().max(255).optional().nullable(),
        adults: z.coerce.number().int().min(1, "At least 1 adult").max(50).default(1),
        children: z.coerce.number().int().min(0).max(20).default(0),
        ...stayWindow,
        // `pending` is the default so an agent-drafted booking never silently
        // becomes a commitment the guest never made.
        status: statusField.optional(),
        source: sourceField.default("direct"),
        rateNpr: z.coerce.number().int().min(0).optional(),
        notes: z.string().max(2000).optional().nullable(),
      })
      .refine((b) => b.checkIn < b.checkOut, {
        message: "Check-out must be after check-in",
        path: ["checkOut"],
      }),
    query: z.object({}).optional(),
    params: z.object({}).optional(),
  });

export const updateBookingValidationSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid booking id") }),
  body: z
    .object({
      guestName: z.string().min(1).max(255).optional(),
      guestPhone: z.string().max(50).optional().nullable(),
      guestCountry: z.string().max(100).optional().nullable(),
      identityNumber: z.string().max(255).optional().nullable(),
      adults: z.coerce.number().int().min(1).max(50).optional(),
      children: z.coerce.number().int().min(0).max(20).optional(),
      // Dates are editable individually (a guest extends by a night), but the
      // service re-validates the resulting window against the merged record.
      checkIn: dateField.optional(),
      checkOut: dateField.optional(),
      status: statusField.optional(),
      source: sourceField.optional(),
      rateNpr: z.coerce.number().int().min(0).optional(),
      notes: z.string().max(2000).optional().nullable(),
    })
    .refine(
      (b) =>
        (b.checkIn === undefined || b.checkOut === undefined) ||
        b.checkIn < b.checkOut,
      { message: "Check-out must be after check-in", path: ["checkOut"] },
    ),
});

export const bookingIdParamValidationSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid booking id") }),
});

// Hotel-scoped list. hotelId comes from the PATH (:id) — see AGENTS.md rule 2.
export const listHotelBookingsValidationSchema = z.object({
  params: z.object({ id: hotelIdField }),
  query: paginationQuerySchema.extend({
    search: z.string().max(255).optional(),
    status: statusField.optional(),
    source: sourceField.optional(),
    // Dashboard filters: ?checkInFrom=&checkInTo= catches "arrivals on date X"
    // without needing a dedicated arrivals endpoint.
    checkInFrom: dateField.optional(),
    checkInTo: dateField.optional(),
    checkOutOn: dateField.optional(),
  }),
});

// Availability: for a window, which rooms of this hotel have NO blocking
// booking. This is the query the front desk and the WhatsApp agent both need.
export const availabilityValidationSchema = z.object({
  params: z.object({ id: hotelIdField }),
  query: z
    .object({
      checkIn: dateField,
      checkOut: dateField,
      // Restrict to one room type later; for now a single optional roomId lets
      // the agent answer "is THAT specific room free?" without a second call.
      roomId: z.string().uuid().optional(),
    })
    .refine((q) => q.checkIn < q.checkOut, {
      message: "Check-out must be after check-in",
      path: ["checkOut"],
    }),
});

export const listRoomBookingsValidationSchema = z.object({
  params: z.object({ id: roomIdField }),
  query: paginationQuerySchema.extend({
    status: statusField.optional(),
  }),
});

export type CreateBookingInput = z.infer<typeof createBookingValidationSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingValidationSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityValidationSchema>;