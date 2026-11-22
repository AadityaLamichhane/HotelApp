import { and, desc, eq, ilike, sql } from "drizzle-orm";
import db from "@/config/db";
import schema from "./schema";
import { hotelsSchema } from "../hotels/schema";
import { tablesSchema } from "../tables/schema";
import { bookingsSchema } from "../bookings/schema";
import { roomEntrySchema } from "../room-entries/schema";
import { roomschema } from "../rooms/schema";
import { ordersSchema } from "../orders/schema";
import { selectQuery } from "./repository";
import Resource, { type GuestWithDetails } from "./resource";
import { authorizeHotelAccess } from "../staff/access";
import type { StaffPermission } from "../staff/constants";
import {
  throwErrorOnValidation,
  throwForbiddenError,
  throwNotFoundError,
  throwUnauthorizedError,
} from "@/utils/error";

type Viewer = { id?: number; role?: string; hotelId?: string } | undefined | null;

type CreateGuestArgs = {
  hotelId: string;
  tableId: string;
  guestName?: string | null;
  guestCount?: number;
  bookingId?: string | null;
  roomEntryId?: number | null;
  notes?: string | null;
};

type UpdateGuestArgs = {
  guestName?: string | null;
  guestCount?: number;
  tableId?: string;
  bookingId?: string | null;
  roomEntryId?: number | null;
  notes?: string | null;
  status?: "open" | "completed" | "cancelled";
};

type ListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  tableId?: string;
  status?: "open" | "completed" | "cancelled";
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
  permission: StaffPermission = "guest.view",
) => authorizeHotelAccess(viewer, hotel, permission);

const getTableOrFail = async (id: string) => {
  const [row] = await db
    .select({
      id: tablesSchema.id,
      hotelId: tablesSchema.hotelId,
      name: tablesSchema.name,
      isAvailable: tablesSchema.isAvailable,
    })
    .from(tablesSchema)
    .where(eq(tablesSchema.id, id))
    .limit(1);
  if (!row) throw throwNotFoundError("Table");
  return row;
};

const getGuestOrFail = async (id: number) => {
  const [row] = await db
    .select(selectQuery)
    .from(schema.guestsSchema)
    .where(eq(schema.guestsSchema.id, id))
    .limit(1);
  if (!row) throw throwNotFoundError("Guest session");
  return row;
};

/**
 * Open a new guest session for a table.
 * If another session is already open on this table, it is automatically
 * marked as completed, ensuring only one active party per table.
 */
const create = async (input: CreateGuestArgs, createdBy: number, viewer: Viewer) => {
  if (!createdBy || isNaN(Number(createdBy))) throw throwErrorOnValidation("Login required");
  const hotel = await getHotelOrFail(String(input.hotelId));
  requireHotelAccess(viewer, hotel, "guest.manage");

  const table = await getTableOrFail(String(input.tableId));
  if (table.hotelId !== hotel.id) throw throwNotFoundError("Table");

  // Validate room bridge if provided
  if (input.bookingId) {
    const [b] = await db
      .select({ id: bookingsSchema.id, hotelId: bookingsSchema.hotelId })
      .from(bookingsSchema)
      .where(eq(bookingsSchema.id, input.bookingId))
      .limit(1);
    if (!b || b.hotelId !== hotel.id) throw throwErrorOnValidation("Invalid booking id for this hotel");
  }

  if (input.roomEntryId) {
    const [re] = await db
      .select({ id: roomEntrySchema.id, hotelId: roomschema.hotelId })
      .from(roomEntrySchema)
      .innerJoin(roomschema, eq(roomEntrySchema.roomId, roomschema.id))
      .where(eq(roomEntrySchema.id, input.roomEntryId))
      .limit(1);
    if (!re || re.hotelId !== hotel.id) throw throwErrorOnValidation("Invalid room entry id for this hotel");
  }

  // In a transaction: auto-complete any existing open session for this table, then create new one.
  const newGuest = await db.transaction(async (tx) => {
    // 1. Auto-complete previous open session on this table
    await tx
      .update(schema.guestsSchema)
      .set({
        status: "completed",
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.guestsSchema.tableId, table.id),
          eq(schema.guestsSchema.status, "open"),
        ),
      );

    // 2. Insert new session
    const [row] = await tx
      .insert(schema.guestsSchema)
      .values({
        hotelId: hotel.id,
        tableId: table.id,
        guestName: input.guestName ? input.guestName.trim() : null,
        guestCount: Number(input.guestCount ?? 1),
        status: "open",
        bookingId: input.bookingId ?? null,
        roomEntryId: input.roomEntryId ?? null,
        notes: input.notes ?? null,
        openedAt: new Date(),
        createdBy: Number(createdBy),
      })
      .returning(selectQuery);

    // 3. Mark table as unavailable
    await tx
      .update(tablesSchema)
      .set({ isAvailable: false, updatedAt: new Date() })
      .where(eq(tablesSchema.id, table.id));

    return row;
  });

  return Resource.mapWithDetails({ ...newGuest, tableName: table.name });
};

