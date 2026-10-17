// Central drizzle schema — drizzle-kit reads ONLY this file
// (see drizzle.config.ts). Every module table must be re-exported here
// in FK order: users -> admins -> hotels -> rooms -> tables -> room_entries
// -> bookings -> guests -> orders.
import { usersSchema } from "@/modules/users/schema";
import { adminsSchema } from "@/modules/admin/schema";
import { hotelsSchema } from "@/modules/hotels/schema";
import { roomschema } from "@/modules/rooms/schema";
import { tablesSchema } from "@/modules/tables/schema";
import { roomEntrySchema, roomEntryStatusEnum } from "@/modules/room-entries/schema";
import { bookingsSchema, bookingStatusEnum, bookingSourceEnum } from "@/modules/bookings/schema";
import { guestsSchema, guestStatusEnum } from "@/modules/guests/schema";
import { ordersSchema, orderStatusEnum } from "@/modules/orders/schema";

export {
  usersSchema,
  adminsSchema,
  hotelsSchema,
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
};