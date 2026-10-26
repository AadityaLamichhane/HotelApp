import { and, asc, eq, ilike, sql } from "drizzle-orm";
import db from "@/config/db";
import { hotelsSchema } from "../hotels/schema";
import schema from "./schema";
import { selectMenuItemQuery, selectMenuQuery } from "./repository";
import Resource from "./resource";
import {
  throwErrorOnValidation,
  throwForbiddenError,
  throwNotFoundError,
  throwUnauthorizedError,
} from "@/utils/error";

type CreateMenuArgs = { name?: string; isActive?: boolean };
type UpdateMenuArgs = Partial<CreateMenuArgs>;

type CreateMenuItemArgs = {
  name: string;
  description?: string | null;
  price: number;
  category?: string;
  isVeg?: boolean;
  isAvailable?: boolean;
  imageUrl?: string | null;
  sortOrder?: number;
};
type UpdateMenuItemArgs = Partial<CreateMenuItemArgs>;

type ListMenusQuery = {
  page?: number;
  limit?: number;
  search?: string;
  hotelId?: string;
  isActive?: boolean;
};
type ListMenuItemsQuery = {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  isVeg?: boolean;
  isAvailable?: boolean;
};

type Viewer = { id?: number; role?: string; hotelId?: string } | undefined | null;

// Shape is validated once at the route layer by Zod; the service only checks
// existence + ownership and fails closed with 404 (see rooms/service.ts).
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
    .select({ id: hotelsSchema.id, name: hotelsSchema.name, createdBy: hotelsSchema.createdBy })
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

const getMenuOrFail = async (id: string) => {
  const [row] = await db
    .select(selectMenuQuery)
    .from(schema.menusSchema)
    .where(eq(schema.menusSchema.id, id))
    .limit(1);
  if (!row) throw throwNotFoundError("Menu");
  return row;
};

const getMenuByHotelId = async (hotelId: string) => {
  const [row] = await db
    .select(selectMenuQuery)
    .from(schema.menusSchema)
    .where(eq(schema.menusSchema.hotelId, hotelId))
    .limit(1);
  return row ?? null;
};

const getMenuItemOrFail = async (id: string) => {
  const [row] = await db
    .select(selectMenuItemQuery)
    .from(schema.menuItemsSchema)
    .where(eq(schema.menuItemsSchema.id, id))
    .limit(1);
  if (!row) throw throwNotFoundError("Menu item");
  return row;
};

const loadMenuItems = async (menuId: string) =>
  db
    .select(selectMenuItemQuery)
    .from(schema.menuItemsSchema)
    .where(eq(schema.menuItemsSchema.menuId, menuId))
    .orderBy(asc(schema.menuItemsSchema.sortOrder), asc(schema.menuItemsSchema.name));

// Resolve a menu -> its hotel -> ownership. Throws 403 for another hotel.
const requireMenuAccess = async (viewer: Viewer, menuId: string) => {
  const menu = await getMenuOrFail(String(menuId));
  const hotel = await getHotelOrFail(menu.hotelId);
  requireHotelAccess(viewer, hotel);
  return { menu, hotel };
};

const requireMenuItemAccess = async (viewer: Viewer, itemId: string) => {
  const item = await getMenuItemOrFail(String(itemId));
  const menu = await getMenuOrFail(item.menuId);
  const hotel = await getHotelOrFail(menu.hotelId);
  requireHotelAccess(viewer, hotel);
  return { item, menu, hotel };
};

const isUniqueViolation = (error: unknown): boolean => {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
};

const normalizeName = (value: string | undefined, fallback?: string): string => {
  const name = (value ?? fallback ?? "").trim();
  if (!name) throw throwErrorOnValidation("Name is required");
  return name;
};

