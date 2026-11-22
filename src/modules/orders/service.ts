import { and, desc, eq, ilike, sql } from "drizzle-orm";
import db from "@/config/db";
import schema from "./schema";
import { hotelsSchema } from "../hotels/schema";
import { guestsSchema } from "../guests/schema";
import { tablesSchema } from "../tables/schema";
import { roomEntrySchema } from "../room-entries/schema";
import { roomschema } from "../rooms/schema";
import { selectQuery } from "./repository";
import Resource, { type OrderWithDetails } from "./resource";
import { authorizeHotelAccess } from "../staff/access";
import type { StaffPermission } from "../staff/constants";
import {
  throwErrorOnValidation,
  throwForbiddenError,
  throwNotFoundError,
  throwUnauthorizedError,
} from "@/utils/error";

type Viewer = { id?: number; role?: string; hotelId?: string } | undefined | null;

type CreateOrderArgs = {
  hotelId: string;
  guestId?: number | null;
  roomEntryId?: number | null;
  itemName: string;
  quantity?: number;
  unitPriceNpr?: number;
  notes?: string | null;
};

type BatchOrderItem = {
  itemName: string;
  quantity?: number;
  unitPriceNpr?: number;
  notes?: string | null;
};

type CreateBatchOrdersArgs = {
  hotelId: string;
  guestId?: number | null;
  roomEntryId?: number | null;
  items: BatchOrderItem[];
};

type UpdateOrderArgs = {
  itemName?: string;
  quantity?: number;
  unitPriceNpr?: number;
  status?: "pending" | "preparing" | "served" | "cancelled";
  notes?: string | null;
};

type ListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  guestId?: number;
  roomEntryId?: number;
  status?: "pending" | "preparing" | "served" | "cancelled";
  hotelId?: string;
};

const requireAdmin = (viewer: Viewer) => {
  if (!viewer?.id) throw throwUnauthorizedError("Login required");
  if (viewer.role !== "admin") throw throwForbiddenError("Admin access required");
};

const requireUser = (viewer: Viewer): NonNullable<Viewer> => {
  if (!viewer?.id) throw throwUnauthorizedError("Login required");
  return viewer;
};

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
  permission: StaffPermission = "order.view",
) => authorizeHotelAccess(viewer, hotel, permission);

const getGuestOrFail = async (id: number) => {
  const [row] = await db
    .select({
      id: guestsSchema.id,
      hotelId: guestsSchema.hotelId,
      tableId: guestsSchema.tableId,
      guestName: guestsSchema.guestName,
      status: guestsSchema.status,
    })
    .from(guestsSchema)
    .where(eq(guestsSchema.id, id))
    .limit(1);
  if (!row) throw throwNotFoundError("Guest session");
  return row;
};

const getRoomEntryOrFail = async (id: number) => {
  const [row] = await db
    .select({
      id: roomEntrySchema.id,
      roomId: roomEntrySchema.roomId,
      status: roomEntrySchema.status,
      hotelId: roomschema.hotelId,
      roomName: roomschema.name,
    })
    .from(roomEntrySchema)
    .innerJoin(roomschema, eq(roomEntrySchema.roomId, roomschema.id))
    .where(eq(roomEntrySchema.id, id))
    .limit(1);
  if (!row) throw throwNotFoundError("Room entry");
  return row;
};

const getOrderOrFail = async (id: number) => {
  const [row] = await db
    .select(selectQuery)
    .from(schema.ordersSchema)
    .where(eq(schema.ordersSchema.id, id))
    .limit(1);
  if (!row) throw throwNotFoundError("Order");
  return row;
};

/**
 * Place a single order for a guest session or directly for an open room entry.
 */
const create = async (input: CreateOrderArgs, createdBy: number, viewer: Viewer) => {
  if (!createdBy || isNaN(Number(createdBy))) throw throwErrorOnValidation("Login required");
  const hotel = await getHotelOrFail(String(input.hotelId));
  requireHotelAccess(viewer, hotel, "order.manage");

  let guestId: number | null = null;
  let roomEntryId: number | null = null;

  if (input.roomEntryId != null) {
    const entry = await getRoomEntryOrFail(Number(input.roomEntryId));
    if (entry.hotelId !== hotel.id) throw throwErrorOnValidation("Room entry does not belong to this hotel");
    if (entry.status !== "open") throw throwErrorOnValidation("Cannot place order for a closed room entry");
    roomEntryId = entry.id;
  }

  if (input.guestId != null) {
    const guest = await getGuestOrFail(Number(input.guestId));
    if (guest.hotelId !== hotel.id) throw throwErrorOnValidation("Guest does not belong to this hotel");
    if (guest.status !== "open") {
      throw throwErrorOnValidation("Cannot place order for a completed or cancelled table session");
    }
    guestId = guest.id;
  }

  if (!guestId && !roomEntryId) {
    throw throwErrorOnValidation("Either guestId or roomEntryId must be provided");
  }

  const itemName = input.itemName.trim();
  if (!itemName) throw throwErrorOnValidation("Item name is required");

  const quantity = Number(input.quantity ?? 1);
  const unitPriceNpr = Number(input.unitPriceNpr ?? 0);
  const totalNpr = quantity * unitPriceNpr;

  const [row] = await db
    .insert(schema.ordersSchema)
    .values({
      guestId,
      roomEntryId,
      hotelId: hotel.id,
      itemName,
      quantity,
      unitPriceNpr,
      totalNpr,
      status: "pending",
      notes: input.notes ?? null,
      createdBy: Number(createdBy),
    })
    .returning(selectQuery);

  if (!row) throw throwErrorOnValidation("Failed to create order");
  return Resource.toOrderJson(row);
};

