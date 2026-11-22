import { and, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import db from "@/config/db";
import { hotelsSchema } from "../hotels/schema";
import { usersSchema } from "../users/schema";
import { hashPassword } from "@/utils/hashPassword";
import {
  throwConflictError,
  throwErrorOnValidation,
  throwForbiddenError,
  throwNotFoundError,
  throwUnauthorizedError,
} from "@/utils/error";
import { staffWithUserSelect } from "./repository";
import { hotelStaffSchema, permissionsSchema, staffPermissionsSchema } from "./schema";
import { ensurePermissionCatalog } from "./catalog";
import Resource from "./resource";
import {
  ALL_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  STAFF_ROLES,
  type StaffPermission,
  type StaffRole,
} from "./constants";
import {
  authorizeHotelAccess,
  resolveHotelAccess,
  type Viewer,
} from "./access";

type ListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  hotelId?: string;
  userId?: number;
  role?: StaffRole;
  permission?: StaffPermission;
  isActive?: boolean;
};

type HotelListQuery = Omit<ListQuery, "hotelId">;

type CreateStaffInput = {
  userId?: number;
  email?: string;
  name?: string;
  password?: string;
  role?: StaffRole;
  permissions?: StaffPermission[];
};

type UpdateStaffInput = {
  role?: StaffRole;
  isActive?: boolean;
  permissions?: StaffPermission[];
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const uniquePermissions = (list: readonly StaffPermission[]): StaffPermission[] => [
  ...new Set(list),
];

/**
 * Map permission keys -> catalog ids. The catalog is seeded first so a fresh
 * database (or a newly added key) can never produce a dangling grant.
 */
const permissionIdsFor = async (
  keys: readonly StaffPermission[],
): Promise<number[]> => {
  if (keys.length === 0) return [];
  await ensurePermissionCatalog();

  const rows = await db
    .select({ id: permissionsSchema.id, key: permissionsSchema.key })
    .from(permissionsSchema)
    .where(inArray(permissionsSchema.key, [...keys]));
  const byKey = new Map(rows.map((row) => [row.key, row.id]));

  const missing = keys.filter((key) => !byKey.has(key));
  if (missing.length > 0) {
    throw throwErrorOnValidation(`Unknown permissions: ${missing.join(", ")}`);
  }

  return keys
    .map((key) => byKey.get(key))
    .filter((id): id is number => id !== undefined);
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

const baseQuery = () =>
  db
    .select(staffWithUserSelect)
    .from(hotelStaffSchema)
    .innerJoin(usersSchema, eq(hotelStaffSchema.userId, usersSchema.id))
    .innerJoin(hotelsSchema, eq(hotelStaffSchema.hotelId, hotelsSchema.id));

const countQuery = () =>
  db
    .select({ count: sql<number>`count(*)::int` })
    .from(hotelStaffSchema)
    .innerJoin(usersSchema, eq(hotelStaffSchema.userId, usersSchema.id))
    .innerJoin(hotelsSchema, eq(hotelStaffSchema.hotelId, hotelsSchema.id));

const getStaffOrFail = async (id: string) => {
  const [row] = await baseQuery().where(eq(hotelStaffSchema.id, id)).limit(1);
  if (!row) throw throwNotFoundError("Staff member");
  return row;
};

const attachPermissions = async (
  rows: Awaited<ReturnType<typeof baseQuery>>,
) => {
  if (rows.length === 0) return [];
  const grants = await db
    .select({
      staffId: staffPermissionsSchema.staffId,
      key: permissionsSchema.key,
    })
    .from(staffPermissionsSchema)
    .innerJoin(permissionsSchema, eq(staffPermissionsSchema.permissionId, permissionsSchema.id))
    .where(inArray(staffPermissionsSchema.staffId, rows.map((row) => row.id)));

  const byStaff = new Map<string, StaffPermission[]>();
  for (const grant of grants) {
    const list = byStaff.get(grant.staffId) ?? [];
    list.push(grant.key as StaffPermission);
    byStaff.set(grant.staffId, list);
  }
  return Resource.staffCollection(rows, byStaff);
};

const hydrateOne = async (id: string) => {
  const row = await getStaffOrFail(id);
  const [json] = await attachPermissions([row]);
  return json ?? Resource.toStaffJson(row, []);
};

const buildWhere = (query: ListQuery, forcedHotelId?: string) => {
  const permission = query.permission;
  const conditions = [
    forcedHotelId ? eq(hotelStaffSchema.hotelId, forcedHotelId) : undefined,
    query.hotelId ? eq(hotelStaffSchema.hotelId, String(query.hotelId)) : undefined,
    query.userId ? eq(hotelStaffSchema.userId, Number(query.userId)) : undefined,
    query.role ? eq(hotelStaffSchema.role, query.role) : undefined,
    query.isActive !== undefined ? eq(hotelStaffSchema.isActive, query.isActive) : undefined,
    query.search
      ? or(
          ilike(usersSchema.email, `%${query.search.trim()}%`),
          ilike(usersSchema.name, `%${query.search.trim()}%`),
          ilike(hotelsSchema.name, `%${query.search.trim()}%`),
        )
      : undefined,
    // Correlated EXISTS keeps one row per staff member even if they hold
    // several permissions (a JOIN would duplicate).
    permission
      ? exists(
          db
            .select({ one: sql`1` })
            .from(staffPermissionsSchema)
            .innerJoin(
              permissionsSchema,
              eq(staffPermissionsSchema.permissionId, permissionsSchema.id),
            )
            .where(
              and(
                eq(staffPermissionsSchema.staffId, hotelStaffSchema.id),
                eq(permissionsSchema.key, permission),
              ),
            ),
        )
      : undefined,
  ].filter((condition) => condition !== undefined);

  return conditions.length > 0 ? and(...conditions) : undefined;
};

const paginate = async (query: ListQuery, forcedHotelId?: string) => {
  const page = Number(query?.page) || 1;
  const limit = Math.min(Number(query?.limit) || 10, 100);
  const offset = (page - 1) * limit;
  const where = buildWhere(query, forcedHotelId);

  const rows = await baseQuery().where(where).limit(limit).offset(offset);
  const countRows = await countQuery().where(where);
  const count = countRows[0]?.count ?? 0;
  const items = await attachPermissions(rows);

  return { items, page, limit, total: count };
};

const resolveStaffUser = async (input: CreateStaffInput) => {
  if (input.userId !== undefined) {
    const [user] = await db
      .select({
        id: usersSchema.id,
        email: usersSchema.email,
        name: usersSchema.name,
        avatarUrl: usersSchema.avatarUrl,
      })
      .from(usersSchema)
      .where(eq(usersSchema.id, Number(input.userId)))
      .limit(1);
    if (!user) throw throwNotFoundError("User");
    return user;
  }

  const email = normalizeEmail(input.email ?? "");
  if (!email) throw throwErrorOnValidation("Email is required");

  const [existing] = await db
    .select({
      id: usersSchema.id,
      email: usersSchema.email,
      name: usersSchema.name,
      avatarUrl: usersSchema.avatarUrl,
    })
    .from(usersSchema)
    .where(eq(usersSchema.email, email))
    .limit(1);
  if (existing) return existing;

  // Onboarding: no account yet, so the owner supplies name + password and
  // we create the user in the same call. Without a password we refuse
  // rather than silently creating a password-less (OAuth-only) account.
  if (!input.password) {
    throw throwErrorOnValidation(
      "No account uses this email. Provide a name and password to create one.",
    );
  }

  const passwordHash = await hashPassword(input.password);
  const [created] = await db
    .insert(usersSchema)
    .values({ email, passwordHash, name: input.name?.trim() || null })
    .onConflictDoNothing()
    .returning({
      id: usersSchema.id,
      email: usersSchema.email,
      name: usersSchema.name,
      avatarUrl: usersSchema.avatarUrl,
    });
  if (created) return created;

  // Lost an email race: use the row the other request created.
  const [raced] = await db
    .select({
      id: usersSchema.id,
      email: usersSchema.email,
      name: usersSchema.name,
      avatarUrl: usersSchema.avatarUrl,
    })
    .from(usersSchema)
    .where(eq(usersSchema.email, email))
    .limit(1);
  if (!raced) throw throwErrorOnValidation("Failed to create user");
  return raced;
};

const catalog = async () => {
  await ensurePermissionCatalog();
  const permissions = await db
    .select({
      id: permissionsSchema.id,
      key: permissionsSchema.key,
      module: permissionsSchema.module,
      action: permissionsSchema.action,
      description: permissionsSchema.description,
    })
    .from(permissionsSchema)
    .orderBy(permissionsSchema.id);

  return {
    roles: STAFF_ROLES,
    permissions,
    roleDefaults: ROLE_DEFAULT_PERMISSIONS,
  };
};

// ADMIN PANEL — all hotels. Route gate is authCheckType: ["admin"];
// this second check is defense-in-depth (AGENTS rule 3).
const list = async (viewer: Viewer, query: ListQuery) => {
  if (!viewer?.id) throw throwUnauthorizedError("Login required");
  if (viewer.role !== "admin") throw throwForbiddenError("Admin access required");
  return paginate(query);
};

// HOTEL-SCOPED list: hotel id forced from the path, ownership/membership
// enforced through staff.view.
const listByHotel = async (viewer: Viewer, hotelId: string, query: HotelListQuery) => {
  const hotel = await getHotelOrFail(hotelId);
  authorizeHotelAccess(viewer, hotel, "staff.view");
  return paginate(query, hotel.id);
};

const show = async (viewer: Viewer, id: string) => {
  const row = await getStaffOrFail(id);
  const hotel = await getHotelOrFail(row.hotelId);
  authorizeHotelAccess(viewer, hotel, "staff.view");
  return hydrateOne(row.id);
};

const create = async (viewer: Viewer, hotelId: string, input: CreateStaffInput) => {
  const hotel = await getHotelOrFail(hotelId);
  const access = authorizeHotelAccess(viewer, hotel, "staff.manage");

  const role: StaffRole = input.role ?? "staff";
  // Only the owner/admin may mint managers — otherwise a manager could
  // create an equal-or-stronger peer.
  if (role === "manager" && !access.isOwner && !access.isAdmin) {
    throw throwForbiddenError("Only the hotel owner can assign the manager role");
  }

  const user = await resolveStaffUser(input);
  if (user.id === hotel.createdBy) {
    throw throwErrorOnValidation("The hotel owner already has full access");
  }

  const [duplicate] = await db
    .select({ id: hotelStaffSchema.id })
    .from(hotelStaffSchema)
    .where(
      and(
        eq(hotelStaffSchema.hotelId, hotel.id),
        eq(hotelStaffSchema.userId, user.id),
      ),
    )
    .limit(1);
  if (duplicate) throw throwConflictError("This user is already staff at this hotel");

  // No explicit grants -> apply the role's default bundle. Explicit grants
  // (including an empty list) are stored exactly as sent.
  const permissions = uniquePermissions(
    input.permissions ?? ROLE_DEFAULT_PERMISSIONS[role],
  );
  const permissionIds = await permissionIdsFor(permissions);

  const staffId = await db.transaction(async (tx) => {
    const [staff] = await tx
      .insert(hotelStaffSchema)
      .values({
        hotelId: hotel.id,
        userId: user.id,
        role,
        invitedBy: access.userId,
      })
      .returning({ id: hotelStaffSchema.id });
    if (!staff) throw throwErrorOnValidation("Failed to add staff member");

    if (permissionIds.length > 0) {
      await tx.insert(staffPermissionsSchema).values(
        permissionIds.map((permissionId) => ({
          staffId: staff.id,
          permissionId,
        })),
      );
    }
    return staff.id;
  });

  return hydrateOne(staffId);
};

const update = async (viewer: Viewer, id: string, input: UpdateStaffInput) => {
  const existing = await getStaffOrFail(id);
  const hotel = await getHotelOrFail(existing.hotelId);
  const access = authorizeHotelAccess(viewer, hotel, "staff.manage");

  if (input.role === "manager" && !access.isOwner && !access.isAdmin) {
    throw throwForbiddenError("Only the hotel owner can assign the manager role");
  }
  if (existing.userId === hotel.createdBy && input.isActive === false) {
    throw throwErrorOnValidation("Cannot deactivate the hotel owner");
  }

  const patch: { role?: StaffRole; isActive?: boolean; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.role !== undefined) patch.role = input.role;
  if (input.isActive !== undefined) patch.isActive = input.isActive;

  // Role change resets to that role's defaults unless the caller also sends
  // an explicit permission list (explicit always wins).
  const permissions =
    input.permissions !== undefined
      ? uniquePermissions(input.permissions)
      : input.role !== undefined
        ? uniquePermissions(ROLE_DEFAULT_PERMISSIONS[input.role])
        : undefined;
  const permissionIds =
    permissions !== undefined ? await permissionIdsFor(permissions) : undefined;

  await db.transaction(async (tx) => {
    await tx
      .update(hotelStaffSchema)
      .set(patch)
      .where(eq(hotelStaffSchema.id, existing.id));

    if (permissionIds !== undefined) {
      await tx
        .delete(staffPermissionsSchema)
        .where(eq(staffPermissionsSchema.staffId, existing.id));
      if (permissionIds.length > 0) {
        await tx.insert(staffPermissionsSchema).values(
          permissionIds.map((permissionId) => ({
            staffId: existing.id,
            permissionId,
          })),
        );
      }
    }
  });

  return hydrateOne(existing.id);
};

const remove = async (viewer: Viewer, id: string) => {
  const existing = await getStaffOrFail(id);
  const hotel = await getHotelOrFail(existing.hotelId);
  authorizeHotelAccess(viewer, hotel, "staff.manage");

  if (existing.userId === hotel.createdBy) {
    throw throwErrorOnValidation("The hotel owner cannot be removed from staff");
  }

  const [json] = await attachPermissions([existing]);
  await db.delete(hotelStaffSchema).where(eq(hotelStaffSchema.id, existing.id));
  return json ?? Resource.toStaffJson(existing, []);
};

// The caller's effective access at one hotel. Powers "hide/disable buttons
// the user cannot use" in the frontend without duplicating the role matrix.
const me = async (viewer: Viewer, hotelId: string) => {
  const hotel = await getHotelOrFail(hotelId);
  const access = await resolveHotelAccess(viewer, hotel);
  return {
    hotelId: hotel.id,
    hotelName: hotel.name,
    isAdmin: access.isAdmin,
    isOwner: access.isOwner,
    staffId: access.staff?.id ?? null,
    role: access.isAdmin ? "admin" : access.isOwner ? "owner" : access.staff?.role ?? null,
    permissions: access.isAdmin || access.isOwner ? ALL_PERMISSIONS : access.permissions,
  };
};

export default {
  catalog,
  list,
  listByHotel,
  show,
  create,
  update,
  remove,
  me,
};
