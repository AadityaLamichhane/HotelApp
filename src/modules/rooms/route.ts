import Controller from "./controller";
import { validate } from "@/middlewares/zodValidation";
import {
  createRoomValidationSchema,
  updateRoomValidationSchema,
  roomIdParamValidationSchema,
  listRoomsValidationSchema,
  listHotelRoomsValidationSchema,
} from "./validators";

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
  {
    method: "get",
    path: "hotels/:hotelId/rooms",
    controller: Controller.listByHotel,
    authorization: true,
    validation: validate(listHotelRoomsValidationSchema),
  },
  {
    method: "get",
    path: "rooms/:id",
    controller: Controller.show,
    authorization: true,
    validation: validate(roomIdParamValidationSchema),
  },
  {
    method: "post",
    path: "rooms",
    controller: Controller.create,
    authorization: true,
    validation: validate(createRoomValidationSchema),
  },
  {
    method: "patch",
    path: "rooms/:id",
    controller: Controller.update,
    authorization: true,
    validation: validate(updateRoomValidationSchema),
  },
  {
    method: "delete",
    path: "rooms/:id",
    controller: Controller.destroy,
    authorization: true,
    validation: validate(roomIdParamValidationSchema),
  },
];

export default routes;