/**
 * Complete a guest session (bill settled / party departed).
 * Optionally charges the bill to an open room entry by setting roomEntryId.
 */
const complete = async (viewer: Viewer, id: number, input?: { roomEntryId?: number | null }) => {
  const user = requireUser(viewer);
  const existing = await getGuestOrFail(id);
  const hotel = await getHotelOrFail(existing.hotelId);
  requireHotelAccess(user, hotel, "guest.manage");

  if (existing.status !== "open") {
    throw throwErrorOnValidation(`Session is already ${existing.status}`);
  }

  let targetRoomEntryId = existing.roomEntryId;
  if (input?.roomEntryId !== undefined) {
    if (input.roomEntryId) {
      const [entry] = await db
        .select({ id: roomEntrySchema.id, status: roomEntrySchema.status })
        .from(roomEntrySchema)
        .where(eq(roomEntrySchema.id, input.roomEntryId))
        .limit(1);
      if (!entry) throw throwNotFoundError("Room entry");
      if (entry.status !== "open") {
        throw throwErrorOnValidation("Cannot link to a closed room entry");
      }
      targetRoomEntryId = entry.id;
    } else {
      targetRoomEntryId = null;
    }
  }

  const [row] = await db
    .update(schema.guestsSchema)
    .set({
      status: "completed",
      roomEntryId: targetRoomEntryId,
      closedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.guestsSchema.id, existing.id))
    .returning(selectQuery);

  // Set table back to available
  await db
    .update(tablesSchema)
    .set({ isAvailable: true, updatedAt: new Date() })
    .where(eq(tablesSchema.id, existing.tableId));

  const table = await getTableOrFail(existing.tableId);
  return Resource.mapWithDetails({ ...row, tableName: table.name });
};

/**
 * Cancel a guest session.
 */
const cancel = async (viewer: Viewer, id: number) => {
  const user = requireUser(viewer);
  const existing = await getGuestOrFail(id);
  const hotel = await getHotelOrFail(existing.hotelId);
  requireHotelAccess(user, hotel, "guest.manage");

  const [row] = await db
    .update(schema.guestsSchema)
    .set({
      status: "cancelled",
      closedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.guestsSchema.id, existing.id))
    .returning(selectQuery);

  if (existing.status === "open") {
    await db
      .update(tablesSchema)
      .set({ isAvailable: true, updatedAt: new Date() })
      .where(eq(tablesSchema.id, existing.tableId));
  }

  const table = await getTableOrFail(existing.tableId);
  return Resource.mapWithDetails({ ...row, tableName: table.name });
};

/**
 * Update guest session details or status.
 */
