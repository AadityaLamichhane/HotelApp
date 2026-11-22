import { serial, text, timestamp } from "drizzle-orm/pg-core";

// Users are identified by email; password is optional because accounts can
// also be created through OAuth (see oauthAttributes.ts). A null
// passwordHash means "OAuth-only account" — login never bcrypts it.
// Membership arrives later via HotelUserRole; createdBy on
// hotels/rooms is what links work to a user for now.
const usersAttributes = {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
};

export default { usersAttributes };
