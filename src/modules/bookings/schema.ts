import attributes, { bookingStatusEnum, bookingSourceEnum } from "./attributes";
import { pgTable, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Bookings = a reservation for a future (or same-day) window.
 *
 * This is deliberately NOT an extension of `room_entries`. That table records
 * occupancy happening NOW (one open entry per room, enforced by a partial
 * unique index). A booking is a CLAIM on future dates, and the two have
 * different lifecycles: a booking can be cancelled or no-show without ever
 * producing a room_entry.
 *
 * The double-booking guarantee for bookings is the service-level overlap test
 * in `service.ts` (`check_in < :to AND check_out > :from`, half-open
 * intervals) plus the composite index below that makes it fast.
 *
 * Hardening note: a Postgres EXCLUDE constraint would make the guarantee
 * concurrency-proof the way `room_entries_one_open_per_room` is for
 * check-ins —
 *
 *   CREATE EXTENSION IF NOT EXISTS btree_gist;
 *   ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
 *     EXCLUDE USING gist (
 *       room_id WITH =,
 *       daterange(check_in, check_out, '[)') WITH &&
 *     ) WHERE (status IN ('pending','confirmed'));
 *
 * That needs the btree_gist extension, which can't be created from a Drizzle
 * schema file, so it is deliberately left as a documented migration rather
 * than something that silently fails on a fresh database. The service check
 * is the working guarantee today; add the constraint when concurrency starts
 * mattering (i.e. two phones checking availability at once).
 */
const bookingsSchema = pgTable(
  "bookings",
  attributes.bookingAttributes,
  () => [
    // Supports "which bookings touch this room" and the overlap scan.
    index("bookings_room_dates_idx").on(
      sql`room_id`,
      sql`check_in`,
      sql`check_out`,
    ),
    // Supports the front-desk dashboard: arrivals / in-house / departures.
    index("bookings_hotel_status_idx").on(sql`hotel_id`, sql`status`),
    // One active booking per room per night is the invariant we're protecting;
    // a non-unique index here keeps the overlap scan cheap without pretending
    // a DB constraint can express the half-open date logic.
    index("bookings_hotel_checkin_idx").on(sql`hotel_id`, sql`check_in`),
  ],
);

export type BookingRow = typeof bookingsSchema.$inferSelect;
export type NewBookingRow = typeof bookingsSchema.$inferInsert;

export default { bookingsSchema };
export { bookingsSchema, bookingStatusEnum, bookingSourceEnum };