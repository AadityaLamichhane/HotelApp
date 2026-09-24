import { pgTable } from "drizzle-orm/pg-core";
import attributes from "./attributes";

const hotelsSchema = pgTable("hotels", attributes.hotelsAttributes);

export type HotelRow = typeof hotelsSchema.$inferSelect;
export type NewHotelRow = typeof hotelsSchema.$inferInsert;

export default { hotelsSchema };
export { hotelsSchema };
