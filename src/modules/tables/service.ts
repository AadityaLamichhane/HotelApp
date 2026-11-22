import { eq, and, ilike, sql } from "drizzle-orm";
import db from "@/config/db";
import schema from "./schema";
import { hotelsSchema } from "../hotels/schema";
import { selectQuery } from "./repository";
import Resource from "./resource";
import guestsService from "../guests/service";
import { authorizeHotelAccess } from "../staff/access";
import type { StaffPermission } from "../staff/constants";
import {
  throwErrorOnValidation,
  throwForbiddenError,
  throwNotFoundError,
  throwUnauthorizedError,
} from "@/utils/error";

type CreateTableArgs = {
  hotelId: string;
  name: string;
  seats?: number;
  isAvailable?: boolean;
};

type UpdateTableArgs = Partial<Omit<CreateTableArgs, "hotelId">>;
type ListQuery = { page?: number; limit?: number; search?: string; hotelId?: string };
type HotelListQuery = { page?: number; limit?: number; search?: string };
type Viewer = { id?: number; role?: string; hotelId?: string } | undefined | null;

// Shape is validated once at the route layer by Zod; the service only
// checks existence + ownership and fails closed with 404 (see rooms/service.ts).
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
  permission: StaffPermission = "table.view",
) => authorizeHotelAccess(viewer, hotel, permission);

const getTableOrFail = async (id: string) => {
  const [row] = await db
    .select(selectQuery)
    .from(schema.tablesSchema)
    .where(eq(schema.tablesSchema.id, id))
    .limit(1);
  if (!row) throw throwNotFoundError("Table");
  return row;
};

const create = async (input: CreateTableArgs, createdBy: number, viewer: Viewer) => {
  if (!createdBy || isNaN(Number(createdBy))) throw throwErrorOnValidation("Login required");
  const hotel = await getHotelOrFail(String(input.hotelId));
  requireHotelAccess(viewer, hotel, "table.manage");
  const name = input.name.trim();
  if (!name) throw throwErrorOnValidation("Name is required");
  const [row] = await db
    .insert(schema.tablesSchema)
    .values({
      hotelId: hotel.id,
      name,
      seats: Number(input.seats ?? 2),
      isAvailable: input.isAvailable ?? true,
      createdBy: Number(createdBy),
    })
    .returning(selectQuery);
  if (!row) throw throwErrorOnValidation("Failed to create table");
  return Resource.toTableJson(row);
};

// ADMIN PANEL list — all hotels (defense-in-depth role re-check).
const list = async (viewer: Viewer, query: ListQuery) => {
  requireAdmin(viewer);
  const page = Number(query?.page) || 1;
  const limit = Math.min(Number(query?.limit) || 10, 100);
  const offset = (page - 1) * limit;
  const hotelId =
    query?.hotelId !== undefined && String(query.hotelId).trim() !== ""
      ? String(query.hotelId)
      : undefined;

  const conditions = [
    query?.search ? ilike(schema.tablesSchema.name, `%${query.search.trim()}%`) : undefined,
    hotelId !== undefined ? eq(schema.tablesSchema.hotelId, hotelId) : undefined,
  ].filter((c) => c !== undefined);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select(selectQuery)
    .from(schema.tablesSchema)
    .where(where)
    .limit(limit)
    .offset(offset);
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.tablesSchema)
    .where(where);
  const count = countRows[0]?.count ?? 0;
  return { items: Resource.tableCollection(items), page, limit, total: count };
};

// HOTEL-SCOPED list — hotelId forced from the path.
const listByHotel = async (viewer: Viewer, hotelId: string, query: HotelListQuery) => {
  const user = requireUser(viewer);
  const hotel = await getHotelOrFail(String(hotelId));
  requireHotelAccess(user, hotel);
  const page = Number(query?.page) || 1;
  const limit = Math.min(Number(query?.limit) || 10, 100);
  const offset = (page - 1) * limit;

  const conditions = [
    eq(schema.tablesSchema.hotelId, hotel.id),
    query?.search ? ilike(schema.tablesSchema.name, `%${query.search.trim()}%`) : undefined,
  ].filter((c) => c !== undefined);
  const where = and(...conditions);

  const items = await db
    .select(selectQuery)
    .from(schema.tablesSchema)
    .where(where)
    .limit(limit)
    .offset(offset);
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.tablesSchema)
    .where(where);
  const count = countRows[0]?.count ?? 0;
  return { items: Resource.tableCollection(items), page, limit, total: count };
};

const show = async (viewer: Viewer, id: string) => {
  const user = requireUser(viewer);
  const row = await getTableOrFail(String(id));
  const hotel = await getHotelOrFail(row.hotelId);
  requireHotelAccess(user, hotel);
  const activeSession = await guestsService.getActiveByTable(user, row.id);
  return {
    ...Resource.toTableJson(row),
    activeSession,
  };
};

const update = async (viewer: Viewer, id: string, input: UpdateTableArgs) => {
  const existing = await getTableOrFail(String(id));
  const hotel = await getHotelOrFail(existing.hotelId);
  requireHotelAccess(viewer, hotel, "table.manage");
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw throwErrorOnValidation("Name is required");
    patch.name = name;
  }
  if (input.seats !== undefined) patch.seats = Number(input.seats);
  if (input.isAvailable !== undefined) patch.isAvailable = input.isAvailable;
  const [row] = await db
    .update(schema.tablesSchema)
    .set(patch)
    .where(eq(schema.tablesSchema.id, existing.id))
    .returning(selectQuery);
  return Resource.toTableJson(row);
};

const remove = async (viewer: Viewer, id: string) => {
  const existing = await getTableOrFail(String(id));
  const hotel = await getHotelOrFail(existing.hotelId);
  requireHotelAccess(viewer, hotel, "table.manage");
  await db.delete(schema.tablesSchema).where(eq(schema.tablesSchema.id, existing.id));
  return Resource.toTableJson(existing);
};

export default { create, list, listByHotel, show, update, remove };
