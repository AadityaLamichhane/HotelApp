import { eq, and, ilike, sql } from "drizzle-orm";
import db from "@/config/db";
import schema from "./schema";
import { hotelsSchema } from "../hotels/schema";
import { roomschema } from "../rooms/schema";
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

type CreateLogisticsArgs = {
  hotelId: string;
  name: string;
  quantity: number;
  roomId?: string | null;
};

type UpdateLogisticsArgs = Partial<Omit<CreateLogisticsArgs, "hotelId">>;
type ListQuery = { page?: number; limit?: number; search?: string; hotelId?: string; roomId?: string };
type HotelListQuery = { page?: number; limit?: number; search?: string; roomId?: string };
// Decoded JWT shape (see admin + users services).
type Viewer = { id?: number; role?: string } | undefined | null;

// Shape is validated once at the route layer by Zod (validators.ts).
// Services check existence (404) + ownership (403) and fail closed.

const requireAdmin = (viewer: Viewer) => {
  if (!viewer?.id) throw throwUnauthorizedError("Login required");
  if (viewer.role !== "admin") throw throwForbiddenError("Admin access required");
};

// Ownership model: hotel belongs to its creator (hotels.created_by), admins
// bypass, and active staff are granted access by their explicit permissions.
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
  permission: StaffPermission,
) => authorizeHotelAccess(viewer, hotel, permission);

// roomId is nullable (general stock). When present it MUST be a room of the
// SAME hotel — otherwise Hotel A could tag its towels onto Hotel B's room.
const resolveRoomId = async (hotelId: string, roomId: string | null | undefined) => {
  if (roomId === undefined || roomId === null) return null;
  const [room] = await db
    .select({ id: roomschema.id, hotelId: roomschema.hotelId })
    .from(roomschema)
    .where(eq(roomschema.id, roomId))
    .limit(1);
  if (!room) throw throwNotFoundError("Room");
  if (room.hotelId !== hotelId)
    throw throwErrorOnValidation("Room does not belong to this hotel");
  return room.id;
};

// LEFT JOIN rooms so lists carry roomName for the UI badge in one query.
// Selecting individual columns (not the table object) yields FLAT rows:
// { id, hotelId, ..., roomName: string | null }.
const selectWithRoomName = { ...selectQuery, roomName: roomschema.name };

const baseQuery = () =>
  db
    .select(selectWithRoomName)
    .from(schema.logisticsSchema)
    .leftJoin(roomschema, eq(schema.logisticsSchema.roomId, roomschema.id));

const getItemOrFail = async (id: string) => {
  const [row] = await baseQuery().where(eq(schema.logisticsSchema.id, id)).limit(1);
  if (!row) throw throwNotFoundError("Logistics item");
  return row;
};

const create = async (input: CreateLogisticsArgs, createdBy: number, viewer: Viewer) => {
  if (!createdBy || isNaN(Number(createdBy))) throw throwErrorOnValidation("Login required");
  const hotel = await getHotelOrFail(String(input.hotelId));
  requireHotelAccess(viewer, hotel, "logistics.manage");
  const roomId = await resolveRoomId(hotel.id, input.roomId);
  const [inserted] = await db
    .insert(schema.logisticsSchema)
    .values({
      hotelId: hotel.id,
      name: input.name.trim(),
      quantity: Number(input.quantity),
      roomId,
      createdBy: Number(createdBy),
    })
    .returning({ id: schema.logisticsSchema.id });
  if (!inserted) throw throwErrorOnValidation("Failed to create logistics item");
  return Resource.toLogisticsJson(await getItemOrFail(inserted.id));
};

// ADMIN PANEL list — all hotels. Route gate is authCheckType: ["admin"];
// this second check is defense-in-depth (backend AGENTS.md rule 3).
const list = async (viewer: Viewer, query: ListQuery) => {
  requireAdmin(viewer);
  const page = Number(query?.page) || 1;
  const limit = Math.min(Number(query?.limit) || 10, 100);
  const offset = (page - 1) * limit;

  const conditions = [
    query?.search ? ilike(schema.logisticsSchema.name, `%${query.search.trim()}%`) : undefined,
    query?.hotelId ? eq(schema.logisticsSchema.hotelId, String(query.hotelId)) : undefined,
    query?.roomId ? eq(schema.logisticsSchema.roomId, String(query.roomId)) : undefined,
  ].filter((c) => c !== undefined);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await baseQuery().where(where).limit(limit).offset(offset);
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.logisticsSchema)
    .where(where);
  const count = countRows[0]?.count ?? 0;
  return { items: Resource.logisticsCollection(items), page, limit, total: count };
};

// HOTEL-SCOPED list — hotelId forced from the path; ownership enforced.
const listByHotel = async (viewer: Viewer, hotelId: string, query: HotelListQuery) => {
  const hotel = await getHotelOrFail(String(hotelId));
  requireHotelAccess(viewer, hotel, "logistics.view");
  const page = Number(query?.page) || 1;
  const limit = Math.min(Number(query?.limit) || 10, 100);
  const offset = (page - 1) * limit;

  const conditions = [
    eq(schema.logisticsSchema.hotelId, hotel.id),
    query?.search ? ilike(schema.logisticsSchema.name, `%${query.search.trim()}%`) : undefined,
    query?.roomId ? eq(schema.logisticsSchema.roomId, String(query.roomId)) : undefined,
  ].filter((c) => c !== undefined);
  const where = and(...conditions);

  const items = await baseQuery().where(where).limit(limit).offset(offset);
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.logisticsSchema)
    .where(where);
  const count = countRows[0]?.count ?? 0;
  return { items: Resource.logisticsCollection(items), page, limit, total: count };
};

const show = async (viewer: Viewer, id: string) => {
  const row = await getItemOrFail(String(id));
  const hotel = await getHotelOrFail(String(row.hotelId));
  requireHotelAccess(viewer, hotel, "logistics.view");
  return Resource.toLogisticsJson(row);
};

const update = async (viewer: Viewer, id: string, input: UpdateLogisticsArgs) => {
  const existing = await getItemOrFail(String(id));
  const hotel = await getHotelOrFail(String(existing.hotelId));
  requireHotelAccess(viewer, hotel, "logistics.manage");
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw throwErrorOnValidation("Name is required");
    patch.name = name;
  }
  if (input.quantity !== undefined) patch.quantity = Number(input.quantity);
  // Explicit null clears the assignment; undefined leaves it untouched.
  if (input.roomId !== undefined) patch.roomId = await resolveRoomId(hotel.id, input.roomId);
  await db
    .update(schema.logisticsSchema)
    .set(patch)
    .where(eq(schema.logisticsSchema.id, existing.id));
  return Resource.toLogisticsJson(await getItemOrFail(String(existing.id)));
};

const remove = async (viewer: Viewer, id: string) => {
  const existing = await getItemOrFail(String(id));
  const hotel = await getHotelOrFail(String(existing.hotelId));
  requireHotelAccess(viewer, hotel, "logistics.manage");
  await db.delete(schema.logisticsSchema).where(eq(schema.logisticsSchema.id, existing.id));
  return Resource.toLogisticsJson(existing);
};

export default { create, list, listByHotel, show, update, remove };
