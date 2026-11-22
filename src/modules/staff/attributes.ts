import { boolean, integer, pgEnum, timestamp, uuid } from "drizzle-orm/pg-core";
import { hotelsSchema } from "../hotels/schema";
import { usersSchema } from "../users/schema";
import { STAFF_ROLES } from "./constants";

export const staffRoleEnum = pgEnum("staff_role", STAFF_ROLES);

// One row per (hotel, user) membership. `hotels.created_by` stays the
// ownership truth; this table is what lets OTHER users work at the hotel.
// Deleting the hotel or the user removes the membership (cascade) so no
// dangling grants survive.
const hotelStaffAttributes = {
  id: uuid("id").primaryKey().defaultRandom(),
  hotelId: uuid("hotel_id")
    .notNull()
    .references(() => hotelsSchema.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersSchema.id, { onDelete: "cascade" }),
  role: staffRoleEnum("role").notNull().default("staff"),
  isActive: boolean("is_active").notNull().default(true),
  invitedBy: integer("invited_by").references(() => usersSchema.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
};

export default { hotelStaffAttributes };
