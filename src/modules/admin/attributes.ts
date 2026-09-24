import { serial, text, timestamp } from "drizzle-orm/pg-core";

// Dedicated admins table — separate from users so a leaked user JWT can
// never escalate to admin. Passwords are bcrypt hashes (see hashPassword).
const adminAttributes = {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
};

export default { adminAttributes };
