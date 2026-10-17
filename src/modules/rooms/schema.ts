import attributes from "./attributes"
import { pgTable } from "drizzle-orm/pg-core"
const roomschema = pgTable("rooms", attributes.roomsAttributes)
export { roomschema };

export type RoomRow = typeof roomschema.$inferSelect;
export type NewRoomRow = typeof roomschema.$inferInsert;

export default { roomschema };
