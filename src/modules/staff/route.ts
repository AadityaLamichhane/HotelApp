import Controller from "./controller";
import { validate } from "@/middlewares/zodValidation";
import { staffHotelIdResolver } from "./resolvers";
import {
  createStaffValidationSchema,
  updateStaffValidationSchema,
  staffIdParamValidationSchema,
  hotelStaffParamValidationSchema,
  listStaffValidationSchema,
  listHotelStaffValidationSchema,
} from "./validators";

const routes = [
  // Static catalog: roles, permission keys, and role default bundles.
  // Any logged-in caller so the UI can build permission checkboxes.
  {
    method: "get",
    path: "staff/permissions/catalog",
    controller: Controller.catalog,
    authorization: true,
  },
  // ADMIN PANEL — staff across ALL hotels.
  {
    method: "get",
    path: "staff",
    controller: Controller.list,
    authorization: true,
    authCheckType: ["admin"],
    validation: validate(listStaffValidationSchema),
  },
  // HOTEL USER — only the hotel in the path. `:id` = hotel id.
  {
    method: "get",
    path: "hotels/:id/staff",
    controller: Controller.listByHotel,
    authorization: true,
    permissions: ["staff.view"],
    validation: validate(listHotelStaffValidationSchema),
  },
  // Caller's own effective access at this hotel (role, permissions, owner
  // flag). Used by the frontend to show/hide actions.
  {
    method: "get",
    path: "hotels/:id/staff/me",
    controller: Controller.me,
    authorization: true,
    validation: validate(hotelStaffParamValidationSchema),
  },
  // Single membership. `:id` = hotel_staff.id, so the permission middleware
  // resolves staff -> hotel before checking.
  {
    method: "get",
    path: "staff/:id",
    controller: Controller.show,
    authorization: true,
    permissions: ["staff.view"],
    permissionHotelId: staffHotelIdResolver,
    validation: validate(staffIdParamValidationSchema),
  },
  // Add staff to the hotel in the path. Requires staff.manage.
  {
    method: "post",
    path: "hotels/:id/staff",
    controller: Controller.create,
    authorization: true,
    permissions: ["staff.manage"],
    validation: validate(createStaffValidationSchema),
  },
  {
    method: "patch",
    path: "staff/:id",
    controller: Controller.update,
    authorization: true,
    permissions: ["staff.manage"],
    permissionHotelId: staffHotelIdResolver,
    validation: validate(updateStaffValidationSchema),
  },
  {
    method: "delete",
    path: "staff/:id",
    controller: Controller.destroy,
    authorization: true,
    permissions: ["staff.manage"],
    permissionHotelId: staffHotelIdResolver,
    validation: validate(staffIdParamValidationSchema),
  },
];

export default routes;
