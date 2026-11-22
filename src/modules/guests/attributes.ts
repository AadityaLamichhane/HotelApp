import {
  text,
  serial,
  integer,
  timestamp,
  uuid,
  pgEnum,
} from "drizzle-orm/pg-core";
import { hotelsSchema } from "../hotels/schema";
import { tablesSchema } from "../tables/schema";
import { usersSchema } from "../users/schema";

// A guest row is one party sitting at one table. The lifecycle is simple:
//   open      → party is seated, orders are being taken
//   completed → party left, bill settled (or auto-closed by next party)
//   cancelled → opened by mistake, no real visit
//
// Only `open` blocks the table. `completed` and `cancelled` are history.
export const guestStatusEnum = pgEnum("guest_status", [
  "open",
  "completed",
  "cancelled",
]);

const guestAttributes = {
  id: serial("id").primaryKey(),
  hotelId: uuid("hotel_id")
    .notNull()
    .references(() => hotelsSchema.id),
  tableId: uuid("table_id")
    .notNull()
    .references(() => tablesSchema.id),
  // Walk-in may not give a name; it gets filled in later.
  guestName: text("guest_name"),
  guestCount: integer("guest_count").notNull().default(1),
  status: guestStatusEnum("status").default("open").notNull(),

  // ── Room bridge (both nullable, FK-free on purpose) ──────────────────
  // Set when the guest at the table books a room. One-directional link;
  // neither bookings nor room_entries need to know about guests.
  bookingId: uuid("booking_id"),
  // Set when the guest checks in directly from the table (walk-in room).
  roomEntryId: integer("room_entry_id"),
  notes: text("notes"),
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
  createdBy: integer("created_by").references(() => usersSchema.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
};

export default { guestAttributes };