const update = async (viewer: Viewer, id: number, input: UpdateGuestArgs) => {
  const user = requireUser(viewer);
  const existing = await getGuestOrFail(id);
  const hotel = await getHotelOrFail(existing.hotelId);
  requireHotelAccess(user, hotel, "guest.manage");

  const patch: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.guestName !== undefined) {
    patch.guestName = input.guestName ? input.guestName.trim() : null;
  }
  if (input.guestCount !== undefined) {
    patch.guestCount = Number(input.guestCount);
  }

  let targetTableId = existing.tableId;
  if (input.tableId !== undefined && input.tableId !== existing.tableId) {
    if (existing.status !== "open" || (input.status !== undefined && input.status !== "open")) {
      throw throwErrorOnValidation("Only an open table session can be moved");
    }
    const targetTable = await getTableOrFail(input.tableId);
    if (targetTable.hotelId !== hotel.id) throw throwNotFoundError("Table");
    if (!targetTable.isAvailable) {
      throw throwErrorOnValidation("Selected table is no longer available");
    }
    patch.tableId = targetTable.id;
    targetTableId = targetTable.id;
  }

  if (input.notes !== undefined) {
    patch.notes = input.notes ?? null;
  }
  if (input.bookingId !== undefined) {
    if (input.bookingId) {
      const [b] = await db
        .select({ id: bookingsSchema.id, hotelId: bookingsSchema.hotelId })
        .from(bookingsSchema)
        .where(eq(bookingsSchema.id, input.bookingId))
        .limit(1);
      if (!b || b.hotelId !== hotel.id) throw throwErrorOnValidation("Invalid booking id for this hotel");
    }
    patch.bookingId = input.bookingId;
  }
  if (input.roomEntryId !== undefined) {
    if (input.roomEntryId) {
      const [re] = await db
        .select({ id: roomEntrySchema.id, hotelId: roomschema.hotelId })
        .from(roomEntrySchema)
        .innerJoin(roomschema, eq(roomEntrySchema.roomId, roomschema.id))
        .where(eq(roomEntrySchema.id, input.roomEntryId))
        .limit(1);
      if (!re || re.hotelId !== hotel.id) throw throwErrorOnValidation("Invalid room entry id for this hotel");
    }
    patch.roomEntryId = input.roomEntryId;
  }
  if (input.status !== undefined) {
    patch.status = input.status;
    if (input.status === "completed" || input.status === "cancelled") {
      patch.closedAt = new Date();
    }
  }

  const row = targetTableId !== existing.tableId
    ? await db.transaction(async (tx) => {
        // Claim the destination first; the open-session unique index protects
        // against a concurrent move to the same table.
        const [target] = await tx
          .update(tablesSchema)
          .set({ isAvailable: false, updatedAt: new Date() })
          .where(and(eq(tablesSchema.id, targetTableId), eq(tablesSchema.isAvailable, true)))
          .returning({ id: tablesSchema.id });
        if (!target) throw throwErrorOnValidation("Selected table is no longer available");

        const [updated] = await tx
          .update(schema.guestsSchema)
          .set(patch)
          .where(
            and(
              eq(schema.guestsSchema.id, existing.id),
              eq(schema.guestsSchema.tableId, existing.tableId),
              eq(schema.guestsSchema.status, "open"),
            ),
          )
          .returning(selectQuery);
        if (!updated) throw throwErrorOnValidation("The table session is no longer open");

        await tx
          .update(tablesSchema)
          .set({ isAvailable: true, updatedAt: new Date() })
          .where(eq(tablesSchema.id, existing.tableId));

        return updated;
      })
    : (await db
        .update(schema.guestsSchema)
        .set(patch)
        .where(eq(schema.guestsSchema.id, existing.id))
        .returning(selectQuery))[0];

  const table = await getTableOrFail(targetTableId);
  return Resource.mapWithDetails({ ...row, tableName: table.name });
};

/**
 * Link a table session to a room booking or room entry (room bridge).
 */
const linkRoom = async (
  viewer: Viewer,
  id: number,
  input: { bookingId?: string | null; roomEntryId?: number | null },
) => {
  return update(viewer, id, input);
};

/**
 * Single guest session with table info, room bridge info, and order lines.
 */
