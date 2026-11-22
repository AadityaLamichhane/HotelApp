import { and, eq } from "drizzle-orm";
import db from "@/config/db";
import { hotelsSchema } from "../hotels/schema";
import { hotelStaffSchema, permissionsSchema, staffPermissionsSchema } from "./schema";
import {
  ALL_PERMISSIONS,
  permissionSatisfied,
  type StaffPermission,
  type StaffRole,
} from "./constants";
import {
  throwForbiddenError,
  throwNotFoundError,
  throwUnauthorizedError,
} from "@/utils/error";

// Decoded JWT shape (see admin + users services).
export type Viewer = { id?: number; role?: string } | null | undefined;
export type HotelRef = { id: string; createdBy: number | null };

export type HotelAccess = {
  hotelId: string;
  userId: number;
  isAdmin: boolean;
  isOwner: boolean;
  staff: { id: string; role: StaffRole; isActive: boolean } | null;
  permissions: readonly StaffPermission[];
};

const requireViewer = (viewer: Viewer): { id: number; role?: string } => {
  const id = Number(viewer?.id);
  if (!id || isNaN(id)) throw throwUnauthorizedError("Login required");
  return { id, role: viewer?.role };
};

/**
 * Resolve what `viewer` may do at a hotel.
 *
 * Order is deliberate: admin bypass -> hotel creator (implicit owner, all
 * permissions) -> ACTIVE hotel_staff row's explicit grants. Anything else is
 * 403. Permissions are read from the DB every request on purpose: they change
 * when an owner edits staff, so a 7-day JWT must never carry them.
 */
export const resolveHotelAccess = async (
  viewer: Viewer,
  hotel: HotelRef,
): Promise<HotelAccess> => {
  const user = requireViewer(viewer);

  if (user.role === "admin") {
    return {
      hotelId: hotel.id,
      userId: user.id,
      isAdmin: true,
      isOwner: false,
      staff: null,
      permissions: ALL_PERMISSIONS,
    };
  }

  if (Number(hotel.createdBy) === user.id) {
    return {
      hotelId: hotel.id,
      userId: user.id,
      isAdmin: false,
      isOwner: true,
      staff: null,
      permissions: ALL_PERMISSIONS,
    };
  }

  const [staff] = await db
    .select({
      id: hotelStaffSchema.id,
      role: hotelStaffSchema.role,
      isActive: hotelStaffSchema.isActive,
    })
    .from(hotelStaffSchema)
    .where(
      and(
        eq(hotelStaffSchema.hotelId, hotel.id),
        eq(hotelStaffSchema.userId, user.id),
        eq(hotelStaffSchema.isActive, true),
      ),
    )
    .limit(1);

  if (!staff) throw throwForbiddenError("Access denied for this hotel");

  const grants = await db
    .select({ key: permissionsSchema.key })
    .from(staffPermissionsSchema)
    .innerJoin(permissionsSchema, eq(staffPermissionsSchema.permissionId, permissionsSchema.id))
    .where(eq(staffPermissionsSchema.staffId, staff.id));

  return {
    hotelId: hotel.id,
    userId: user.id,
    isAdmin: false,
    isOwner: false,
    staff: { id: staff.id, role: staff.role, isActive: staff.isActive },
    permissions: grants.map((grant) => grant.key as StaffPermission),
  };
};

/** Fetch the hotel first (404 when missing), then resolve access. */
export const resolveHotelAccessById = async (
  viewer: Viewer,
  hotelId: string,
): Promise<HotelAccess> => {
  const [hotel] = await db
    .select({ id: hotelsSchema.id, createdBy: hotelsSchema.createdBy })
    .from(hotelsSchema)
    .where(eq(hotelsSchema.id, hotelId))
    .limit(1);
  if (!hotel) throw throwNotFoundError("Hotel");
  return resolveHotelAccess(viewer, hotel);
};

export const hasPermission = (
  access: HotelAccess,
  permission: StaffPermission,
): boolean =>
  access.isAdmin ||
  access.isOwner ||
  permissionSatisfied(access.permissions, permission);

export const requirePermission = (
  access: HotelAccess,
  permission: StaffPermission,
): void => {
  if (!hasPermission(access, permission)) {
    throw throwForbiddenError(`Missing permission: ${permission}`);
  }
};

/**
 * Synchronous service-layer guard. The route middleware is the single place
 * that resolves permissions from the DB and stamps the result onto
 * `ctx.user.hotelAccess`; services only read that stamp, so there is NO extra
 * query per service call.
 *
 * If no stamp exists (an internal call that did not go through the route),
 * we fall back to the owner/admin rule only — staff grants are never assumed.
 */
export const authorizeHotelAccess = (
  viewer: Viewer,
  hotel: HotelRef,
  permission: StaffPermission,
): HotelAccess => {
  const attached = (viewer as { hotelAccess?: HotelAccess } | null | undefined)
    ?.hotelAccess;
  if (attached && attached.hotelId === hotel.id) {
    requirePermission(attached, permission);
    return attached;
  }

  const user = requireViewer(viewer);
  if (user.role === "admin") {
    return {
      hotelId: hotel.id,
      userId: user.id,
      isAdmin: true,
      isOwner: false,
      staff: null,
      permissions: ALL_PERMISSIONS,
    };
  }
  if (Number(hotel.createdBy) === user.id) {
    return {
      hotelId: hotel.id,
      userId: user.id,
      isAdmin: false,
      isOwner: true,
      staff: null,
      permissions: ALL_PERMISSIONS,
    };
  }
  throw throwForbiddenError("Access denied for this hotel");
};

/**
 * Async variant for callers that have NOT gone through the route middleware
 * (background jobs, tests). Prefer `authorizeHotelAccess` on request paths.
 */
export const assertHotelPermission = async (
  viewer: Viewer,
  hotel: HotelRef,
  permission: StaffPermission,
): Promise<HotelAccess> => {
  const access = await resolveHotelAccess(viewer, hotel);
  requirePermission(access, permission);
  return access;
};