/**
 * Place multiple items for a guest session or open room entry in a single batch.
 */
const createBatch = async (input: CreateBatchOrdersArgs, createdBy: number, viewer: Viewer) => {
  if (!createdBy || isNaN(Number(createdBy))) throw throwErrorOnValidation("Login required");
  const hotel = await getHotelOrFail(String(input.hotelId));
  requireHotelAccess(viewer, hotel, "order.manage");

  let guestId: number | null = null;
  let roomEntryId: number | null = null;

  if (input.roomEntryId != null) {
    const entry = await getRoomEntryOrFail(Number(input.roomEntryId));
    if (entry.hotelId !== hotel.id) throw throwErrorOnValidation("Room entry does not belong to this hotel");
    if (entry.status !== "open") throw throwErrorOnValidation("Cannot place order for a closed room entry");
    roomEntryId = entry.id;
  }

  if (input.guestId != null) {
    const guest = await getGuestOrFail(Number(input.guestId));
    if (guest.hotelId !== hotel.id) throw throwErrorOnValidation("Guest does not belong to this hotel");
    if (guest.status !== "open") {
      throw throwErrorOnValidation("Cannot place order for a completed or cancelled table session");
    }
    guestId = guest.id;
  }

  if (!guestId && !roomEntryId) {
    throw throwErrorOnValidation("Either guestId or roomEntryId must be provided");
  }

  if (!input.items || input.items.length === 0) {
    throw throwErrorOnValidation("Items array cannot be empty");
  }

  const rows = await db.transaction(async (tx) => {
    const inserted = [];
    for (const item of input.items) {
      const itemName = item.itemName.trim();
      if (!itemName) throw throwErrorOnValidation("Item name is required for all items");
      const quantity = Number(item.quantity ?? 1);
      const unitPriceNpr = Number(item.unitPriceNpr ?? 0);
      const totalNpr = quantity * unitPriceNpr;

      const [row] = await tx
        .insert(schema.ordersSchema)
        .values({
          guestId,
          roomEntryId,
          hotelId: hotel.id,
          itemName,
          quantity,
          unitPriceNpr,
          totalNpr,
          status: "pending",
          notes: item.notes ?? null,
          createdBy: Number(createdBy),
        })
        .returning(selectQuery);

      if (row) inserted.push(row);
    }
    return inserted;
  });

  return Resource.orderCollection(rows);
};

/**
 * Update an order (quantity, price, status, notes).
 */
const update = async (viewer: Viewer, id: number, input: UpdateOrderArgs) => {
  const user = requireUser(viewer);
  const existing = await getOrderOrFail(id);
  const hotel = await getHotelOrFail(existing.hotelId);
  requireHotelAccess(user, hotel, "order.manage");

  const patch: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.itemName !== undefined) {
    const name = input.itemName.trim();
    if (!name) throw throwErrorOnValidation("Item name cannot be empty");
    patch.itemName = name;
  }

  let nextQuantity = existing.quantity;
  if (input.quantity !== undefined) {
    nextQuantity = Number(input.quantity);
    patch.quantity = nextQuantity;
  }

  let nextPrice = existing.unitPriceNpr;
  if (input.unitPriceNpr !== undefined) {
    nextPrice = Number(input.unitPriceNpr);
    patch.unitPriceNpr = nextPrice;
  }

  if (input.quantity !== undefined || input.unitPriceNpr !== undefined) {
    patch.totalNpr = nextQuantity * nextPrice;
  }

  if (input.status !== undefined) {
    patch.status = input.status;
  }

  if (input.notes !== undefined) {
    patch.notes = input.notes ?? null;
  }

  const [row] = await db
    .update(schema.ordersSchema)
    .set(patch)
    .where(eq(schema.ordersSchema.id, existing.id))
    .returning(selectQuery);

  return Resource.toOrderJson(row);
};

/**
 * Update status directly (e.g. preparing, served, cancelled).
 */
const updateStatus = async (
  viewer: Viewer,
  id: number,
  status: "pending" | "preparing" | "served" | "cancelled",
) => {
  return update(viewer, id, { status });
};

/**
 * Cancel/remove an order line.
 */
