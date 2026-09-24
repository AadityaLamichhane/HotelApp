import type { IAuthRequest } from "@/routes";
import Service from "./service";
import { throwUnauthorizedError } from "@/utils/error";

const requireUserId = (req: IAuthRequest): number => {
  const userId = Number(req.user?.id);
  if (!userId || isNaN(userId)) throwUnauthorizedError("Login required");
  return userId;
};

// List is owner-scoped in the service (admins see all).
// Shape validated by listHotelsValidationSchema.
const list = async (req: IAuthRequest) => Service.list(req.user, req?.query);

// Single-hotel read: service enforces ownership (403 for other hotels).
// Shape validated by hotelIdParamValidationSchema (uuid).
const show = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  return Service.show(req.user, String(id));
};

// createdBy is backend-set from JWT — never read from req.body.
const create = async (req: IAuthRequest) => Service.create(req.body, requireUserId(req));

const update = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  requireUserId(req);
  return Service.update(req.user, String(id), req.body);
};

const destroy = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  requireUserId(req);
  return Service.remove(req.user, String(id));
};

export default { list, show, create, update, destroy };
