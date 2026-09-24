import Controller from "./controller";
import { validate } from "@/middlewares/zodValidation";
import {
  signupValidationSchema,
  loginValidationSchema,
  userIdParamValidationSchema,
  listUsersValidationSchema,
} from "./validators";

const routes = [
  {
    method: "post",
    path: "users/signup",
    controller: Controller.signup,
    validation: validate(signupValidationSchema),
  },
  {
    method: "post",
    path: "users/login",
    controller: Controller.login,
    validation: validate(loginValidationSchema),
  },
  {
    method: "get",
    path: "users/me",
    controller: Controller.me,
    authorization: true,
  },
  {
    method: "get",
    path: "users",
    controller: Controller.list,
    authorization: true,
    validation: validate(listUsersValidationSchema),
  },
  {
    method: "get",
    path: "users/:id",
    controller: Controller.show,
    authorization: true,
    validation: validate(userIdParamValidationSchema),
  },
];

export default routes;
