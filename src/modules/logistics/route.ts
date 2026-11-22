import Controller from "./controller";
import { validate } from "@/middlewares/zodValidation";
import {
  createLogisticsValidationSchema,
  updateLogisticsValidationSchema,
  logisticsIdParamValidationSchema,
  listLogisticsValidationSchema,
  listHotelLogisticsValidationSchema,
} from "./validators";
import { logisticsHotelIdResolver } from "../staff/resolvers";

const routes = [
  // ADMIN PANEL — all logistics across all hotels. Admin JWT only.
  {
    method: "get",
    path: "logistics",
    controller: Controller.list,
    authorization: true,
    authCheckType: ["admin"],
    validation: validate(listLogisticsValidationSchema),
  },
  // HOTEL USER — only their own hotel's logistics. Hotel id forced from
  // the path; param is `:id` (memoirist: same position = same name as
  // `hotels/:id`, never `:hotelId`).
  {
    method: "get",
    path: "hotels/:id/logistics",
    controller: Controller.listByHotel,
    authorization: true,
    permissions: ["logistics.view"],
    validation: validate(listHotelLogisticsValidationSchema),
  },
  {
    method: "get",
    path: "logistics/:id",
    controller: Controller.show,
    authorization: true,
    permissions: ["logistics.view"],
    permissionHotelId: logisticsHotelIdResolver,
    validation: validate(logisticsIdParamValidationSchema),
  },
  {
    method: "post",
    path: "logistics",
    controller: Controller.create,
    authorization: true,
    permissions: ["logistics.manage"],
    validation: validate(createLogisticsValidationSchema),
  },
  {
    method: "patch",
    path: "logistics/:id",
    controller: Controller.update,
    authorization: true,
    permissions: ["logistics.manage"],
    permissionHotelId: logisticsHotelIdResolver,
    validation: validate(updateLogisticsValidationSchema),
  },
  {
    method: "delete",
    path: "logistics/:id",
    controller: Controller.destroy,
    authorization: true,
    permissions: ["logistics.manage"],
    permissionHotelId: logisticsHotelIdResolver,
    validation: validate(logisticsIdParamValidationSchema),
  },
];

export default routes;
