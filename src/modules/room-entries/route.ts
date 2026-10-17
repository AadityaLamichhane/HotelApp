import Controller from "./controller";
import { validate } from "@/middlewares/zodValidation";
import {
  checkInValidationSchema,
  checkOutValidationSchema,
  updateEntryValidationSchema,
  entryIdParamValidationSchema,
  listEntriesValidationSchema,
  listHotelEntriesValidationSchema,
  roomEntriesByRoomValidationSchema,
} from "./validators";

/**
 * Room entries = one guest occupying one room for one window of time.
 * This is the temporal join the whole billing side hangs off: orders point
 * at an entry, not at a (guest, room) pair.
 *
 * Entry ids are SERIAL INTEGERS, so these routes own `:id` as an integer
 * param. `rooms/:id/entries` therefore CANNOT be nested under a route that
 * already uses a uuid `:id` (see AGENTS.md rule 9) — hence the flat
 * `room/:id/entries` path with a distinct first segment.
 */
const routes = [
  // ADMIN PANEL — every entry across every hotel. Admin JWT only.
  {
    method: "get",
    path: "room-entries",
    controller: Controller.list,
    authorization: true,
    authCheckType: ["admin"],
    validation: validate(listEntriesValidationSchema),
  },
  // HOTEL USER — only their own hotel's entries.
  {
    method: "get",
    path: "hotels/:id/entries",
    controller: Controller.listByHotel,
    authorization: true,
    validation: validate(listHotelEntriesValidationSchema),
  },
  // Occupancy history for one room. Answers "who is/was in room 204" and is
  // what the in-room QR ordering flow resolves a stay from.
  {
    method: "get",
    path: "room/:id/entries",
    controller: Controller.listByRoom,
    authorization: true,
    validation: validate(roomEntriesByRoomValidationSchema),
  },
  {
    method: "get",
    path: "room-entries/:id",
    controller: Controller.show,
    authorization: true,
    validation: validate(entryIdParamValidationSchema),
  },
  // CHECK IN — creates the open entry. Fails if the room already has one.
  {
    method: "post",
    path: "room-entries/check-in",
    controller: Controller.checkIn,
    authorization: true,
    validation: validate(checkInValidationSchema),
  },
  // CHECK OUT — closes the entry; the room frees itself.
  {
    method: "post",
    path: "room-entries/:id/check-out",
    controller: Controller.checkOut,
    authorization: true,
    validation: validate(checkOutValidationSchema),
  },
  {
    method: "patch",
    path: "room-entries/:id",
    controller: Controller.update,
    authorization: true,
    validation: validate(updateEntryValidationSchema),
  },
  // Cancels a mistaken check-in by closing it (history is never deleted).
  {
    method: "delete",
    path: "room-entries/:id",
    controller: Controller.destroy,
    authorization: true,
    validation: validate(entryIdParamValidationSchema),
  },
];

export default routes;