import { text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersSchema } from "../users/schema";

// Simple-sweet SaaS tenant root. createdBy is server-set from
// request.user.id and FK-guarded; slug is server-generated.
const hotelsAttributes = {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: integer("created_by")
    .notNull()
    .references(() => usersSchema.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
};

export default { hotelsAttributes };