const show = async (viewer: Viewer, id: number): Promise<GuestWithDetails> => {
  const user = requireUser(viewer);
  const row = await getGuestOrFail(id);
  const hotel = await getHotelOrFail(row.hotelId);
  requireHotelAccess(user, hotel);

  const table = await getTableOrFail(row.tableId);

  // Fetch orders for this guest
  const orders = await db
    .select({
      id: ordersSchema.id,
      guestId: ordersSchema.guestId,
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
    .where(eq(ordersSchema.guestId, row.id))
    .orderBy(desc(ordersSchema.createdAt));

  const totalOrdersNpr = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + (o.totalNpr || 0), 0);

  let bookingGuestName: string | null = null;
  if (row.bookingId) {
    const [b] = await db
      .select({ guestName: bookingsSchema.guestName })
      .from(bookingsSchema)
      .where(eq(bookingsSchema.id, row.bookingId))
      .limit(1);
    if (b) bookingGuestName = b.guestName;
  }

  let roomName: string | null = null;
  if (row.roomEntryId) {
    const [re] = await db
      .select({ roomName: roomschema.name })
      .from(roomEntrySchema)
      .innerJoin(roomschema, eq(roomEntrySchema.roomId, roomschema.id))
      .where(eq(roomEntrySchema.id, row.roomEntryId))
      .limit(1);
    if (re) roomName = re.roomName;
  }

  return Resource.mapWithDetails({
    ...row,
    tableName: table.name,
    bookingGuestName,
    roomName,
    orders,
    ordersCount: orders.length,
    totalOrdersNpr,
  });
};

/**
 * Order rollups for a session list.
 *
 * The orders screen needs to show a running total and kitchen status per
 * table without fetching every order line. Cancelled lines stay out of the
 * total and the "items" count — they are voided, not billable.
 */
const orderRollups = {
  ordersCount: sql<number>`count(${ordersSchema.id}) filter (where ${ordersSchema.status} <> 'cancelled')::int`,
  totalOrdersNpr: sql<number>`coalesce(sum(${ordersSchema.totalNpr}) filter (where ${ordersSchema.status} <> 'cancelled'), 0)::int`,
  pendingOrdersCount: sql<number>`count(${ordersSchema.id}) filter (where ${ordersSchema.status} = 'pending')::int`,
  preparingOrdersCount: sql<number>`count(${ordersSchema.id}) filter (where ${ordersSchema.status} = 'preparing')::int`,
  servedOrdersCount: sql<number>`count(${ordersSchema.id}) filter (where ${ordersSchema.status} = 'served')::int`,
};

const runList = async (query: ListQuery) => {
  const page = Number(query?.page) || 1;
  const limit = Math.min(Number(query?.limit) || 20, 100);
  const offset = (page - 1) * limit;

  const conditions = [
    query?.hotelId ? eq(schema.guestsSchema.hotelId, query.hotelId) : undefined,
    query?.tableId ? eq(schema.guestsSchema.tableId, query.tableId) : undefined,
    query?.status ? eq(schema.guestsSchema.status, query.status) : undefined,
    query?.search
      ? ilike(schema.guestsSchema.guestName, `%${query.search.trim()}%`)
      : undefined,
  ].filter((c) => c !== undefined);

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select({
      ...selectQuery,
      tableName: tablesSchema.name,
      ...orderRollups,
    })
    .from(schema.guestsSchema)
    .innerJoin(tablesSchema, eq(schema.guestsSchema.tableId, tablesSchema.id))
    .leftJoin(ordersSchema, eq(ordersSchema.guestId, schema.guestsSchema.id))
    .where(where)
    // Grouping by both primary keys is valid in Postgres: every other selected
    // column is functionally dependent on one of them.
    .groupBy(schema.guestsSchema.id, tablesSchema.id)
    .orderBy(desc(schema.guestsSchema.openedAt))
    .limit(limit)
    .offset(offset);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.guestsSchema)
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

const listByTable = async (viewer: Viewer, tableId: string, query: { status?: "open" | "completed" | "cancelled" }) => {
  const user = requireUser(viewer);
  const table = await getTableOrFail(String(tableId));
  const hotel = await getHotelOrFail(table.hotelId);
  requireHotelAccess(user, hotel);

  const items = await db
    .select({
      ...selectQuery,
      tableName: tablesSchema.name,
    })
    .from(schema.guestsSchema)
    .innerJoin(tablesSchema, eq(schema.guestsSchema.tableId, tablesSchema.id))
    .where(
      and(
        eq(schema.guestsSchema.tableId, table.id),
        query?.status ? eq(schema.guestsSchema.status, query.status) : undefined,
      ),
    )
    .orderBy(desc(schema.guestsSchema.openedAt));

  return { items: Resource.collectionWithDetails(items), total: items.length };
};

const getActiveByTable = async (viewer: Viewer, tableId: string) => {
  const user = requireUser(viewer);
  const table = await getTableOrFail(String(tableId));
  const hotel = await getHotelOrFail(table.hotelId);
  requireHotelAccess(user, hotel);

  const [row] = await db
    .select({
      ...selectQuery,
      tableName: tablesSchema.name,
    })
    .from(schema.guestsSchema)
    .innerJoin(tablesSchema, eq(schema.guestsSchema.tableId, tablesSchema.id))
    .where(
      and(
        eq(schema.guestsSchema.tableId, table.id),
        eq(schema.guestsSchema.status, "open"),
      ),
    )
    .limit(1);

  if (!row) return null;
  return show(viewer, row.id);
};

const list = async (viewer: Viewer, query: ListQuery) => {
  requireAdmin(viewer);
  return runList(query);
};

export default {
  create,
  complete,
  cancel,
  update,
  linkRoom,
  show,
  listByHotel,
  listByTable,
  getActiveByTable,
  list,
};
