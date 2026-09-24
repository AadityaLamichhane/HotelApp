import { text, varchar, serial, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core"
import { hotelsSchema } from "../hotels/schema"
import { usersSchema } from "../users/schema"

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

export const roomEntryattributes = {
    id: serial("id").primaryKey(),
    customerName: text("customer_name").notNull(),
    // TODO slice 2: FK -> rooms.id once entries get their own service.
    // Kept FK-free (as before) to avoid a rooms <-> room_entries cycle.
    // uuid to match rooms.id.
    roomId: uuid("room_id").notNull(),
    checkInDate: timestamp("check_in_date").notNull().defaultNow(),
    identityNumber: text("identity_number"),
    numberOfguest: integer("number_of_guest").notNull().default(1),
    mobileNumber: text("mobile_number"),
    malesCount: integer("males_count").notNull().default(0),
    femalesCount: integer("females_count").notNull().default(0),
    purpose: varchar("purpose", { length: 255 }),
    signature: text("signature"),
    checkOutDate: timestamp("check_out_date"),
    roomRate: integer("room_rate").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}
export default {  roomEntryattributes , roomsAttributes };
