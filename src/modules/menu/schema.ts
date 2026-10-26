import {
  foreignKey,
  index,
  pgTable,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import attributes from "./attributes";

const menusSchema = pgTable("menus", attributes.menusAttributes, (t) => [
  // One menu per hotel. Service checks first for a friendly error, but only
  // the DB can enforce this against concurrent requests.
  uniqueIndex("menus_one_per_hotel").on(t.hotelId),
]);

const menuItemsSchema = pgTable("menu_items", attributes.menuItemsAttributes, (t) => [
  index("menu_items_menu_id_idx").on(t.menuId),
  index("menu_items_menu_category_idx").on(t.menuId, t.category),
  foreignKey({
    columns: [t.menuId],
    foreignColumns: [menusSchema.id],
    name: "menu_items_menu_id_fk",
  }).onDelete("cascade"),
]);

export type MenuRow = typeof menusSchema.$inferSelect;
export type NewMenuRow = typeof menusSchema.$inferInsert;
export type MenuItemRow = typeof menuItemsSchema.$inferSelect;
export type NewMenuItemRow = typeof menuItemsSchema.$inferInsert;

export default { menusSchema, menuItemsSchema };
export { menusSchema, menuItemsSchema };
