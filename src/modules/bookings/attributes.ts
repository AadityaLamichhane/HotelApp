import { text, integer, date, timestamp, uuid, pgEnum, index } from "drizzle-orm/pg-core";
import { hotelsSchema } from "../hotels/schema";
import { roomschema } from "../rooms/schema";
import { usersSchema } from "../users/schema";

// Lifecycle of a RESERVATION (future or same-day), which is deliberately not
// the same thing as a room_entry (an occupancy window that is happening now).
//
//   pending   -> agent or staff drafted it, room is HELD, nobody committed
//   confirmed -> guest committed; still not arrived
//   checked_in-> guest physically arrived; a room_entry row now exists
//   cancelled -> released the hold; the dates are free again
//   no_show   -> confirmed but never arrived; needed for RevPAR honesty
//
// Only `pending` and `confirmed` block availability. `checked_in` blocks
// because an open room_entry already owns the room today, and `cancelled` /
// `no_show` must NOT block, or a cancelled booking would poison the calendar
// forever.
export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "checked_in",
  "cancelled",
  "no_show",
]);

// Where the booking came from. `channel` values map to OTA integrations later
// (Booking.com, Agoda, Expedia); `direct` covers walk-in, phone, and WhatsApp.
export const bookingSourceEnum = pgEnum("booking_source", [
  "direct",
  "whatsapp",
  "phone",
  "walk_in",
  "channel",
]);

const bookingAttributes = {
  id: uuid("id").primaryKey().defaultRandom(),
  hotelId: uuid("hotel_id")
    .notNull()
    .references(() => hotelsSchema.id),
  roomId: uuid("room_id")
    .notNull()
    .references(() => roomschema.id),
  // The guest as the front desk knows them right now. There is no `guests`
  // table yet — guest_id stays nullable and is added when guest profiles
  // arrive. Never block a booking on knowing who the guest is.
  guestName: text("guest_name").notNull(),
  guestPhone: text("guest_phone"),
  guestCountry: text("guest_country"),
  identityNumber: text("identity_number"),
  adults: integer("adults").notNull().default(1),
  children: integer("children").notNull().default(0),

  // HALF-OPEN interval: [check_in, check_out). A guest leaving on the 14th
  // and one arriving on the 14th share the bed, not the room — this is why
  // check_out is exclusive and why the overlap test is
  // `check_in < :to AND check_out > :from` rather than BETWEEN.
  checkIn: date("check_in").notNull(),
  checkOut: date("check_out").notNull(),

  status: bookingStatusEnum("status").default("pending").notNull(),
  source: bookingSourceEnum("source").default("direct").notNull(),

  // Price locked at booking time, in NPR (the base currency for the whole
  // system — see the playbook). rooms.price may change later; this guest was
  // quoted this. `rateNpr` is per NIGHT; the folio multiplies by nights.
  rateNpr: integer("rate_npr").notNull().default(0),
  // Sum of the per-night rate across the stay, snapshotted so revenue reports
  // don't have to re-derive it if rates are later edited.
  totalNpr: integer("total_npr").notNull().default(0),

  // Free-form note: "early check-in agreed", "Trekking group, 4 bags",
  // "OTA voucher #X". This is what the WhatsApp agent writes into.
  notes: text("notes"),

  // Set when status moves to checked_in, pointing at the room_entries row
  // created for the actual stay. Nullable FK-free on purpose for now: the
  // linkage is one-directional and we never need to query it in SQL yet.
  roomEntryId: integer("room_entry_id"),

  createdBy: integer("created_by").references(() => usersSchema.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
};

export default { bookingAttributes, bookingStatusEnum, bookingSourceEnum };
export { index };