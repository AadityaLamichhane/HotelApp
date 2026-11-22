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

const list = async (req: IAuthRequest) => Service.list(req.user, req?.query);

const listByHotel = async (req: IAuthRequest) => {
  const { id: hotelId } = req.params ?? {};
  return Service.listByHotel(req.user, String(hotelId), req?.query);
};

const listByTable = async (req: IAuthRequest) => {
  const { id: tableId } = req.params ?? {};
  return Service.listByTable(req.user, String(tableId), req?.query);
};

const getActiveByTable = async (req: IAuthRequest) => {
  const { id: tableId } = req.params ?? {};
  return Service.getActiveByTable(req.user, String(tableId));
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

const complete = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  requireUserId(req);
  return Service.complete(req.user, Number(id), req.body);
};

const cancel = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  requireUserId(req);
  return Service.cancel(req.user, Number(id));
};

const linkRoom = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  requireUserId(req);
  return Service.linkRoom(req.user, Number(id), req.body);
};

export default {
  create,
  list,
  listByHotel,
  listByTable,
  getActiveByTable,
  show,
  update,
  complete,
  cancel,
  linkRoom,
};
