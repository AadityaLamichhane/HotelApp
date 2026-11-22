import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import attributes from "./attributes";

const usersSchema = pgTable("users", attributes.usersAttributes);

// One row per external identity. `providerAccountId` is the provider's stable
// subject (Google `sub`), never the email — emails change. Keeping this
// generic means Apple/Facebook need a new `provider` value, not a migration.
const oauthAccountsSchema = pgTable(
  "oauth_accounts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersSchema.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    email: text("email"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // The same provider identity can only ever point at one user.
    uniqueIndex("oauth_accounts_provider_account_unique").on(
      table.provider,
      table.providerAccountId,
    ),
    // Product rule: one linked account per provider per user.
    uniqueIndex("oauth_accounts_user_provider_unique").on(table.userId, table.provider),
  ],
);

export type UserRow = typeof usersSchema.$inferSelect;
export type NewUserRow = typeof usersSchema.$inferInsert;
export type OAuthAccountRow = typeof oauthAccountsSchema.$inferSelect;
export type NewOAuthAccountRow = typeof oauthAccountsSchema.$inferInsert;

export default { usersSchema, oauthAccountsSchema };
export { usersSchema, oauthAccountsSchema };
