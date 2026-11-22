import { eq } from "drizzle-orm";
import db from "@/config/db";
import { hotelStaffSchema } from "./schema";
import { roomschema } from "../rooms/schema";
import { roomEntrySchema } from "../room-entries/schema";
import { bookingsSchema } from "../bookings/schema";
import { guestsSchema } from "../guests/schema";
import { menusSchema, menuItemsSchema } from "../menu/schema";
import { ordersSchema } from "../orders/schema";
import { tablesSchema } from "../tables/schema";
import { logisticsSchema } from "../logistics/schema";

/**
 * Route-level permission checks need the hotel id. `hotels/:id/...` routes
 * use the default resolver (params.id is the hotel), but resource-id routes
 * (`rooms/:id`, `orders/:id`, ...) must map the resource back to its hotel.
 *
 * All resolvers return undefined for unknown ids; the middleware then fails
 * closed with 403 instead of leaking whether the resource exists.
 */
const uuidParam = (ctx: any): string | undefined => {
  const id = ctx?.params?.id;
  return id === undefined ? undefined : String(id);
};

const intParam = (ctx: any): number | undefined => {
  const id = Number(ctx?.params?.id);
  return Number.isInteger(id) && id > 0 ? id : undefined;
};

export const staffHotelIdResolver = async (ctx: any): Promise<string | undefined> => {
  const id = uuidParam(ctx);
  if (!id) return undefined;
  const [row] = await db
    .select({ hotelId: hotelStaffSchema.hotelId })
    .from(hotelStaffSchema)
    .where(eq(hotelStaffSchema.id, id))
    .limit(1);
  return row?.hotelId;
};

export const roomHotelIdResolver = async (ctx: any): Promise<string | undefined> => {
  const id = uuidParam(ctx);
  if (!id) return undefined;
  const [row] = await db
    .select({ hotelId: roomschema.hotelId })
    .from(roomschema)
    .where(eq(roomschema.id, id))
    .limit(1);
  return row?.hotelId;
};

export const entryHotelIdResolver = async (ctx: any): Promise<string | undefined> => {
  const id = intParam(ctx);
  if (!id) return undefined;
  const [row] = await db
    .select({ hotelId: roomschema.hotelId })
    .from(roomEntrySchema)
    .innerJoin(roomschema, eq(roomEntrySchema.roomId, roomschema.id))
    .where(eq(roomEntrySchema.id, id))
    .limit(1);
  return row?.hotelId;
};

export const bookingHotelIdResolver = async (ctx: any): Promise<string | undefined> => {
  const id = uuidParam(ctx);
  if (!id) return undefined;
  const [row] = await db
    .select({ hotelId: roomschema.hotelId })
    .from(bookingsSchema)
    .innerJoin(roomschema, eq(bookingsSchema.roomId, roomschema.id))
    .where(eq(bookingsSchema.id, id))
    .limit(1);
  return row?.hotelId;
};

export const guestHotelIdResolver = async (ctx: any): Promise<string | undefined> => {
  const id = intParam(ctx);
  if (!id) return undefined;
  const [row] = await db
    .select({ hotelId: guestsSchema.hotelId })
    .from(guestsSchema)
    .where(eq(guestsSchema.id, id))
    .limit(1);
  return row?.hotelId;
};

export const menuHotelIdResolver = async (ctx: any): Promise<string | undefined> => {
  const id = uuidParam(ctx);
  if (!id) return undefined;
  const [row] = await db
    .select({ hotelId: menusSchema.hotelId })
    .from(menusSchema)
    .where(eq(menusSchema.id, id))
    .limit(1);
  return row?.hotelId;
};

export const menuItemHotelIdResolver = async (ctx: any): Promise<string | undefined> => {
  const id = uuidParam(ctx);
  if (!id) return undefined;
  const [row] = await db
    .select({ hotelId: menusSchema.hotelId })
    .from(menuItemsSchema)
    .innerJoin(menusSchema, eq(menuItemsSchema.menuId, menusSchema.id))
    .where(eq(menuItemsSchema.id, id))
    .limit(1);
  return row?.hotelId;
};

export const orderHotelIdResolver = async (ctx: any): Promise<string | undefined> => {
  const id = intParam(ctx);
  if (!id) return undefined;
  const [row] = await db
    .select({ hotelId: ordersSchema.hotelId })
    .from(ordersSchema)
    .where(eq(ordersSchema.id, id))
    .limit(1);
  return row?.hotelId;
};

export const tableHotelIdResolver = async (ctx: any): Promise<string | undefined> => {
  const id = uuidParam(ctx);
  if (!id) return undefined;
  const [row] = await db
    .select({ hotelId: tablesSchema.hotelId })
    .from(tablesSchema)
    .where(eq(tablesSchema.id, id))
    .limit(1);
  return row?.hotelId;
};

export const logisticsHotelIdResolver = async (ctx: any): Promise<string | undefined> => {
  const id = uuidParam(ctx);
  if (!id) return undefined;
  const [row] = await db
    .select({ hotelId: logisticsSchema.hotelId })
    .from(logisticsSchema)
    .where(eq(logisticsSchema.id, id))
    .limit(1);
  return row?.hotelId;
};
