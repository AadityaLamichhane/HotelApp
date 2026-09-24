import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";
import corsOptions from "./cors";
import helmetOptions from "./helmet";

// NOTE: 404 fallbacks live in src/index.ts AFTER routeInit runs,
// so module routes (registered later) are never shadowed by a
// catch-all declared here.
const server = new Elysia({
  serve: {
    // Photo uploads need headroom; tune per endpoint later.
    maxRequestBodySize: 1024 * 1024 * 100,
  },
})
  .use(helmetOptions)
  .use(corsOptions)
  .use(openapi())
  .get("/", () => "server is running")
  .post("/", () => "server is healthy");

export default server;

