// Central drizzle schema — drizzle-kit reads ONLY this file
// (see drizzle.config.ts). Every module table must be re-exported here
// in FK order: users -> oauth_accounts -> admins -> hotels -> menus -> menu_items -> rooms
// -> tables -> room_entries -> bookings -> guests -> orders.
import { usersSchema, oauthAccountsSchema } from "@/modules/users/schema";
import { adminsSchema } from "@/modules/admin/schema";
import { hotelsSchema } from "@/modules/hotels/schema";
import {
  hotelStaffSchema,
  permissionsSchema,
  staffPermissionsSchema,
  staffRoleEnum,
} from "@/modules/staff/schema";
import { menusSchema, menuItemsSchema } from "@/modules/menu/schema";
import { roomschema } from "@/modules/rooms/schema";
import { tablesSchema } from "@/modules/tables/schema";
import { roomEntrySchema, roomEntryStatusEnum } from "@/modules/room-entries/schema";
import { bookingsSchema, bookingStatusEnum, bookingSourceEnum } from "@/modules/bookings/schema";
import { guestsSchema, guestStatusEnum } from "@/modules/guests/schema";
import { ordersSchema, orderStatusEnum } from "@/modules/orders/schema";
import { logisticsSchema } from "@/modules/logistics/schema";

export {
  usersSchema,
  oauthAccountsSchema,
  adminsSchema,
  hotelsSchema,
  hotelStaffSchema,
  permissionsSchema,
  staffPermissionsSchema,
  staffRoleEnum,
  menusSchema,
  menuItemsSchema,
  roomschema,
  tablesSchema,
  roomEntrySchema,
  roomEntryStatusEnum,
  bookingsSchema,
  bookingStatusEnum,
  bookingSourceEnum,
  guestsSchema,
  guestStatusEnum,
  ordersSchema,
  orderStatusEnum,
  logisticsSchema,
};