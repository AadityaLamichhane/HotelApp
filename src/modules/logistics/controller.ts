import type { IAuthRequest } from "@/routes";
import Service from "./service";
import { throwUnauthorizedError } from "@/utils/error";

const requireUserId = (req: IAuthRequest): number => {
  const userId = Number(req.user?.id);
  if (!userId || isNaN(userId)) throw throwUnauthorizedError("Login required");
  return userId;
};

// Admin panel: all hotels (service re-checks role === "admin").
const list = async (req: IAuthRequest) => Service.list(req.user, req?.query);

// Hotel user: ONLY hotels they own. Hotel id forced from the path (`:id`).
const listByHotel = async (req: IAuthRequest) => {
  const { id: hotelId } = req.params ?? {};
  return Service.listByHotel(req.user, String(hotelId), req?.query);
};

const show = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  return Service.show(req.user, String(id));
};

// hotelId/roomId come from the BODY (validated against ownership),
// createdBy from the JWT — never trust a client-sent createdBy.
const create = async (req: IAuthRequest) =>
  Service.create(req.body, requireUserId(req), req.user);

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

export default { list, listByHotel, show, create, update, destroy };
