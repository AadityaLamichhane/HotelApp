import checkAuthentication from "../middlewares/checkAuthentication";
import routeLoader from "./plugin";

export interface IAuthRequest extends Request {
  query: any;
  params: any;
  body: any;
  user?: { id: number; name?: string; email?: string; role?: string } | any;
}

export interface IRoute {
  method: "get" | "post" | "put" | "delete" | "patch";
  path: string;
  controller: (req: IAuthRequest | any) => Promise<unknown>;
  authorization?: boolean;
  authCheckType?: string[];
  /** Elysia hook(s), e.g. `validate(CreateSchema)` from middlewares/zodValidation */
  validation?: Record<string, unknown> | Array<Record<string, unknown>>;
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
      return { data, message: "SUCCESS" };
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
      const { method, path, controller, authorization, authCheckType, validation } =
        route as IRoute & { validation?: unknown };

      const routeHandler = createRouteHandler(controller as any, path);

      const hooks: Record<string, unknown> = {};

      if (authorization) {
        const allowTo = (authCheckType as string[]) ?? [];
        hooks.beforeHandle = async (ctx: any) => {
          await checkAuthentication(ctx, allowTo);
        };
      }

      if (validation) {
        const validationHooks = Array.isArray(validation) ? validation : [validation];
        const beforeHandles = validationHooks
          .map((v: any) => v?.beforeHandle)
          .filter(Boolean);
        if (beforeHandles.length) {
          const authHook = (hooks as any).beforeHandle;
          (hooks as any).beforeHandle = async (ctx: any) => {
            if (authHook) await authHook(ctx);
            for (const fn of beforeHandles) {
              const shortCircuit = await (fn as any)(ctx);
              if (shortCircuit !== undefined) return shortCircuit;
            }
          };
        }
      }

      app[method](`/api/${path}`, routeHandler, hooks);
    }
  } catch (error) {
    console.error("❌ Failed to initialize routes:", error);
    throw error;
  }
};

export default routesInit;
