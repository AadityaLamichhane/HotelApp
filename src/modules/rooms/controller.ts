import type { IAuthRequest } from "@/routes";
import Service from "./service";
import { throwUnauthorizedError } from "@/utils/error";

const requireUserId = (req: IAuthRequest): number => {
  const userId = Number(req.user?.id);
  if (!userId || isNaN(userId)) throwUnauthorizedError("Login required");
  return userId;
};

// Admin panel: all hotels (service re-checks role === "admin").
const list = async (req: IAuthRequest) => Service.list(req.user, req?.query);

// Hotel user: ONLY hotels they own (service enforces hotels.created_by).
// Hotel id is forced from the path (`:id`) so scope can't be widened.
// Shape is validated by listHotelRoomsValidationSchema (uuid); the service
// re-validates + authorizes as the trust boundary.
const listByHotel = async (req: IAuthRequest) => {
  const { id: hotelId } = req.params ?? {};
  return Service.listByHotel(req.user, String(hotelId), req?.query);
};

// Single-room read: service resolves the room's hotel and enforces
// ownership, so one hotel can't hit another hotel's room by id.
// Shape is validated by roomIdParamValidationSchema (uuid).
const show = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  return Service.show(req.user, String(id));
};

// hotelId comes from the BODY, createdBy from the JWT — never trust
// a client-sent createdBy. Service rejects hotels the caller doesn't own.
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
