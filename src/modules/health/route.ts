import Controller from "./controller";

const routes = [
  { method: "get", path: "health", controller: Controller.ping },
] as const;

export default routes;
