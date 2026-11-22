import { text, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { hotelsSchema } from "../hotels/schema";
import { roomschema } from "../rooms/schema";
import { usersSchema } from "../users/schema";

// Logistics is a simple stock ledger: one row per item ("Towel", quantity 40).
// roomId is NULLABLE on purpose — null means general hotel stock (linen
// cupboard), a value means the stock assigned to that room. Deleting a room
// sets roomId back to null instead of destroying the stock record.
const logisticsAttributes = {
    id: uuid("id").primaryKey().defaultRandom(),
    hotelId: uuid("hotel_id")
        .notNull()
        .references(() => hotelsSchema.id),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull().default(0),
    roomId: uuid("room_id").references(() => roomschema.id, { onDelete: "set null" }),
    createdBy: integer("created_by")
        .notNull()
        .references(() => usersSchema.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
};

export default { logisticsAttributes };
