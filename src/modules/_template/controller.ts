import type { IAuthRequest } from "@/routes";
import Service from "./service";
import { throwErrorOnValidation } from "@/utils/error";

// Khumbaya-style thin controllers: pull from req, delegate to Service, rethrow.
const list = async (req: IAuthRequest) => Service.list(req?.query);

const create = async (req: IAuthRequest) => Service.create(req.body);

const update = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  if (!id || isNaN(Number(id))) throwErrorOnValidation("Invalid ID");
  return Service.update(Number(id), req.body);
};

const destroy = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  if (!id || isNaN(Number(id))) throwErrorOnValidation("Invalid ID");
  return Service.remove(Number(id));
};

export default { list, create, update, destroy };
