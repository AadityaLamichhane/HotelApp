import { text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core"
import { hotelsSchema } from "../hotels/schema"
import { usersSchema } from "../users/schema"

// Room is static physical inventory: it holds NO occupancy state beyond
// `isAvailable`, which is a convenience mirror for the dashboard grid.
// The authoritative "who is in this room" lives in the room_entries module
// (see src/modules/room-entries/attributes.ts).
const roomsAttributes = {
    id: uuid("id").primaryKey().defaultRandom(),
    hotelId: uuid("hotel_id")
        .notNull()
        .references(() => hotelsSchema.id),
    name: text("name").notNull(),
    description: text("description"),
    price: integer("price").notNull(),
    isAvailable: boolean("is_available").default(true).notNull(),
    createdBy: integer("created_by")
        .notNull()
        .references(() => usersSchema.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}

export default { roomsAttributes };