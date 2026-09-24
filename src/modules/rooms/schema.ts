import attributes from "./attributes"
import { pgTable } from "drizzle-orm/pg-core"
const roomschema = pgTable("rooms", attributes.roomsAttributes)
export { roomschema };
export const roomEntrySchema = pgTable("room_entries", attributes.roomEntryattributes)

export type RoomRow = typeof roomschema.$inferSelect;
export type NewRoomRow = typeof roomschema.$inferInsert;
export type RoomEntryRow = typeof roomEntrySchema.$inferSelect;

export default { roomschema, roomEntrySchema };
