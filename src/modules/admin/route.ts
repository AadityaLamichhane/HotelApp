import Controller from "./controller";
import { validate } from "@/middlewares/zodValidation";
import { adminLoginValidationSchema } from "./validators";

// POST /api/admin/login — public. Returns { admin, token } where the JWT
// carries { id, email, role: "admin" } for authCheckType: ["admin"] gates.
const routes = [
  {
    method: "post",
    path: "admin/login",
    controller: Controller.login,
    validation: validate(adminLoginValidationSchema),
  },
];

export default routes;