const remove = async (viewer: Viewer, id: number) => {
  const user = requireUser(viewer);
  const existing = await getOrderOrFail(id);
  const hotel = await getHotelOrFail(existing.hotelId);
  requireHotelAccess(user, hotel, "order.manage");

  const [row] = await db
    .update(schema.ordersSchema)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(schema.ordersSchema.id, existing.id))
    .returning(selectQuery);

  return Resource.toOrderJson(row);
};

const show = async (viewer: Viewer, id: number): Promise<OrderWithDetails> => {
  const user = requireUser(viewer);
  const row = await getOrderOrFail(id);
  const hotel = await getHotelOrFail(row.hotelId);
  requireHotelAccess(user, hotel);

  let guestName: string | null = null;
  let tableName: string | null = null;
  let roomName: string | null = null;

  if (row.guestId != null) {
    const guest = await getGuestOrFail(row.guestId);
    guestName = guest.guestName;
    const [table] = await db
      .select({ name: tablesSchema.name })
      .from(tablesSchema)
      .where(eq(tablesSchema.id, guest.tableId))
      .limit(1);
    tableName = table?.name ?? null;
  }

  if (row.roomEntryId != null) {
    const entry = await getRoomEntryOrFail(row.roomEntryId);
    roomName = entry.roomName;
  }

  return Resource.mapWithDetails({
    ...row,
    guestName,
    tableName,
    roomName,
  });
};

const runList = async (query: ListQuery) => {
  const page = Number(query?.page) || 1;
  const limit = Math.min(Number(query?.limit) || 20, 100);
  const offset = (page - 1) * limit;

  const conditions = [
    query?.hotelId ? eq(schema.ordersSchema.hotelId, query.hotelId) : undefined,
    query?.guestId ? eq(schema.ordersSchema.guestId, query.guestId) : undefined,
    query?.roomEntryId ? eq(schema.ordersSchema.roomEntryId, query.roomEntryId) : undefined,
    query?.status ? eq(schema.ordersSchema.status, query.status) : undefined,
    query?.search ? ilike(schema.ordersSchema.itemName, `%${query.search.trim()}%`) : undefined,
  ].filter((c) => c !== undefined);

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select({
      ...selectQuery,
      guestName: guestsSchema.guestName,
      tableName: tablesSchema.name,
      roomName: roomschema.name,
    })
    .from(schema.ordersSchema)
    .leftJoin(guestsSchema, eq(schema.ordersSchema.guestId, guestsSchema.id))
    .leftJoin(tablesSchema, eq(guestsSchema.tableId, tablesSchema.id))
    .leftJoin(roomEntrySchema, eq(schema.ordersSchema.roomEntryId, roomEntrySchema.id))
    .leftJoin(roomschema, eq(roomEntrySchema.roomId, roomschema.id))
    .where(where)
    .orderBy(desc(schema.ordersSchema.createdAt))
    .limit(limit)
    .offset(offset);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.ordersSchema)
    .where(where);

  const count = countRows[0]?.count ?? 0;
  return { items: Resource.collectionWithDetails(items), page, limit, total: count };
};

const listByHotel = async (viewer: Viewer, hotelId: string, query: ListQuery) => {
  const user = requireUser(viewer);
  const hotel = await getHotelOrFail(String(hotelId));
  requireHotelAccess(user, hotel);
  return runList({ ...query, hotelId: hotel.id });
};

const listByGuest = async (viewer: Viewer, guestId: number, query: { status?: "pending" | "preparing" | "served" | "cancelled" }) => {
  const user = requireUser(viewer);
  const guest = await getGuestOrFail(Number(guestId));
  const hotel = await getHotelOrFail(guest.hotelId);
  requireHotelAccess(user, hotel);

  const items = await db
    .select(selectQuery)
    .from(schema.ordersSchema)
    .where(
      and(
        eq(schema.ordersSchema.guestId, guest.id),
        query?.status ? eq(schema.ordersSchema.status, query.status) : undefined,
      ),
    )
    .orderBy(desc(schema.ordersSchema.createdAt));

  return { items: Resource.orderCollection(items), total: items.length };
};

const listByRoomEntry = async (viewer: Viewer, roomEntryId: number, query: { status?: "pending" | "preparing" | "served" | "cancelled" }) => {
  const user = requireUser(viewer);
  const entry = await getRoomEntryOrFail(Number(roomEntryId));
  const hotel = await getHotelOrFail(entry.hotelId);
  requireHotelAccess(user, hotel);

  const items = await db
    .select(selectQuery)
    .from(schema.ordersSchema)
    .where(
      and(
        eq(schema.ordersSchema.roomEntryId, entry.id),
        query?.status ? eq(schema.ordersSchema.status, query.status) : undefined,
      ),
    )
    .orderBy(desc(schema.ordersSchema.createdAt));

  return { items: Resource.orderCollection(items), total: items.length };
};

const list = async (viewer: Viewer, query: ListQuery) => {
  requireAdmin(viewer);
  return runList(query);
};

export default {
  create,
  createBatch,
  update,
  updateStatus,
  remove,
  show,
  listByHotel,
  listByGuest,
  listByRoomEntry,
  list,
};
