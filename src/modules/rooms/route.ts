import Controller from "./controller";
import { validate } from "@/middlewares/zodValidation";
import {
  createRoomValidationSchema,
  updateRoomValidationSchema,
  roomIdParamValidationSchema,
  listRoomsValidationSchema,
  listHotelRoomsValidationSchema,
} from "./validators";
import { roomHotelIdResolver } from "../staff/resolvers";

const routes = [
  // ADMIN PANEL — all rooms across all hotels. Admin JWT only.
  {
    method: "get",
    path: "rooms",
    controller: Controller.list,
    authorization: true,
    authCheckType: ["admin"],
    validation: validate(listRoomsValidationSchema),
  },
  // HOTEL USER — only their own hotel's rooms. Any logged-in user;
  // hotelId is forced from the path so scope can't be widened.
  // NOTE: param is named `:id` (not `:hotelId`) because Elysia/memoirist
  // requires the same param name at the same position — `hotels/:id`
  // already exists, so `hotels/:hotelId/rooms` crashes at startup.
  {
    method: "get",
    path: "hotels/:id/rooms",
    controller: Controller.listByHotel,
    authorization: true,
    permissions: ["room.view"],
    validation: validate(listHotelRoomsValidationSchema),
  },
  {
    method: "get",
    path: "rooms/:id",
    controller: Controller.show,
    authorization: true,
    permissions: ["room.view"],
    permissionHotelId: roomHotelIdResolver,
    validation: validate(roomIdParamValidationSchema),
  },
  {
    method: "post",
    path: "rooms",
    controller: Controller.create,
    authorization: true,
    permissions: ["room.manage"],
    validation: validate(createRoomValidationSchema),
  },
  {
    method: "patch",
    path: "rooms/:id",
    controller: Controller.update,
    authorization: true,
    permissions: ["room.manage"],
    permissionHotelId: roomHotelIdResolver,
    validation: validate(updateRoomValidationSchema),
  },
  {
    method: "delete",
    path: "rooms/:id",
    controller: Controller.destroy,
    authorization: true,
    permissions: ["room.manage"],
    permissionHotelId: roomHotelIdResolver,
    validation: validate(roomIdParamValidationSchema),
  },
];

export default routes;
