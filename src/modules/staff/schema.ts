import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import attributes, { staffRoleEnum } from "./attributes";

const hotelStaffSchema = pgTable("hotel_staff", attributes.hotelStaffAttributes, (t) => [
  // A user can only be added once per hotel. This is the DB-level guard
  // against two concurrent "add staff" requests creating duplicates.
  uniqueIndex("hotel_staff_hotel_user_unique").on(t.hotelId, t.userId),
  index("hotel_staff_hotel_id_idx").on(t.hotelId),
  index("hotel_staff_user_id_idx").on(t.userId),
]);

// Catalog of every permission the application understands. Rows are seeded
// from PERMISSION_CATALOG (constants.ts) and referenced by id, so grants stay
// stable and the frontend can render checkboxes with real ids.
const permissionsSchema = pgTable(
  "permissions",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    module: text("module").notNull(),
    action: text("action").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("permissions_key_unique").on(t.key),
    index("permissions_module_idx").on(t.module),
  ],
);

// Explicit grants. The role is only a default bundle applied at create time;
// authorization always reads these rows joined to the catalog.
const staffPermissionsSchema = pgTable(
  "staff_permissions",
  {
    id: serial("id").primaryKey(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => hotelStaffSchema.id, { onDelete: "cascade" }),
    permissionId: integer("permission_id")
      .notNull()
      .references(() => permissionsSchema.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("staff_permissions_staff_permission_unique").on(t.staffId, t.permissionId),
    index("staff_permissions_permission_id_idx").on(t.permissionId),
  ],
);

export type HotelStaffRow = typeof hotelStaffSchema.$inferSelect;
export type NewHotelStaffRow = typeof hotelStaffSchema.$inferInsert;
export type PermissionRow = typeof permissionsSchema.$inferSelect;
export type NewPermissionRow = typeof permissionsSchema.$inferInsert;
export type StaffPermissionRow = typeof staffPermissionsSchema.$inferSelect;
export type NewStaffPermissionRow = typeof staffPermissionsSchema.$inferInsert;

export default { hotelStaffSchema, permissionsSchema, staffPermissionsSchema };
export { hotelStaffSchema, permissionsSchema, staffPermissionsSchema, staffRoleEnum };
