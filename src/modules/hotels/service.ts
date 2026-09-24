import { eq, and, ilike, sql } from "drizzle-orm";
import db from "@/config/db";
import schema from "./schema";
import { hotelSelect } from "./repository";
import Resource from "./resource";
import {
  throwErrorOnValidation,
  throwForbiddenError,
  throwNotFoundError,
  throwUnauthorizedError,
} from "@/utils/error";

type PaginationQuery = { page?: number; limit?: number; search?: string };
// Decoded JWT shape (see admin + users services).
type Viewer = { id?: number; role?: string } | undefined | null;

// NOTE: no UUID-shape regex here on purpose — same reasoning as
// rooms/service.ts: Zod validators own the shape, the service owns
// existence + ownership and fails closed with 404 on anything else.

// NOTE: error helpers are always invoked as `throw <helper>(...)` (never
// bare) so the compiler narrows guards under the repo's strict TS config
// (see note in rooms/service.ts).
const requireUser = (viewer: Viewer): NonNullable<Viewer> => {
  if (!viewer?.id) throw throwUnauthorizedError("Login required");
  return viewer;
};

const slugify = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 255) || "hotel";

const uniqueSlug = async (base: string): Promise<string> => {
  let slug = base;
  let suffix = 0;
  for (;;) {
    const [hit] = await db
      .select({ id: schema.hotelsSchema.id })
      .from(schema.hotelsSchema)
      .where(eq(schema.hotelsSchema.slug, slug))
      .limit(1);
    if (!hit) return slug;
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
};

// Ownership model (no membership table yet): a hotel belongs to the user
// who created it (hotels.created_by). Admins bypass. Non-admin callers can
// only list/show/update/delete hotels they own, so one hotel can't read or
// mutate another hotel via :id. Shape is validated by Zod validators (uuid);
// the service checks existence + ownership as the trust boundary.
const getHotelOrFail = async (id: string) => {
  // No UUID check: Zod already rejected malformed ids; anything else 404s.
  const [row] = await db
    .select(hotelSelect)
    .from(schema.hotelsSchema)
    .where(eq(schema.hotelsSchema.id, id))
    .limit(1);
  if (!row) throw throwNotFoundError("Hotel");
  return row;
};

const requireHotelAccess = (viewer: Viewer, hotel: { createdBy: number | null }) => {
  const user = requireUser(viewer);
  if (user.role === "admin") return;
  if (Number(user.id) !== Number(hotel.createdBy))
    throw throwForbiddenError("Access denied for this hotel");
};

const create = async (input: { name: string }, createdBy: number) => {
  if (!createdBy || isNaN(Number(createdBy))) throw throwErrorOnValidation("Login required");
  const name = input.name.trim();
  if (!name) throw throwErrorOnValidation("Name is required");
  const slug = await uniqueSlug(slugify(name));
  const [row] = await db
    .insert(schema.hotelsSchema)
    .values({ name, slug, createdBy: Number(createdBy) })
    .returning(hotelSelect);
  if (!row) throw throwErrorOnValidation("Failed to create hotel");
  return Resource.toHotelJson(row);
};

const list = async (viewer: Viewer, query: PaginationQuery) => {
  const user = requireUser(viewer);
  const page = Number(query?.page) || 1;
  const limit = Math.min(Number(query?.limit) || 10, 100);
  const offset = (page - 1) * limit;
  const conditions = [
    query?.search ? ilike(schema.hotelsSchema.name, `%${query.search.trim()}%`) : undefined,
    // Non-admins see only hotels they created; admins see all.
    user.role === "admin" ? undefined : eq(schema.hotelsSchema.createdBy, Number(user.id)),
  ].filter((c) => c !== undefined);
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const items = await db
    .select(hotelSelect)
    .from(schema.hotelsSchema)
    .where(where)
    .limit(limit)
    .offset(offset);
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.hotelsSchema)
    .where(where);
  const count = countRows[0]?.count ?? 0;
  return { items: Resource.hotelCollection(items), page, limit, total: count };
};

const show = async (viewer: Viewer, id: string) => {
  const user = requireUser(viewer);
  const row = await getHotelOrFail(String(id));
  requireHotelAccess(user, row);
  return Resource.toHotelJson(row);
};

const update = async (viewer: Viewer, id: string, input: { name?: string; isActive?: boolean }) => {
  const user = requireUser(viewer);
  const existing = await getHotelOrFail(String(id));
  requireHotelAccess(user, existing);
  const patch: { name?: string; isActive?: boolean } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw throwErrorOnValidation("Name is required");
    patch.name = name;
  }
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  const [row] = await db
    .update(schema.hotelsSchema)
    .set(patch)
    .where(eq(schema.hotelsSchema.id, existing.id))
    .returning(hotelSelect);
  return Resource.toHotelJson(row);
};

const remove = async (viewer: Viewer, id: string) => {
  const user = requireUser(viewer);
  const existing = await getHotelOrFail(String(id));
  requireHotelAccess(user, existing);
  await db.delete(schema.hotelsSchema).where(eq(schema.hotelsSchema.id, existing.id));
  return Resource.toHotelJson(existing);
};

export default { create, list, show, update, remove };
