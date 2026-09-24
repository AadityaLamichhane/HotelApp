import { eq, and, ilike, sql } from "drizzle-orm";
import db from "@/config/db";
import schema from "./schema";
import { hotelsSchema } from "../hotels/schema";
import { selectQuery } from "./repository";
import Resource from "./resource";
import {
  throwErrorOnValidation,
  throwForbiddenError,
  throwNotFoundError,
  throwUnauthorizedError,
} from "@/utils/error";

type CreateRoomArgs = {
  hotelId: string;
  name: string;
  description?: string | null;
  price: number;
  isAvailable?: boolean;
};

type UpdateRoomArgs = Partial<Omit<CreateRoomArgs, "hotelId">>;
type ListQuery = { page?: number; limit?: number; search?: string; hotelId?: string };
type HotelListQuery = { page?: number; limit?: number; search?: string };
// Decoded JWT shape (see admin + users services). Admin tokens carry
// role "admin"; user tokens carry role "user".
type Viewer = { id?: number; role?: string; hotelId?: string } | undefined | null;

// NOTE: no UUID-shape regex here on purpose. Shape is validated once at the
// route layer by Zod (validators.ts: hotelId/roomId are z.string().uuid()).
// The service only checks existence + ownership: garbage input simply matches
// no rows and fails closed with 404, so a second regex would just duplicate
// the validator with no security benefit.

// NOTE: error helpers are always invoked as `throw <helper>(...)` (never
// bare). The helpers return `never`, and only the explicit `throw` form lets
// the compiler narrow guards (e.g. `hotel` non-undefined after the 404
// check) under the repo's strict TS config.
const requireAdmin = (viewer: Viewer) => {
  if (!viewer?.id) throw throwUnauthorizedError("Login required");
  if (viewer.role !== "admin") throw throwForbiddenError("Admin access required");
};

const requireUser = (viewer: Viewer): NonNullable<Viewer> => {
  if (!viewer?.id) throw throwUnauthorizedError("Login required");
  return viewer;
};

// Ownership model (no membership table yet): a hotel belongs to the user
// who created it (hotels.created_by). Admins bypass. Every room read/write
// resolves its hotel and enforces this, so Hotel A can never touch Hotel B
// by guessing a room UUID or passing another hotelId.
const getHotelOrFail = async (hotelId: string) => {
  // No UUID check: Zod already rejected malformed ids; anything else 404s.
  const [hotel] = await db
    .select({ id: hotelsSchema.id, createdBy: hotelsSchema.createdBy })
    .from(hotelsSchema)
    .where(eq(hotelsSchema.id, hotelId))
    .limit(1);
  if (!hotel) throw throwNotFoundError("Hotel");
  return hotel;
};

const requireHotelAccess = (viewer: Viewer, hotel: { createdBy: number | null }) => {
  const user = requireUser(viewer);
  if (user.role === "admin") return;
  if (Number(user.id) !== Number(hotel.createdBy))
    throw throwForbiddenError("Access denied for this hotel");
};

const getRoomOrFail = async (id: string) => {
  // No UUID check: Zod already rejected malformed ids; anything else 404s.
  const [row] = await db
    .select(selectQuery)
    .from(schema.roomschema)
    .where(eq(schema.roomschema.id, id))
    .limit(1);
  if (!row) throw throwNotFoundError("Room");
  return row;
};

const create = async (input: CreateRoomArgs, createdBy: number, viewer: Viewer) => {
  if (!createdBy || isNaN(Number(createdBy))) throw throwErrorOnValidation("Login required");
  const hotel = await getHotelOrFail(String(input.hotelId));
  // Non-admins may create only into hotels they own.
  requireHotelAccess(viewer, hotel);
  const [row] = await db
    .insert(schema.roomschema)
    .values({
      hotelId: hotel.id,
      name: input.name.trim(),
      description: input.description ?? null,
      price: Number(input.price),
      isAvailable: input.isAvailable ?? true,
      createdBy: Number(createdBy),
    })
    .returning(selectQuery);
  if (!row) throw throwErrorOnValidation("Failed to create room");
  return Resource.toRoomJson(row);
};

