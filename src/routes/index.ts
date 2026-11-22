import checkAuthentication from "../middlewares/checkAuthentication";
import checkPermission, { type HotelIdResolver } from "../middlewares/checkPermission";
import { createRateLimiter } from "../middlewares/rateLimit";
import type { StaffPermission } from "@/modules/staff/constants";
import routeLoader from "./plugin";

export interface IAuthRequest extends Request {
  query: any;
  params: any;
  body: any;
  user?: { id: number; name?: string; email?: string; role?: string } | any;
  /** Set by the route permission middleware when a check ran. */
  hotelAccess?: unknown;
}

export interface IRoute {
  method: "get" | "post" | "put" | "delete" | "patch";
  path: string;
  controller: (req: IAuthRequest | any) => Promise<unknown>;
  authorization?: boolean;
  authCheckType?: string[];
  /**
   * Hotel-staff permissions required for this route (ALL of them).
   * Runs after auth + validation. Admin tokens bypass; owners and active
   * staff are resolved from `hotel_staff` + `staff_permissions`.
   */
  permissions?: StaffPermission[];
  /** Where the hotel id comes from. Defaults to params/body/query lookup. */
  permissionHotelId?: HotelIdResolver;
  /** Elysia hook(s), e.g. `validate(CreateSchema)` from middlewares/zodValidation */
  validation?: Record<string, unknown> | Array<Record<string, unknown>>;
  /** Per-IP in-memory limiter, e.g. `{ windowMs: 60_000, max: 10 }` */
  rateLimit?: { windowMs?: number; max?: number };
}

let routes: any[] = [];

const createRouteHandler = (controller: (...args: any[]) => unknown, path: string) => {
  const handler = async (context: any) => {
    try {
      const startTime = Date.now();
      // Khumbaya-style: controllers receive a single `req`-like object
      // with { body, query, params, headers, user, ... }.
      const req = {
        ...context,
        body: context.body,
        query: context.query,
        params: context.params,
        headers: context.headers,
        path: context.path,
        user: (context as any).user,
      };
      const data = await controller(req);
      const duration = Date.now() - startTime;
      if (duration > 500) {
        console.warn(`Slow API call: /api/${path} took ${duration}ms`);
      }
      return { success: true, data, message: "SUCCESS" };
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };
  return handler;
};

const routesInit = async (app: any) => {
  try {
    routes = await routeLoader.loadAllRoutes();
    for (const route of routes) {
      const {
        method,
        path,
        controller,
        authorization,
        authCheckType,
        permissions,
        permissionHotelId,
        validation,
        rateLimit,
      } = route as IRoute & { validation?: unknown };

      const routeHandler = createRouteHandler(controller as any, path);

      const hooks: Record<string, unknown> = {};

      // Hook order matters:
      //   rate limit -> auth -> validation -> permission
      // Permission runs last so it sees validated params/body/query (a
      // malformed hotel uuid returns 422 before any DB lookup).
      const beforeHooks: Array<(ctx: any) => unknown> = [];

      if (rateLimit) {
        const limiter = createRateLimiter(rateLimit);
        beforeHooks.push((ctx: any) => limiter.beforeHandle(ctx));
      }

      if (authorization) {
        const allowTo = (authCheckType as string[]) ?? [];
        // The decoded payload is NOT a response: discard it so the chain
        // continues to validation/permission/controller.
        beforeHooks.push(async (ctx: any) => {
          await checkAuthentication(ctx, allowTo);
        });
      }

      if (validation) {
        const validationHooks = Array.isArray(validation) ? validation : [validation];
        for (const hook of validationHooks) {
          const fn = (hook as any)?.beforeHandle;
          if (fn) beforeHooks.push(fn);
        }
      }

      if (permissions && permissions.length > 0) {
        beforeHooks.push((ctx: any) =>
          checkPermission(ctx, permissions, permissionHotelId),
        );
      }

      if (beforeHooks.length > 0) {
        hooks.beforeHandle = async (ctx: any) => {
          for (const fn of beforeHooks) {
            const shortCircuit = await fn(ctx);
            if (shortCircuit !== undefined) return shortCircuit;
          }
        };
      }

      app[method](`/api/${path}`, routeHandler, hooks);
    }
  } catch (error) {
    console.error("❌ Failed to initialize routes:", error);
    throw error;
  }
};

export default routesInit;
