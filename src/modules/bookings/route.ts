import Controller from "./controller";
import { validate } from "@/middlewares/zodValidation";
import {
  createBookingValidationSchema,
  updateBookingValidationSchema,
  bookingIdParamValidationSchema,
  listHotelBookingsValidationSchema,
  availabilityValidationSchema,
  listRoomBookingsValidationSchema,
} from "./validators";

/**
 * Bookings = reservations for future (or same-day) windows.
 *
 * Distinct from `room_entries`, which records occupancy happening NOW. A
 * booking is a claim on dates; a room_entry is a guest physically in the room.
 * See AGENTS.md "Occupancy model".
 *
 * Param naming: booking ids are uuids, so these routes reuse `:id` at the same
 * path positions as `hotels/:id` and `rooms/:id` (AGENTS.md rule 9). That means
 * `hotels/:id/bookings` and `rooms/:id/bookings` are fine, but a
 * `hotels/:hotelId/...` variant would crash at startup.
 */
const routes = [
  // ADMIN PANEL — every booking across every hotel. Admin JWT only.
  {
    method: "get",
    path: "bookings",
    controller: Controller.list,
    authorization: true,
    authCheckType: ["admin"],
  },
  // HOTEL-SCOPED list. hotelId from the path only.
  {
    method: "get",
    path: "hotels/:id/bookings",
    controller: Controller.listByHotel,
    authorization: true,
    validation: validate(listHotelBookingsValidationSchema),
  },
  // AVAILABILITY — "which rooms can I sell for these dates?" One round trip,
  // used by both the front desk and the WhatsApp agent.
  {
    method: "get",
    path: "hotels/:id/availability",
    controller: Controller.availability,
    authorization: true,
    validation: validate(availabilityValidationSchema),
  },
  // DASHBOARD — arrivals / in-house / departures / occupancy for a date.
  {
    method: "get",
    path: "hotels/:id/dashboard",
    controller: Controller.dashboard,
    authorization: true,
  },
  // All bookings touching one room, for the room status grid.
  {
    method: "get",
    path: "rooms/:id/bookings",
    controller: Controller.listByRoom,
    authorization: true,
    validation: validate(listRoomBookingsValidationSchema),
  },
  {
    method: "get",
    path: "bookings/:id",
    controller: Controller.show,
    authorization: true,
    validation: validate(bookingIdParamValidationSchema),
  },
  {
    method: "post",
    path: "bookings",
    controller: Controller.create,
    authorization: true,
    validation: validate(createBookingValidationSchema),
  },
  {
    method: "patch",
    path: "bookings/:id",
    controller: Controller.update,
    authorization: true,
    validation: validate(updateBookingValidationSchema),
  },
  // DELETE = cancel. Bookings are never hard-deleted so no-shows stay visible
  // in the revenue report.
  {
    method: "delete",
    path: "bookings/:id",
    controller: Controller.destroy,
    authorization: true,
    validation: validate(bookingIdParamValidationSchema),
  },
];

export default routes;