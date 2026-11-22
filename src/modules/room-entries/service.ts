import { eq, and, ilike, sql, desc, inArray } from "drizzle-orm";
import db from "@/config/db";
import schema from "./schema";
import { roomschema } from "../rooms/schema";
import { hotelsSchema } from "../hotels/schema";
import { ordersSchema } from "../orders/schema";
import { guestsSchema } from "../guests/schema";
import { tablesSchema } from "../tables/schema";
import { selectQuery } from "./repository";
import Resource from "./resource";
import { authorizeHotelAccess } from "../staff/access";
import type { StaffPermission } from "../staff/constants";
import {
  throwErrorOnValidation,
  throwForbiddenError,
  throwNotFoundError,
  throwUnauthorizedError,
} from "@/utils/error";

type CheckInArgs = {
  hotelId: string;
  roomId: string;
  customerName: string;
  guestId?: number | null;
  identityNumber?: string | null;
  mobileNumber?: string | null;
  numberOfguest?: number;
  malesCount?: number;
  femalesCount?: number;
  purpose?: string | null;
  roomRate?: number;
  advanceAmount?: number;
  checkInDate?: string;
};

type CheckOutArgs = {
  checkOutDate?: string;
  discountAmount?: number;
  paidAmount?: number;
  paymentMethod?: string | null;
};

type UpdateEntryArgs = {
  customerName?: string;
  guestId?: number | null;
  identityNumber?: string | null;
  mobileNumber?: string | null;
  numberOfguest?: number;
  malesCount?: number;
  femalesCount?: number;
  purpose?: string | null;
  signature?: string | null;
  advanceAmount?: number;
  discountAmount?: number;
  paidAmount?: number;
  paymentMethod?: string | null;
};

type ListQuery = { page?: number; limit?: number; search?: string; hotelId?: string; status?: string };
type HotelListQuery = { page?: number; limit?: number; search?: string; status?: string };
// Decoded JWT shape (see admin + users services).
type Viewer = { id?: number; role?: string; hotelId?: string } | undefined | null;

// NOTE: no UUID regex here on purpose — shape is validated once at the route
// layer by Zod (validators.ts). The service checks existence (404) + ownership
// (403) and fails closed on anything else (see rooms/service.ts).

const requireAdmin = (viewer: Viewer) => {
  if (!viewer?.id) throw throwUnauthorizedError("Login required");
  if (viewer.role !== "admin") throw throwForbiddenError("Admin access required");
};

const requireUser = (viewer: Viewer): NonNullable<Viewer> => {
  if (!viewer?.id) throw throwUnauthorizedError("Login required");
  return viewer;
};

// Ownership model (no membership table yet): a hotel belongs to the user who
// created it (hotels.created_by). Admins bypass. Every read/write resolves the
// entry's hotel (via its room) and enforces this, so Hotel A can never touch
// Hotel B's occupancy data.
const getHotelOrFail = async (hotelId: string) => {
  const [hotel] = await db
    .select({ id: hotelsSchema.id, createdBy: hotelsSchema.createdBy })
    .from(hotelsSchema)
    .where(eq(hotelsSchema.id, hotelId))
    .limit(1);
  if (!hotel) throw throwNotFoundError("Hotel");
  return hotel;
};

const requireHotelAccess = (
  viewer: Viewer,
  hotel: { id: string; createdBy: number | null },
  permission: StaffPermission = "entry.view",
) => authorizeHotelAccess(viewer, hotel, permission);

const getRoomOrFail = async (id: string) => {
  const [row] = await db
    .select({ id: roomschema.id, hotelId: roomschema.hotelId, name: roomschema.name, price: roomschema.price })
    .from(roomschema)
    .where(eq(roomschema.id, id))
    .limit(1);
  if (!row) throw throwNotFoundError("Room");
  return row;
};

const getEntryOrFail = async (id: number) => {
  const [row] = await db
    .select(selectQuery)
    .from(schema.roomEntrySchema)
    .where(eq(schema.roomEntrySchema.id, id))
    .limit(1);
  if (!row) throw throwNotFoundError("Room entry");
  return row;
};

