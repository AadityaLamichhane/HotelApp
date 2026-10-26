import Controller from "./controller";
import { validate } from "@/middlewares/zodValidation";
import {
  createMenuItemValidationSchema,
  createMenuValidationSchema,
  hotelMenuParamValidationSchema,
  listMenuItemsValidationSchema,
  listMenusValidationSchema,
  menuIdParamValidationSchema,
  menuItemIdParamValidationSchema,
  updateMenuItemValidationSchema,
  updateMenuValidationSchema,
} from "./validators";

const routes = [
  // ADMIN PANEL — all menus across all hotels. Admin JWT only.
  {
    method: "get",
    path: "menus",
    controller: Controller.listMenus,
    authorization: true,
    authCheckType: ["admin"],
    validation: validate(listMenusValidationSchema),
  },
  // HOTEL USER — the single menu for their hotel. `:id` (not `:hotelId`)
  // because Elysia/memoirist requires the same param name at the same
  // position as `hotels/:id` (see AGENTS.md rule 9).
  {
    method: "get",
    path: "hotels/:id/menu",
    controller: Controller.getHotelMenu,
    authorization: true,
    validation: validate(hotelMenuParamValidationSchema),
  },
  {
    method: "post",
    path: "hotels/:id/menu",
    controller: Controller.createHotelMenu,
    authorization: true,
    validation: validate(createMenuValidationSchema),
  },
  {
    method: "get",
    path: "menus/:id",
    controller: Controller.showMenu,
    authorization: true,
    validation: validate(menuIdParamValidationSchema),
  },
  {
    method: "patch",
    path: "menus/:id",
    controller: Controller.updateMenu,
    authorization: true,
    validation: validate(updateMenuValidationSchema),
  },
  {
    method: "delete",
    path: "menus/:id",
    controller: Controller.destroyMenu,
    authorization: true,
    validation: validate(menuIdParamValidationSchema),
  },
  // HOTEL USER — items of the menu in the path (ownership enforced).
  {
    method: "get",
    path: "menus/:id/items",
    controller: Controller.listMenuItems,
    authorization: true,
    validation: validate(listMenuItemsValidationSchema),
  },
  {
    method: "post",
    path: "menus/:id/items",
    controller: Controller.createMenuItem,
    authorization: true,
    validation: validate(createMenuItemValidationSchema),
  },
  {
    method: "get",
    path: "menu-items/:id",
    controller: Controller.showMenuItem,
    authorization: true,
    validation: validate(menuItemIdParamValidationSchema),
  },
  {
    method: "patch",
    path: "menu-items/:id",
    controller: Controller.updateMenuItem,
    authorization: true,
    validation: validate(updateMenuItemValidationSchema),
  },
  {
    method: "delete",
    path: "menu-items/:id",
    controller: Controller.destroyMenuItem,
    authorization: true,
    validation: validate(menuItemIdParamValidationSchema),
  },
];

export default routes;
