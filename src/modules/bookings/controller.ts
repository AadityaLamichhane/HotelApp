import type { IAuthRequest } from "@/routes";
import Service from "./service";
import { throwUnauthorizedError } from "@/utils/error";

const requireUserId = (req: IAuthRequest): number => {
  const userId = Number(req.user?.id);
  if (!userId || isNaN(userId)) throwUnauthorizedError("Login required");
  return userId;
};

// ADMIN PANEL — all hotels (service re-checks role === "admin").
const list = async (req: IAuthRequest) => Service.list(req.user, req?.query);

// HOTEL-SCOPED — hotelId forced from the path (`:id`), never from query/body.
// See AGENTS.md rule 2: a client-supplied hotelId is ignored.
const listByHotel = async (req: IAuthRequest) => {
  const { id: hotelId } = req.params ?? {};
  return Service.listByHotel(req.user, String(hotelId), req?.query);
};

// Availability for a window. Which rooms can this hotel actually sell for
// these dates? The front desk and the WhatsApp agent both call this.
const availability = async (req: IAuthRequest) => {
  const { id: hotelId } = req.params ?? {};
  const { checkIn, checkOut, roomId } = req?.query ?? {};
  return Service.availability(req.user, String(hotelId), {
    checkIn: String(checkIn),
    checkOut: String(checkOut),
    roomId: roomId ? String(roomId) : undefined,
  });
};

// Front-desk dashboard: arrivals / in-house / departures / occupancy.
// `?date=YYYY-MM-DD` defaults to today.
const dashboard = async (req: IAuthRequest) => {
  const { id: hotelId } = req.params ?? {};
  const { date } = req?.query ?? {};
  return Service.dashboard(req.user, String(hotelId), date ? String(date) : undefined);
};

// All bookings touching one room — used by the room status grid to show
// "booked 12–14 Nov" on a room cell.
const listByRoom = async (req: IAuthRequest) => {
  const { id: roomId } = req.params ?? {};
  return Service.listByRoom(req.user, String(roomId), req?.query ?? {});
};

const show = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  return Service.show(req.user, String(id));
};

// createdBy comes from the JWT via requireUserId, never req.body.
const create = async (req: IAuthRequest) =>
  Service.create(req.body, requireUserId(req), req.user);

const update = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  requireUserId(req);
  return Service.update(req.user, String(id), req.body);
};

// DELETE = cancel, never a hard delete.
const destroy = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  requireUserId(req);
  return Service.remove(req.user, String(id));
};

export default {
  list,
  listByHotel,
  availability,
  dashboard,
  listByRoom,
  show,
  create,
  update,
  destroy,
};