// Resolve the entry's hotel through its room. Also returns the room name for
// list responses, so callers don't need a second query.
const getEntryContext = async (entry: { roomId: string }) => {
  const room = await getRoomOrFail(entry.roomId);
  const hotel = await getHotelOrFail(room.hotelId);
  return { room, hotel };
};

// The single open entry for a room, if any. This is the whole occupancy
// question — "who is in room 204 right now" — expressed as one query.
const getOpenEntryForRoom = async (roomId: string) => {
  const [row] = await db
    .select(selectQuery)
    .from(schema.roomEntrySchema)
    .where(and(eq(schema.roomEntrySchema.roomId, roomId), eq(schema.roomEntrySchema.status, "open")))
    .limit(1);
  return row ?? null;
};

/**
 * Check a guest into a room.
 *
 * Occupancy is NOT stored on rooms.is_available — this row is the truth.
 * The room's is_available is kept in sync for the hotel's dashboard grid,
 * but every read of "who's here" goes through this table.
 */
const checkIn = async (input: CheckInArgs, createdBy: number, viewer: Viewer) => {
  if (!createdBy || isNaN(Number(createdBy))) throw throwErrorOnValidation("Login required");
  const hotel = await getHotelOrFail(String(input.hotelId));
  requireHotelAccess(viewer, hotel, "entry.manage");

  const room = await getRoomOrFail(String(input.roomId));
  // Room must belong to the same hotel as the caller claimed, else 404 so we
  // don't confirm the room exists at another hotel.
  if (room.hotelId !== hotel.id) throw throwNotFoundError("Room");

  const existing = await getOpenEntryForRoom(room.id);
  if (existing) {
    throw throwErrorOnValidation(
      `Room ${room.name} is currently occupied until ${
        existing.checkOutDate ? existing.checkOutDate.toISOString() : "further notice"
      }`,
    );
  }

  const checkInDate = input.checkInDate ? new Date(input.checkInDate) : new Date();
  const [row] = await db
    .insert(schema.roomEntrySchema)
    .values({
      guestId: input.guestId ?? null,
      customerName: input.customerName.trim(),
      roomId: room.id,
      status: "open",
      checkInDate,
      identityNumber: input.identityNumber ?? null,
      numberOfguest: Number(input.numberOfguest ?? 1),
      mobileNumber: input.mobileNumber ?? null,
      malesCount: Number(input.malesCount ?? 0),
      femalesCount: Number(input.femalesCount ?? 0),
      purpose: input.purpose ?? null,
      // Lock the rate at check-in. The room's price can change later; this
      // guest was quoted this.
      roomRate: input.roomRate !== undefined ? Number(input.roomRate) : Number(room.price),
      advanceAmount: input.advanceAmount !== undefined ? Number(input.advanceAmount) : 0,
      createdBy: Number(createdBy),
    })
    .returning(selectQuery);
  if (!row) throw throwErrorOnValidation("Failed to check in guest");

  // Keep the dashboard grid in sync. Purely derived state — if this write
  // ever drifts, the open-entry query above is still authoritative.
  await db
    .update(roomschema)
    .set({ isAvailable: false, updatedAt: new Date() })
    .where(eq(roomschema.id, room.id));

  return Resource.mapWithRoom({ ...row, roomName: room.name, hotelId: hotel.id });
};

