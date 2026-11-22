import Controller from "./controller";
import { validate } from "@/middlewares/zodValidation";
import {
  createTableValidationSchema,
  updateTableValidationSchema,
  tableIdParamValidationSchema,
  listTablesValidationSchema,
  listHotelTablesValidationSchema,
} from "./validators";
import { tableHotelIdResolver } from "../staff/resolvers";

const routes = [
  // ADMIN PANEL — all tables across all hotels. Admin JWT only.
  {
    method: "get",
    path: "tables",
    controller: Controller.list,
    authorization: true,
    authCheckType: ["admin"],
    validation: validate(listTablesValidationSchema),
  },
  // HOTEL USER — only their own hotel's tables.
  // NOTE: param is `:id` (not `:hotelId`) — Elysia/memoirist requires the
  // same param name at the same position as `hotels/:id`.
  {
    method: "get",
    path: "hotels/:id/tables",
    controller: Controller.listByHotel,
    authorization: true,
    permissions: ["table.view"],
    validation: validate(listHotelTablesValidationSchema),
  },
  {
    method: "get",
    path: "tables/:id",
    controller: Controller.show,
    authorization: true,
    permissions: ["table.view"],
    permissionHotelId: tableHotelIdResolver,
    validation: validate(tableIdParamValidationSchema),
  },
  {
    method: "post",
    path: "tables",
    controller: Controller.create,
    authorization: true,
    permissions: ["table.manage"],
    validation: validate(createTableValidationSchema),
  },
  {
    method: "patch",
    path: "tables/:id",
    controller: Controller.update,
    authorization: true,
    permissions: ["table.manage"],
    permissionHotelId: tableHotelIdResolver,
    validation: validate(updateTableValidationSchema),
  },
  {
    method: "delete",
    path: "tables/:id",
    controller: Controller.destroy,
    authorization: true,
    permissions: ["table.manage"],
    permissionHotelId: tableHotelIdResolver,
    validation: validate(tableIdParamValidationSchema),
  },
];

export default routes;
