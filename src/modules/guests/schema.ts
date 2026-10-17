import attributes, { guestStatusEnum } from "./attributes";
import { pgTable, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const guestsSchema = pgTable(
  "guests",
  attributes.guestAttributes,
  () => [
    // Database-level guarantee that only ONE open session exists per table.
    uniqueIndex("guests_one_open_per_table")
      .on(sql`table_id`)
      .where(sql`status = 'open'`),
    index("guests_hotel_status_idx").on(sql`hotel_id`, sql`status`),
    index("guests_table_id_idx").on(sql`table_id`),
    index("guests_booking_id_idx").on(sql`booking_id`),
    index("guests_room_entry_id_idx").on(sql`room_entry_id`),
  ],
);

export type GuestRow = typeof guestsSchema.$inferSelect;
export type NewGuestRow = typeof guestsSchema.$inferInsert;

export default { guestsSchema };
export { guestsSchema, guestStatusEnum };
