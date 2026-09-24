import { pgTable } from "drizzle-orm/pg-core";
import attributes from "./attributes";

const adminsSchema = pgTable("admins", attributes.adminAttributes);

export type AdminRow = typeof adminsSchema.$inferSelect;
export type NewAdminRow = typeof adminsSchema.$inferInsert;

export default { adminsSchema };
export { adminsSchema };
