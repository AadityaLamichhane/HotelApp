import { boolean, integer, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { hotelsSchema } from "../hotels/schema";
import { usersSchema } from "../users/schema";

// A hotel has exactly ONE menu (enforced by the menus_one_per_hotel unique
// index in schema.ts). Menu items hang off that menu, so the hotel
// dependency is menu_items -> menus -> hotels. We deliberately do NOT
// duplicate hotel_id on menu_items: one source of truth avoids drift.
const menusAttributes = {
  id: uuid("id").primaryKey().defaultRandom(),
  hotelId: uuid("hotel_id")
    .notNull()
    .references(() => hotelsSchema.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Main Menu"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by")
    .notNull()
    .references(() => usersSchema.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
};

// menuId's FK is declared in schema.ts via foreignKey(...) so this module
// does not import its own schema (that would be a circular import).
const menuItemsAttributes = {
  id: uuid("id").primaryKey().defaultRandom(),
  menuId: uuid("menu_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  // NPR, stored as an integer like rooms.price and orders.unit_price_npr.
  price: integer("price").notNull(),
  category: text("category").notNull().default("Uncategorized"),
  isVeg: boolean("is_veg").notNull().default(true),
  isAvailable: boolean("is_available").notNull().default(true),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
};

export default { menusAttributes, menuItemsAttributes };
