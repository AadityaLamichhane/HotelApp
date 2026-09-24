import Controller from "./controller";

const routes = [
  { method: "get", path: "db/health", controller: Controller.health },
] as const;

export default routes;
