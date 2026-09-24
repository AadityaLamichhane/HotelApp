import Controller from "./controller";
import { validate } from "@/middlewares/zodValidation";
import {
  createHotelValidationSchema,
  updateHotelValidationSchema,
  hotelIdParamValidationSchema,
  listHotelsValidationSchema,
} from "./validators";

const routes = [
  // Owner-scoped list: any logged-in user sees ONLY hotels they created
  // (admins see all). Auth required so hotel UUIDs aren't publicly
  // enumerable for cross-hotel probing.
  {
    method: "get",
    path: "hotels",
    controller: Controller.list,
    authorization: true,
    validation: validate(listHotelsValidationSchema),
  },
  // Single-hotel read: service enforces ownership (403 for other hotels).
  {
    method: "get",
    path: "hotels/:id",
    controller: Controller.show,
    authorization: true,
    validation: validate(hotelIdParamValidationSchema),
  },
  {
    method: "post",
    path: "hotels",
    controller: Controller.create,
    authorization: true,
    validation: validate(createHotelValidationSchema),
  },
  {
    method: "patch",
    path: "hotels/:id",
    controller: Controller.update,
    authorization: true,
    validation: validate(updateHotelValidationSchema),
  },
  {
    method: "delete",
    path: "hotels/:id",
    controller: Controller.destroy,
    authorization: true,
    validation: validate(hotelIdParamValidationSchema),
  },
];

export default routes;
