import Token from "@/utils/token";

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

const checkSpecificRole = async (user: any, allowTo: string[]) => {
  if (!allowTo.includes(user?.role)) {
    throw new Error("UNAUTHORIZED: role not allowed for this resource");
  }
  return user;
};

const checkAuthentication = async (request: any, allowTo: string[] = []) => {
  try {
    const token = getHeader(request.headers, "authorization");
    if (!token) throw new Error("UNAUTHORIZED: No token was found in the header");

    const tokenWithoutBearer = token.startsWith("Bearer") ? token.replace(/^Bearer\s+/i, "") : token;
    const decoded: any = await Token.verify(tokenWithoutBearer);
    if (!decoded) throw new Error("UNAUTHORIZED: invalid token");

    if (Array.isArray(allowTo) && allowTo.length) {
      await checkSpecificRole(decoded, allowTo);
    }

    request.user = decoded;
    return decoded;
  } catch (err: any) {
    throw new Error(err.message || "UNAUTHORIZED");
  }
};

export default checkAuthentication;