const getFolioInternal = async (
  entry: typeof schema.roomEntrySchema.$inferSelect,
  room: { id: string; name: string },
  hotel: { id: string },
) => {
  const inDate = new Date(entry.checkInDate!);
  const outDate = entry.checkOutDate ? new Date(entry.checkOutDate) : new Date();
  const diffHours = Math.max(0, (outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60));
  const nights = Math.max(1, Math.round(diffHours / 24) || 1);
  const stayTotal = nights * (entry.roomRate || 0);

  // 1. Direct room orders
  const directOrders = await db
    .select({
      id: ordersSchema.id,
      guestId: ordersSchema.guestId,
      roomEntryId: ordersSchema.roomEntryId,
      hotelId: ordersSchema.hotelId,
      itemName: ordersSchema.itemName,
      quantity: ordersSchema.quantity,
      unitPriceNpr: ordersSchema.unitPriceNpr,
      totalNpr: ordersSchema.totalNpr,
      status: ordersSchema.status,
      notes: ordersSchema.notes,
      createdAt: ordersSchema.createdAt,
    })
    .from(ordersSchema)
    .where(eq(ordersSchema.roomEntryId, entry.id));

  // 2. Transferred / linked table orders
  const tableSessions = await db
    .select({
      id: guestsSchema.id,
      tableName: tablesSchema.name,
    })
    .from(guestsSchema)
    .leftJoin(tablesSchema, eq(guestsSchema.tableId, tablesSchema.id))
    .where(eq(guestsSchema.roomEntryId, entry.id));

  let tableOrders: any[] = [];
  if (tableSessions.length > 0) {
    const sessionIds = tableSessions.map((s) => s.id);
    const sessionTableMap = new Map(tableSessions.map((s) => [s.id, s.tableName]));
    const rawTableOrders = await db
      .select({
        id: ordersSchema.id,
        guestId: ordersSchema.guestId,
        roomEntryId: ordersSchema.roomEntryId,
        hotelId: ordersSchema.hotelId,
        itemName: ordersSchema.itemName,
        quantity: ordersSchema.quantity,
        unitPriceNpr: ordersSchema.unitPriceNpr,
        totalNpr: ordersSchema.totalNpr,
        status: ordersSchema.status,
        notes: ordersSchema.notes,
        createdAt: ordersSchema.createdAt,
      })
      .from(ordersSchema)
      .where(inArray(ordersSchema.guestId, sessionIds));

    tableOrders = rawTableOrders.map((o) => ({
      ...o,
      tableName: sessionTableMap.get(o.guestId!) ?? "Table",
    }));
  }

  const allOrders = [
    ...directOrders.map((o) => ({ ...o, source: "room_service" as const, tableName: null })),
    ...tableOrders.map((o) => ({ ...o, source: "table" as const })),
  ];

  const billableOrders = allOrders.filter((o) => o.status === "served");
  const activeKitchenOrders = allOrders.filter((o) => o.status === "pending" || o.status === "preparing");
  const cancelledOrders = allOrders.filter((o) => o.status === "cancelled");

  const ordersTotal = billableOrders.reduce((sum, o) => sum + (o.totalNpr || 0), 0);
  const subtotal = stayTotal + ordersTotal;
  const discountAmount = entry.discountAmount || 0;
  const advanceAmount = entry.advanceAmount || 0;
  const balanceDue = Math.max(0, subtotal - discountAmount - advanceAmount);

  return {
    entry: Resource.mapWithRoom({ ...entry, roomName: room.name, hotelId: hotel.id }),
    nights,
    stayTotal,
    ordersTotal,
    subtotal,
    discountAmount,
    advanceAmount,
    balanceDue,
    paidAmount: entry.paidAmount || 0,
    paymentMethod: entry.paymentMethod || null,
    orders: allOrders,
    billableOrders,
    activeKitchenOrders,
    cancelledOrders,
  };
};

const getFolio = async (viewer: Viewer, id: number) => {
  const user = requireUser(viewer);
  const entry = await getEntryOrFail(id);
  const { room, hotel } = await getEntryContext(entry);
  requireHotelAccess(user, hotel);
  return getFolioInternal(entry, room, hotel);
};

/**
 * Check a guest out. Closes the entry — the room is free the instant no open
 * entry remains, so there's nothing to "clear" or reset. The next guest gets
 * a brand-new entry row and the history is preserved for reporting.
 */
