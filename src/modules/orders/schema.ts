import attributes, { orderStatusEnum } from "./attributes";
import { pgTable, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const ordersSchema = pgTable(
  "orders",
  attributes.orderAttributes,
  () => [
    index("orders_guest_id_idx").on(sql`guest_id`),
    index("orders_room_entry_id_idx").on(sql`room_entry_id`),
    index("orders_hotel_status_idx").on(sql`hotel_id`, sql`status`),
  ],
);

export type OrderRow = typeof ordersSchema.$inferSelect;
export type NewOrderRow = typeof ordersSchema.$inferInsert;

export default { ordersSchema };
export { ordersSchema, orderStatusEnum };
