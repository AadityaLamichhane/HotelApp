import { serial, text, timestamp } from "drizzle-orm/pg-core";

// Slice 1: email + password only. No role, no hotelId.
// Membership arrives later via HotelUserRole; createdBy on
// hotels/rooms is what links work to a user for now.
const usersAttributes = {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
};

export default { usersAttributes };
