import { pgTable } from "drizzle-orm/pg-core";
import attributes from "./attributes";

const usersSchema = pgTable("users", attributes.usersAttributes);

export type UserRow = typeof usersSchema.$inferSelect;
export type NewUserRow = typeof usersSchema.$inferInsert;

export default { usersSchema };
export { usersSchema };
