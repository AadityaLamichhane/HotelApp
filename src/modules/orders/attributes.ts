import {
  text,
  serial,
  integer,
  timestamp,
  uuid,
  pgEnum,
} from "drizzle-orm/pg-core";
import { hotelsSchema } from "../hotels/schema";
import { usersSchema } from "../users/schema";
import { guestsSchema } from "../guests/schema";

// Kitchen-side lifecycle of a single order line.
//   pending   → just placed, kitchen hasn't acknowledged
//   preparing → kitchen is working on it
//   served    → delivered to the table
//   cancelled → guest changed mind or kitchen can't make it
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "preparing",
  "served",
  "cancelled",
]);

const orderAttributes = {
  id: serial("id").primaryKey(),
  guestId: integer("guest_id")
    .notNull()
    .references(() => guestsSchema.id, { onDelete: "cascade" }),
  hotelId: uuid("hotel_id")
    .notNull()
    .references(() => hotelsSchema.id),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPriceNpr: integer("unit_price_npr").notNull().default(0),
  // Snapshot: quantity × unitPriceNpr, computed at create/update time so
  // reports don't have to re-derive it.
  totalNpr: integer("total_npr").notNull().default(0),
  status: orderStatusEnum("status").default("pending").notNull(),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => usersSchema.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
};

export default { orderAttributes };
