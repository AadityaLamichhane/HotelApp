import attributes, { roomEntryStatusEnum } from "./attributes";
import { pgTable, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const roomEntrySchema = pgTable(
  "room_entries",
  attributes.roomEntryattributes,
  () => [
    // A room can have many past entries but exactly ONE open one. This
    // partial unique index is the database-level guarantee that two
    // front-desk clerks can't double-book room 204 at the same time —
    // the service checks it too, but only the DB can enforce it against
    // concurrent requests.
    uniqueIndex("room_entries_one_open_per_room")
      .on(sql`room_id`)
      .where(sql`status = 'open'`),
    index("room_entries_status_idx").on(sql`status`),
  ],
);

export type RoomEntryRow = typeof roomEntrySchema.$inferSelect;
export type NewRoomEntryRow = typeof roomEntrySchema.$inferInsert;

export default { roomEntrySchema };
export { roomEntrySchema, roomEntryStatusEnum };