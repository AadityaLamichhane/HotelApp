import { bookingsSchema } from "./schema";

/**
 * Explicit column list for every booking read. Never `SELECT *` — the
 * Resource layer is the contract with the frontend, so adding a column to the
 * table must never silently leak it to the API.
 */
export const selectQuery = {
  id: bookingsSchema.id,
  hotelId: bookingsSchema.hotelId,
  roomId: bookingsSchema.roomId,
  guestName: bookingsSchema.guestName,
  guestPhone: bookingsSchema.guestPhone,
  guestCountry: bookingsSchema.guestCountry,
  identityNumber: bookingsSchema.identityNumber,
  adults: bookingsSchema.adults,
  children: bookingsSchema.children,
  checkIn: bookingsSchema.checkIn,
  checkOut: bookingsSchema.checkOut,
  status: bookingsSchema.status,
  source: bookingsSchema.source,
  rateNpr: bookingsSchema.rateNpr,
  totalNpr: bookingsSchema.totalNpr,
  notes: bookingsSchema.notes,
  roomEntryId: bookingsSchema.roomEntryId,
  createdBy: bookingsSchema.createdBy,
  createdAt: bookingsSchema.createdAt,
  updatedAt: bookingsSchema.updatedAt,
};

/**
 * The availability join: every booking of this room that BLOCKS. "Blocking"
 * means pending or confirmed — see the status enum comment. `checked_in` is
 * excluded because an open room_entries row already owns the room today, and
 * `cancelled`/`no_show` must never block or a cancelled booking would poison
 * the calendar permanently.
 */
export const blockingBookingsQuery = {
  roomId: bookingsSchema.roomId,
  checkIn: bookingsSchema.checkIn,
  checkOut: bookingsSchema.checkOut,
};