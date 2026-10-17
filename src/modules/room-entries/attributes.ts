import {
  text,
  varchar,
  serial,
  integer,
  timestamp,
  uuid,
  pgEnum,
} from "drizzle-orm/pg-core";
import { roomschema } from "../rooms/schema";

// Promoted from the old dead `room_entries` blob inside the rooms module.
// This is the temporal join between a guest and a room: one row per
// occupancy window. `room_id` now carries a real FK (rooms.id), and
// `status` is the single source of truth for "is this room occupied right
// now" — we never store occupancy on rooms.is_available.
export const roomEntryStatusEnum = pgEnum("room_entry_status", ["open", "closed"]);

const roomEntryattributes = {
  id: serial("id").primaryKey(),
  // One guest (or party) per room per window. Nullable: a walk-in may be
  // logged before identity is known; it gets filled in later.
  guestId: integer("guest_id"),
  customerName: text("customer_name").notNull(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => roomschema.id),
  status: roomEntryStatusEnum("status").default("open").notNull(),
  checkInDate: timestamp("check_in_date").notNull().defaultNow(),
  identityNumber: text("identity_number"),
  numberOfguest: integer("number_of_guest").notNull().default(1),
  mobileNumber: text("mobile_number"),
  malesCount: integer("males_count").notNull().default(0),
  femalesCount: integer("females_count").notNull().default(0),
  purpose: varchar("purpose", { length: 255 }),
  signature: text("signature"),
  checkOutDate: timestamp("check_out_date"),
  // Price locked at check-in time. The room's current `price` may change
  // later; the guest was quoted this rate for this stay.
  roomRate: integer("room_rate").notNull().default(0),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
};

export default { roomEntryattributes };