// Create the single menu for a hotel. The hotel id comes from the PATH;
// createdBy always comes from the JWT.
const createMenu = async (
  viewer: Viewer,
  hotelId: string,
  input: CreateMenuArgs,
  createdBy: number,
) => {
  if (!createdBy || isNaN(Number(createdBy))) throw throwErrorOnValidation("Login required");
  const hotel = await getHotelOrFail(String(hotelId));
  requireHotelAccess(viewer, hotel);
  const existing = await getMenuByHotelId(hotel.id);
  if (existing) throw throwErrorOnValidation("Menu already exists for this hotel");
  try {
    const [row] = await db
      .insert(schema.menusSchema)
      .values({
        hotelId: hotel.id,
        name: normalizeName(input.name, "Main Menu"),
        isActive: input.isActive ?? true,
        createdBy: Number(createdBy),
      })
      .returning(selectMenuQuery);
    if (!row) throw throwErrorOnValidation("Failed to create menu");
    return Resource.toMenuJson(row);
  } catch (error) {
    // Two concurrent creates can both pass the pre-check; the unique index
    // (menus_one_per_hotel) is the real guarantee.
    if (isUniqueViolation(error))
      throw throwErrorOnValidation("Menu already exists for this hotel");
    throw error;
  }
};

// ADMIN PANEL list — all hotels (defense-in-depth role re-check).
const listMenus = async (viewer: Viewer, query: ListMenusQuery) => {
  requireAdmin(viewer);
  const page = Number(query?.page) || 1;
  const limit = Math.min(Number(query?.limit) || 10, 100);
  const offset = (page - 1) * limit;
  const hotelId =
    query?.hotelId !== undefined && String(query.hotelId).trim() !== ""
      ? String(query.hotelId)
      : undefined;

  const conditions = [
    query?.search ? ilike(schema.menusSchema.name, `%${query.search.trim()}%`) : undefined,
    hotelId !== undefined ? eq(schema.menusSchema.hotelId, hotelId) : undefined,
    query?.isActive !== undefined ? eq(schema.menusSchema.isActive, query.isActive) : undefined,
  ].filter((c) => c !== undefined);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({ ...selectMenuQuery, hotelName: hotelsSchema.name })
    .from(schema.menusSchema)
    .leftJoin(hotelsSchema, eq(schema.menusSchema.hotelId, hotelsSchema.id))
    .where(where)
    .orderBy(asc(schema.menusSchema.name))
    .limit(limit)
    .offset(offset);
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.menusSchema)
    .where(where);
  const count = countRows[0]?.count ?? 0;
  return { items: Resource.menuCollection(rows), page, limit, total: count };
};

// HOTEL USER — the menu (and its items) for the hotel in the PATH.
// Returns { menu: null, items: [] } when the hotel has no menu yet.
const getHotelMenu = async (viewer: Viewer, hotelId: string) => {
  const hotel = await getHotelOrFail(String(hotelId));
  requireHotelAccess(viewer, hotel);
  const menu = await getMenuByHotelId(hotel.id);
  const items = menu ? await loadMenuItems(menu.id) : [];
  return Resource.toMenuWithItemsJson(menu, items);
};

const showMenu = async (viewer: Viewer, id: string) => {
  const { menu } = await requireMenuAccess(viewer, id);
  const items = await loadMenuItems(menu.id);
  return Resource.toMenuWithItemsJson(menu, items);
};

const updateMenu = async (viewer: Viewer, id: string, input: UpdateMenuArgs) => {
  const { menu } = await requireMenuAccess(viewer, id);
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = normalizeName(input.name);
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  patch.updatedAt = new Date();
  const [row] = await db
    .update(schema.menusSchema)
    .set(patch)
    .where(eq(schema.menusSchema.id, menu.id))
    .returning(selectMenuQuery);
  return Resource.toMenuJson(row);
};

const removeMenu = async (viewer: Viewer, id: string) => {
  const { menu } = await requireMenuAccess(viewer, id);
  // menu_items.menu_id has ON DELETE CASCADE, so items go with it.
  await db.delete(schema.menusSchema).where(eq(schema.menusSchema.id, menu.id));
  return Resource.toMenuJson(menu);
};

