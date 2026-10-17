import { text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { hotelsSchema } from "../hotels/schema";
import { usersSchema } from "../users/schema";

// Lean restaurant-table attributes: name/label + seats + availability.
// hotelId scoping + createdBy ownership mirror rooms (see AGENTS.md).
const tablesAttributes = {
  id: uuid("id").primaryKey().defaultRandom(),
  hotelId: uuid("hotel_id")
    .notNull()
    .references(() => hotelsSchema.id),
  name: text("name").notNull(),
  seats: integer("seats").notNull().default(2),
  isAvailable: boolean("is_available").default(true).notNull(),
  createdBy: integer("created_by")
    .notNull()
    .references(() => usersSchema.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
};

export default { tablesAttributes };