// ADMIN PANEL list — all hotels. Route gate is
// `authCheckType: ["admin"]`; this second check is defense-in-depth so a
// future route misconfiguration can't leak cross-hotel data.
const list = async (viewer: Viewer, query: ListQuery) => {
  requireAdmin(viewer);
  const page = Number(query?.page) || 1;
  const limit = Math.min(Number(query?.limit) || 10, 100);
  const offset = (page - 1) * limit;
  const hotelId =
    query?.hotelId !== undefined && String(query.hotelId).trim() !== ""
      ? String(query.hotelId)
      : undefined;
  // No UUID check here: listRoomsValidationSchema already enforces uuid.

  const conditions = [
    query?.search ? ilike(schema.roomschema.name, `%${query.search.trim()}%`) : undefined,
    hotelId !== undefined ? eq(schema.roomschema.hotelId, hotelId) : undefined,
  ].filter((c) => c !== undefined);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select(selectQuery)
    .from(schema.roomschema)
    .where(where)
    .limit(limit)
    .offset(offset);
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.roomschema)
    .where(where);
  const count = countRows[0]?.count ?? 0;
  return { items: Resource.roomCollection(items), page, limit, total: count };
};

// HOTEL-SCOPED list — callers see ONLY hotels they own (admins: any).
// hotelId is forced from the path; the optional ?hotelId= query filter is
// ignored here so callers can't widen the scope.
const listByHotel = async (viewer: Viewer, hotelId: string, query: HotelListQuery) => {
  const user = requireUser(viewer);
  const hotel = await getHotelOrFail(String(hotelId));
  requireHotelAccess(user, hotel);
  const page = Number(query?.page) || 1;
  const limit = Math.min(Number(query?.limit) || 10, 100);
  const offset = (page - 1) * limit;

  const conditions = [
    eq(schema.roomschema.hotelId, hotel.id),
    query?.search ? ilike(schema.roomschema.name, `%${query.search.trim()}%`) : undefined,
  ].filter((c) => c !== undefined);
  const where = and(...conditions);

  const items = await db
    .select(selectQuery)
    .from(schema.roomschema)
    .where(where)
    .limit(limit)
    .offset(offset);
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.roomschema)
    .where(where);
  const count = countRows[0]?.count ?? 0;
  return { items: Resource.roomCollection(items), page, limit, total: count };
};

// Single-room reads resolve the room's hotel and enforce ownership, so
// hitting another hotel's room UUID returns 403 (never leaks it).
const show = async (viewer: Viewer, id: string) => {
  const user = requireUser(viewer);
  const row = await getRoomOrFail(String(id));
  const hotel = await getHotelOrFail(row.hotelId);
  requireHotelAccess(user, hotel);
  return Resource.toRoomJson(row);
};

const update = async (viewer: Viewer, id: string, input: UpdateRoomArgs) => {
  const user = requireUser(viewer);
  const existing = await getRoomOrFail(String(id));
  const hotel = await getHotelOrFail(existing.hotelId);
  requireHotelAccess(user, hotel);
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw throwErrorOnValidation("Name is required");
    patch.name = name;
  }
  if (input.description !== undefined) patch.description = input.description ?? null;
  if (input.price !== undefined) patch.price = Number(input.price);
  if (input.isAvailable !== undefined) patch.isAvailable = input.isAvailable;
  const [row] = await db
    .update(schema.roomschema)
    .set(patch)
    .where(eq(schema.roomschema.id, existing.id))
    .returning(selectQuery);
  return Resource.toRoomJson(row);
};

const remove = async (viewer: Viewer, id: string) => {
  const user = requireUser(viewer);
  const existing = await getRoomOrFail(String(id));
  const hotel = await getHotelOrFail(existing.hotelId);
  requireHotelAccess(user, hotel);
  await db.delete(schema.roomschema).where(eq(schema.roomschema.id, existing.id));
  return Resource.toRoomJson(existing);
};

export default { create, list, listByHotel, show, update, remove };
