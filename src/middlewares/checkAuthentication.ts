import Token from "@/utils/token";
import { throwForbiddenError, throwUnauthorizedError } from "@/utils/error";
import { ERROR_CODES } from "@/utils/errorCodes";

/**
 * Generic authentication for the hotelmanagement starter.
 *
 * Intentionally role-agnostic: there is no admin/retailer/customer/ops
 * concept here (unlike the salespro backend). Pass the roles a route
 * allows, e.g. `authCheckType: ["staff"]`, or leave it empty to only
 * require a valid token:
 *
 *   { authorization: true }                          -> any logged-in user
 *   { authorization: true, authCheckType: ["staff"] } -> only staff tokens
 *
 * The JWT payload must contain at least `{ id, role? }`.
 * `request.user` is populated with the decoded payload.
 */
const getHeader = (headers: any, name: string): string | undefined => {
  if (!headers) return undefined;
  if (typeof headers.get === "function") {
    return headers.get(name) ?? headers.get(name.toLowerCase()) ?? undefined;
  }
  return headers[name] ?? headers[name.toLowerCase()] ?? headers["Authorization"] ?? undefined;
};

const checkAuthentication = async (request: any, allowTo: string[] = []) => {
  const token = getHeader(request.headers, "authorization");
  if (!token) {
    throw throwUnauthorizedError("No token was found in the header", ERROR_CODES.TOKEN_MISSING);
  }

  const tokenWithoutBearer = token.startsWith("Bearer") ? token.replace(/^Bearer\s+/i, "") : token;

  let decoded: any;
  try {
    decoded = await Token.verify(tokenWithoutBearer);
  } catch {
    throw throwUnauthorizedError("Invalid or expired token", ERROR_CODES.TOKEN_INVALID);
  }
  if (!decoded) {
    throw throwUnauthorizedError("Invalid or expired token", ERROR_CODES.TOKEN_INVALID);
  }

  if (Array.isArray(allowTo) && allowTo.length && !allowTo.includes(decoded.role)) {
    throw throwForbiddenError("Role not allowed for this resource", ERROR_CODES.ROLE_FORBIDDEN);
  }

  request.user = decoded;
  return decoded;
};

export default checkAuthentication;
