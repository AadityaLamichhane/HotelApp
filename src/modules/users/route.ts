import Controller from "./controller";
import { validate } from "@/middlewares/zodValidation";
import {
  signupValidationSchema,
  loginValidationSchema,
  emailLookupValidationSchema,
  googleOAuthValidationSchema,
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
    // Public, but rate-limited: powers the staged email → password form.
    method: "post",
    path: "users/email-lookup",
    controller: Controller.emailLookup,
    validation: validate(emailLookupValidationSchema),
    rateLimit: { windowMs: 60_000, max: 20 },
  },
  {
    // Public like login: the Google id_token is the credential.
    method: "post",
    path: "users/oauth/google",
    controller: Controller.oauthGoogle,
    validation: validate(googleOAuthValidationSchema),
    rateLimit: { windowMs: 60_000, max: 10 },
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
