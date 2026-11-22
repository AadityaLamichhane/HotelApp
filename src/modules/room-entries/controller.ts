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

// Hotel user: only their own hotel's entries. Hotel id forced from the path.
const listByHotel = async (req: IAuthRequest) => {
  const { id: hotelId } = req.params ?? {};
  return Service.listByHotel(req.user, String(hotelId), req?.query);
};

// Occupancy history for one room (past guests + current one).
const listByRoom = async (req: IAuthRequest) => {
  const { id: roomId } = req.params ?? {};
  return Service.listByRoom(req.user, String(roomId), req?.query ?? {});
};

const show = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  return Service.show(req.user, Number(id));
};

const getFolio = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  return Service.getFolio(req.user, Number(id));
};

// Check-in: guestId/createdBy always come from the JWT or are explicitly
// allowed fields — never trust a client-sent createdBy.
const checkIn = async (req: IAuthRequest) => Service.checkIn(req.body, requireUserId(req), req.user);

const checkOut = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  requireUserId(req);
  return Service.checkOut(req.user, Number(id), req.body);
};

const update = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  requireUserId(req);
  return Service.update(req.user, Number(id), req.body);
};

const destroy = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  requireUserId(req);
  return Service.remove(req.user, Number(id));
};

export default { list, listByHotel, listByRoom, show, getFolio, checkIn, checkOut, update, destroy };