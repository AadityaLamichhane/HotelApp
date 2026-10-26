import type { IAuthRequest } from "@/routes";
import Service from "./service";
import { throwUnauthorizedError } from "@/utils/error";

const requireUserId = (req: IAuthRequest): number => {
  const userId = Number(req.user?.id);
  if (!userId || isNaN(userId)) throwUnauthorizedError("Login required");
  return userId;
};

// ADMIN PANEL — all hotels' menus (service re-checks role === "admin").
const listMenus = async (req: IAuthRequest) => Service.listMenus(req.user, req?.query);

// Hotel user — menu id is forced from the path (`:id`), never a query filter.
const getHotelMenu = async (req: IAuthRequest) => {
  const { id: hotelId } = req.params ?? {};
  return Service.getHotelMenu(req.user, String(hotelId));
};

const createHotelMenu = async (req: IAuthRequest) => {
  const { id: hotelId } = req.params ?? {};
  return Service.createMenu(req.user, String(hotelId), req.body, requireUserId(req));
};

const showMenu = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  return Service.showMenu(req.user, String(id));
};

const updateMenu = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  requireUserId(req);
  return Service.updateMenu(req.user, String(id), req.body);
};

const destroyMenu = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  requireUserId(req);
  return Service.removeMenu(req.user, String(id));
};

// Item list is scoped by the menu id in the path.
const listMenuItems = async (req: IAuthRequest) => {
  const { id: menuId } = req.params ?? {};
  return Service.listMenuItems(req.user, String(menuId), req?.query);
};

const createMenuItem = async (req: IAuthRequest) => {
  const { id: menuId } = req.params ?? {};
  requireUserId(req);
  return Service.createMenuItem(req.user, String(menuId), req.body);
};

const showMenuItem = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  return Service.showMenuItem(req.user, String(id));
};

const updateMenuItem = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  requireUserId(req);
  return Service.updateMenuItem(req.user, String(id), req.body);
};

const destroyMenuItem = async (req: IAuthRequest) => {
  const { id } = req.params ?? {};
  requireUserId(req);
  return Service.removeMenuItem(req.user, String(id));
};

export default {
  listMenus,
  getHotelMenu,
  createHotelMenu,
  showMenu,
  updateMenu,
  destroyMenu,
  listMenuItems,
  createMenuItem,
  showMenuItem,
  updateMenuItem,
  destroyMenuItem,
};
