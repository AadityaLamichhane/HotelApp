import type { IAuthRequest } from "@/routes";
import Service from "./service";
import { throwUnauthorizedError } from "@/utils/error";

const requireUserId = (req: IAuthRequest): number => {
  const userId = Number(req.user?.id);
  if (!userId || isNaN(userId)) throwUnauthorizedError("Login required");
  return userId;
};

const create = async (req: IAuthRequest) =>
  Service.create(req.body, requireUserId(req), req.user);

const createBatch = async (req: IAuthRequest) =>
  Service.createBatch(req.body, requireUserId(req), req.user);

const list = async (req: IAuthRequest) => Service.list(req.user, req?.query);

const listByHotel = async (req: IAuthRequest) => {
  const { id: hotelId } = req.params ?? {};
  return Service.listByHotel(req.user, String(hotelId), req?.query);
};

const listByGuest = async (req: IAuthRequest) => {
  const { id: guestId } = req.params ?? {};
  return Service.listByGuest(req.user, Number(guestId), req?.query);
};

const listByRoomEntry = async (req: IAuthRequest) => {
  const { id: roomEntryId } = req.params ?? {};
  return Service.listByRoomEntry(req.user, Number(roomEntryId), req?.query);
};

const show = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  return Service.show(req.user, Number(id));
};

const update = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  requireUserId(req);
  return Service.update(req.user, Number(id), req.body);
};

const updateStatus = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  requireUserId(req);
  return Service.updateStatus(req.user, Number(id), req.body.status);
};

const destroy = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  requireUserId(req);
  return Service.remove(req.user, Number(id));
};

export default {
  create,
  createBatch,
  list,
  listByHotel,
  listByGuest,
  listByRoomEntry,
  show,
  update,
  updateStatus,
  destroy,
};
