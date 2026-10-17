import { pgTable } from "drizzle-orm/pg-core";
import attributes from "./attributes";

const tablesSchema = pgTable("tables", attributes.tablesAttributes);

export type TableRow = typeof tablesSchema.$inferSelect;
export type NewTableRow = typeof tablesSchema.$inferInsert;

export default { tablesSchema };
export { tablesSchema };