const checkOut = async (viewer: Viewer, id: number, input?: CheckOutArgs) => {
  const user = requireUser(viewer);
  const existing = await getEntryOrFail(id);
  const { room, hotel } = await getEntryContext(existing);
  requireHotelAccess(user, hotel, "entry.manage");

  if (existing.status === "closed") throw throwErrorOnValidation("Guest is already checked out");

  const folio = await getFolioInternal(existing, room, hotel);
  if (folio.activeKitchenOrders.length > 0) {
    throw throwErrorOnValidation(
      `Cannot check out: ${folio.activeKitchenOrders.length} order(s) are still active in the kitchen. Please mark them served or cancelled first.`,
    );
  }

  const out = input?.checkOutDate ? new Date(input.checkOutDate) : new Date();
  if (out < new Date(existing.checkInDate!))
    throw throwErrorOnValidation("Check-out date cannot be before check-in date");

  const [row] = await db
    .update(schema.roomEntrySchema)
    .set({
      status: "closed",
      checkOutDate: out,
      discountAmount: Number(input?.discountAmount ?? existing.discountAmount ?? 0),
      paidAmount: Number(input?.paidAmount ?? 0),
      paymentMethod: input?.paymentMethod ?? null,
      updatedAt: new Date(),
    })
    .where(eq(schema.roomEntrySchema.id, existing.id))
    .returning(selectQuery);
  if (!row) throw throwNotFoundError("Room entry");

  // Free the room for the next guest (again, derived — the open-entry query
  // is authoritative).
  await db.update(roomschema).set({ isAvailable: true, updatedAt: new Date() }).where(eq(roomschema.id, room.id));

  return Resource.mapWithRoom({ ...row, roomName: room.name, hotelId: hotel.id });
};

// ADMIN PANEL list — all hotels. Route gate is `authCheckType: ["admin"]`;
// the requireAdmin above is defense-in-depth.
const list = async (viewer: Viewer, query: ListQuery) => {
  requireAdmin(viewer);
  const page = Number(query?.page) || 1;
  const limit = Math.min(Number(query?.limit) || 10, 100);
  const offset = (page - 1) * limit;
  const hotelId =
    query?.hotelId !== undefined && String(query.hotelId).trim() !== "" ? String(query.hotelId) : undefined;
  const status = query?.status;

  const conditions = [
    query?.search
      ? ilike(schema.roomEntrySchema.customerName, `%${query.search.trim()}%`)
      : undefined,
    hotelId !== undefined ? eq(roomschema.hotelId, hotelId) : undefined,
    status ? eq(schema.roomEntrySchema.status, status as any) : undefined,
  ].filter((c) => c !== undefined);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select({ ...selectQuery, roomName: roomschema.name, hotelId: roomschema.hotelId })
    .from(schema.roomEntrySchema)
    .innerJoin(roomschema, eq(schema.roomEntrySchema.roomId, roomschema.id))
    .where(where)
    .orderBy(desc(schema.roomEntrySchema.checkInDate))
    .limit(limit)
    .offset(offset);
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.roomEntrySchema)
    .innerJoin(roomschema, eq(schema.roomEntrySchema.roomId, roomschema.id))
    .where(where);
  const count = countRows[0]?.count ?? 0;
  return { items: Resource.collectionWithRoom(items), page, limit, total: count };
};

// HOTEL-SCOPED list — callers see ONLY hotels they own (admins: any). hotelId
// is forced from the path so scope can't be widened.
const listByHotel = async (viewer: Viewer, hotelId: string, query: HotelListQuery) => {
  const user = requireUser(viewer);
  const hotel = await getHotelOrFail(String(hotelId));
  requireHotelAccess(user, hotel);
  const page = Number(query?.page) || 1;
  const limit = Math.min(Number(query?.limit) || 10, 100);
  const offset = (page - 1) * limit;

  const conditions = [
    eq(roomschema.hotelId, hotel.id),
    query?.search ? ilike(schema.roomEntrySchema.customerName, `%${query.search.trim()}%`) : undefined,
    query?.status ? eq(schema.roomEntrySchema.status, query.status as any) : undefined,
  ].filter((c) => c !== undefined);

  const items = await db
    .select({ ...selectQuery, roomName: roomschema.name, hotelId: roomschema.hotelId })
    .from(schema.roomEntrySchema)
    .innerJoin(roomschema, eq(schema.roomEntrySchema.roomId, roomschema.id))
    .where(and(...conditions))
    .orderBy(desc(schema.roomEntrySchema.checkInDate))
    .limit(limit)
    .offset(offset);
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.roomEntrySchema)
    .innerJoin(roomschema, eq(schema.roomEntrySchema.roomId, roomschema.id))
    .where(and(...conditions));
  const count = countRows[0]?.count ?? 0;
  return { items: Resource.collectionWithRoom(items), page, limit, total: count };
};

