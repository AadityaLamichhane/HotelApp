import attributes from "./attributes";
import { pgTable } from "drizzle-orm/pg-core";

const logisticsSchema = pgTable("logistics", attributes.logisticsAttributes);

export type LogisticsRow = typeof logisticsSchema.$inferSelect;
export type NewLogisticsRow = typeof logisticsSchema.$inferInsert;

export default { logisticsSchema };
export { logisticsSchema };
