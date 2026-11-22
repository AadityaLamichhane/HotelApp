import type { IAuthRequest } from "@/routes";
import Service from "./service";

// Static catalog of roles + permissions + role defaults. Any logged-in
// caller may read it so the UI can render permission checkboxes dynamically.
const catalog = async () => Service.catalog();

// Admin panel: all hotels (service re-checks role === "admin").
const list = async (req: IAuthRequest) => Service.list(req.user, req?.query);

// Hotel-scoped: `:id` is the hotel id (memoirist: same position = same
// name as `hotels/:id`).
const listByHotel = async (req: IAuthRequest) => {
  const { id: hotelId } = req.params ?? {};
  return Service.listByHotel(req.user, String(hotelId), req?.query);
};

const me = async (req: IAuthRequest) => {
  const { id: hotelId } = req.params ?? {};
  return Service.me(req.user, String(hotelId));
};

const show = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  return Service.show(req.user, String(id));
};

// hotelId comes from the PATH, invitedBy from the JWT — never trust a
// client-sent inviter or hotel scope.
const create = async (req: IAuthRequest) => {
  const { id: hotelId } = req.params ?? {};
  return Service.create(req.user, String(hotelId), req.body);
};

const update = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  return Service.update(req.user, String(id), req.body);
};

const destroy = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  return Service.remove(req.user, String(id));
};

export default { catalog, list, listByHotel, me, show, create, update, destroy };
