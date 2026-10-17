import Controller from "./controller";
import { validate } from "@/middlewares/zodValidation";
import {
  createGuestValidationSchema,
  updateGuestValidationSchema,
  linkRoomValidationSchema,
  guestIdParamValidationSchema,
  listGuestsValidationSchema,
  listHotelGuestsValidationSchema,
  tableGuestsValidationSchema,
} from "./validators";

const routes = [
  // Admin list
  {
    method: "get",
    path: "guests",
    controller: Controller.list,
    authorization: true,
    authCheckType: ["admin"],
    validation: validate(listGuestsValidationSchema),
  },
  // Hotel-scoped list of guest sessions
  {
    method: "get",
    path: "hotels/:id/guests",
    controller: Controller.listByHotel,
    authorization: true,
    validation: validate(listHotelGuestsValidationSchema),
  },
  // Table-scoped list of sessions
  {
    method: "get",
    path: "tables/:id/guests",
    controller: Controller.listByTable,
    authorization: true,
    validation: validate(tableGuestsValidationSchema),
  },
  // Get active session for a specific table
  {
    method: "get",
    path: "tables/:id/active-guest",
    controller: Controller.getActiveByTable,
    authorization: true,
    validation: validate(tableGuestsValidationSchema),
  },
  // Single guest session details (with orders and room bridge info)
  {
    method: "get",
    path: "guests/:id",
    controller: Controller.show,
    authorization: true,
    validation: validate(guestIdParamValidationSchema),
  },
  // Open a new guest session for a table (auto-completes prior open session on same table)
  {
    method: "post",
    path: "guests",
    controller: Controller.create,
    authorization: true,
    validation: validate(createGuestValidationSchema),
  },
  // Update guest session
  {
    method: "patch",
    path: "guests/:id",
    controller: Controller.update,
    authorization: true,
    validation: validate(updateGuestValidationSchema),
  },
  // Complete guest session (settled / departed)
  {
    method: "post",
    path: "guests/:id/complete",
    controller: Controller.complete,
    authorization: true,
    validation: validate(guestIdParamValidationSchema),
  },
  // Cancel guest session
  {
    method: "post",
    path: "guests/:id/cancel",
    controller: Controller.cancel,
    authorization: true,
    validation: validate(guestIdParamValidationSchema),
  },
  // Room bridge: Link table session to room booking or room entry
  {
    method: "post",
    path: "guests/:id/link-room",
    controller: Controller.linkRoom,
    authorization: true,
    validation: validate(linkRoomValidationSchema),
  },
];

export default routes;
