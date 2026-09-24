import type { IAuthRequest } from "@/routes";
import Service from "./service";
import { throwErrorOnValidation, throwUnauthorizedError } from "@/utils/error";

// Thin controllers: pull from req, delegate to Service.
// createdBy-style ownership is NOT read from body anywhere —
// services take request.user.id explicitly.
const signup = async (req: IAuthRequest) => Service.signup(req.body);

const login = async (req: IAuthRequest) => Service.login(req.body);

const me = async (req: IAuthRequest) => {
  const userId = Number(req.user?.id);
  if (!userId || isNaN(userId)) throwUnauthorizedError("Login required");
  return Service.me(userId);
};

const list = async (req: IAuthRequest) => Service.list(req?.query);

const show = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  if (!id || isNaN(Number(id))) throwErrorOnValidation("Invalid ID");
  return Service.me(Number(id));
};

export default { signup, login, me, list, show };