const listMenuItems = async (viewer: Viewer, menuId: string, query: ListMenuItemsQuery) => {
  const { menu } = await requireMenuAccess(viewer, menuId);
  const page = Number(query?.page) || 1;
  const limit = Math.min(Number(query?.limit) || 10, 100);
  const offset = (page - 1) * limit;

  const conditions = [
    eq(schema.menuItemsSchema.menuId, menu.id),
    query?.search ? ilike(schema.menuItemsSchema.name, `%${query.search.trim()}%`) : undefined,
    query?.category ? eq(schema.menuItemsSchema.category, query.category) : undefined,
    query?.isVeg !== undefined ? eq(schema.menuItemsSchema.isVeg, query.isVeg) : undefined,
    query?.isAvailable !== undefined
      ? eq(schema.menuItemsSchema.isAvailable, query.isAvailable)
      : undefined,
  ].filter((c) => c !== undefined);
  const where = and(...conditions);

  const rows = await db
    .select(selectMenuItemQuery)
    .from(schema.menuItemsSchema)
    .where(where)
    .orderBy(asc(schema.menuItemsSchema.sortOrder), asc(schema.menuItemsSchema.name))
    .limit(limit)
    .offset(offset);
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.menuItemsSchema)
    .where(where);
  const count = countRows[0]?.count ?? 0;
  return { items: Resource.menuItemCollection(rows), page, limit, total: count };
};

// menuId comes from the PATH, so a caller can't add items to another
// hotel's menu by passing a different id in the body.
const createMenuItem = async (viewer: Viewer, menuId: string, input: CreateMenuItemArgs) => {
  const { menu } = await requireMenuAccess(viewer, menuId);
  const [row] = await db
    .insert(schema.menuItemsSchema)
    .values({
      menuId: menu.id,
      name: normalizeName(input.name),
      description: input.description ?? null,
      price: Number(input.price),
      category: (input.category ?? "Uncategorized").trim() || "Uncategorized",
      isVeg: input.isVeg ?? true,
      isAvailable: input.isAvailable ?? true,
      imageUrl: input.imageUrl ?? null,
      sortOrder: Number(input.sortOrder ?? 0),
    })
    .returning(selectMenuItemQuery);
  if (!row) throw throwErrorOnValidation("Failed to create menu item");
  return Resource.toMenuItemJson(row);
};

const showMenuItem = async (viewer: Viewer, id: string) => {
  const { item } = await requireMenuItemAccess(viewer, id);
  return Resource.toMenuItemJson(item);
};

const updateMenuItem = async (viewer: Viewer, id: string, input: UpdateMenuItemArgs) => {
  const { item } = await requireMenuItemAccess(viewer, id);
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = normalizeName(input.name);
  if (input.description !== undefined) patch.description = input.description ?? null;
  if (input.price !== undefined) patch.price = Number(input.price);
  if (input.category !== undefined) {
    const category = input.category.trim();
    if (!category) throw throwErrorOnValidation("Category is required");
    patch.category = category;
  }
  if (input.isVeg !== undefined) patch.isVeg = input.isVeg;
  if (input.isAvailable !== undefined) patch.isAvailable = input.isAvailable;
  if (input.imageUrl !== undefined) patch.imageUrl = input.imageUrl ?? null;
  if (input.sortOrder !== undefined) patch.sortOrder = Number(input.sortOrder);
  patch.updatedAt = new Date();
  const [row] = await db
    .update(schema.menuItemsSchema)
    .set(patch)
    .where(eq(schema.menuItemsSchema.id, item.id))
    .returning(selectMenuItemQuery);
  return Resource.toMenuItemJson(row);
};

const removeMenuItem = async (viewer: Viewer, id: string) => {
  const { item } = await requireMenuItemAccess(viewer, id);
  await db.delete(schema.menuItemsSchema).where(eq(schema.menuItemsSchema.id, item.id));
  return Resource.toMenuItemJson(item);
};

export default {
  createMenu,
  listMenus,
  getHotelMenu,
  showMenu,
  updateMenu,
  removeMenu,
  listMenuItems,
  createMenuItem,
  showMenuItem,
  updateMenuItem,
  removeMenuItem,
};