const show = async (viewer: Viewer, id: number) => {
  const user = requireUser(viewer);
  const row = await getEntryOrFail(id);
  const { room, hotel } = await getEntryContext(row);
  requireHotelAccess(user, hotel);
  return Resource.mapWithRoom({ ...row, roomName: room.name, hotelId: hotel.id });
};

// History for one room — every guest who ever occupied it, newest first.
// Backed by the append-only log; no past-occupant state is overwritten.
const listByRoom = async (viewer: Viewer, roomId: string, query: { status?: string }) => {
  const user = requireUser(viewer);
  const room = await getRoomOrFail(String(roomId));
  const hotel = await getHotelOrFail(room.hotelId);
  requireHotelAccess(user, hotel);
  const status = query?.status;

  const conditions = [
    eq(schema.roomEntrySchema.roomId, room.id),
    status ? eq(schema.roomEntrySchema.status, status as any) : undefined,
  ].filter((c) => c !== undefined);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select(selectQuery)
    .from(schema.roomEntrySchema)
    .where(where)
    .orderBy(desc(schema.roomEntrySchema.checkInDate));
  return { items: Resource.roomEntryCollection(items), total: items.length };
};

// Single-room reads resolve the room's hotel and enforce ownership, so hitting
// another hotel's room UUID returns 403 (never leaks it).
const update = async (viewer: Viewer, id: number, input: UpdateEntryArgs) => {
  const user = requireUser(viewer);
  const existing = await getEntryOrFail(id);
  const { room, hotel } = await getEntryContext(existing);
  requireHotelAccess(user, hotel, "entry.manage");
  if (existing.status === "closed")
    throw throwErrorOnValidation("A closed entry can no longer be edited");

  if (input.customerName !== undefined && !input.customerName.trim()) {
    throw throwErrorOnValidation("Guest name cannot be empty");
  }

  const [row] = await db
    .update(schema.roomEntrySchema)
    .set({
      ...input,
      customerName: input.customerName ? input.customerName.trim() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(schema.roomEntrySchema.id, existing.id))
    .returning(selectQuery);
  if (!row) throw throwNotFoundError("Room entry");
  return Resource.mapWithRoom({ ...row, roomName: room.name, hotelId: hotel.id });
};

// Entries are history — never hard-deleted. Cancelling a mistaken check-in
// closes the entry like a checkout, so the audit trail stays intact.
const remove = async (viewer: Viewer, id: number) => {
  const user = requireUser(viewer);
  const existing = await getEntryOrFail(id);
  const { room, hotel } = await getEntryContext(existing);
  requireHotelAccess(user, hotel, "entry.manage");

  const [row] = await db
    .update(schema.roomEntrySchema)
    .set({ status: "closed", checkOutDate: new Date(), updatedAt: new Date() })
    .where(eq(schema.roomEntrySchema.id, existing.id))
    .returning(selectQuery);
  if (!row) throw throwNotFoundError("Room entry");
  await db.update(roomschema).set({ isAvailable: true, updatedAt: new Date() }).where(eq(roomschema.id, room.id));
  return Resource.mapWithRoom({ ...row, roomName: room.name, hotelId: hotel.id });
};

export default {
  checkIn,
  checkOut,
  getFolio,
  list,
  listByHotel,
  listByRoom,
  show,
  update,
  remove,
  getOpenEntryForRoom,
};