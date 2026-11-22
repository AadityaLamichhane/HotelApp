import { resolveHotelAccessById, requirePermission } from "@/modules/staff/access";
import type { StaffPermission } from "@/modules/staff/constants";
import { throwForbiddenError, throwUnauthorizedError } from "@/utils/error";
import { ERROR_CODES } from "@/utils/errorCodes";

/**
 * Route-level permission gate — the authorization sibling of
 * `checkAuthentication`. Declared on a route like:
 *
 *   {
 *     authorization: true,
 *     permissions: ["room.manage"],          // ALL listed permissions required
 *     permissionHotelId: (ctx) => ...,       // optional scope resolver
 *   }
 *
 * The hotel scope defaults to `params.id` -> `params.hotelId` ->
 * `body.hotelId` -> `query.hotelId`, which covers `hotels/:id/...` and
 * create-by-body routes. Resource-id routes (`rooms/:id`, `staff/:id`)
 * pass a resolver that maps the resource back to its hotel.
 *
 * Admin tokens bypass the hotel lookup (they are gated separately with
 * `authCheckType: ["admin"]`). Owners bypass via `resolveHotelAccess`.
 */
export type HotelIdResolver = (
  ctx: any,
) => string | undefined | Promise<string | undefined>;

export const defaultHotelIdResolver: HotelIdResolver = (ctx: any) => {
  const params = ctx?.params ?? {};
  return (
    params.id ??
    params.hotelId ??
    ctx?.body?.hotelId ??
    ctx?.query?.hotelId ??
    undefined
  );
};

const checkPermission = async (
  ctx: any,
  permissions: StaffPermission[],
  hotelIdResolver: HotelIdResolver = defaultHotelIdResolver,
) => {
  const user = ctx?.user;
  if (!user?.id) throw throwUnauthorizedError("Login required");

  // Admins are authorized by `authCheckType: ["admin"]`, not by hotel staff.
  if (user.role === "admin") return undefined;

  const hotelId = await hotelIdResolver(ctx);
  if (!hotelId) {
    throw throwForbiddenError(
      "Hotel context required for this action",
      ERROR_CODES.ROLE_FORBIDDEN,
    );
  }

  const access = await resolveHotelAccessById(user, String(hotelId));
  for (const permission of permissions) {
    requirePermission(access, permission);
  }

  // Stamp the resolved access onto the user object the controllers pass to
  // services. Services read this synchronously, so a request performs exactly
  // ONE permission resolution (here) instead of one per service call.
  ctx.hotelAccess = access;
  ctx.user.hotelAccess = access;
  return undefined;
};

export default checkPermission;
