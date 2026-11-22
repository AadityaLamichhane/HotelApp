import Controller from "./controller";
import { validate } from "@/middlewares/zodValidation";
import {
  createOrderValidationSchema,
  createBatchOrdersValidationSchema,
  updateOrderValidationSchema,
  orderIdParamValidationSchema,
  listOrdersValidationSchema,
  listHotelOrdersValidationSchema,
  guestOrdersValidationSchema,
  roomEntryOrdersValidationSchema,
} from "./validators";
import {
  entryHotelIdResolver,
  guestHotelIdResolver,
  orderHotelIdResolver,
} from "../staff/resolvers";

const routes = [
  // Admin list
  {
    method: "get",
    path: "orders",
    controller: Controller.list,
    authorization: true,
    authCheckType: ["admin"],
    validation: validate(listOrdersValidationSchema),
  },
  // Hotel orders (e.g. kitchen display or restaurant ledger)
  {
    method: "get",
    path: "hotels/:id/orders",
    controller: Controller.listByHotel,
    authorization: true,
    permissions: ["order.view"],
    validation: validate(listHotelOrdersValidationSchema),
  },
  // Orders for a specific guest/table session
  {
    method: "get",
    path: "guests/:id/orders",
    controller: Controller.listByGuest,
    authorization: true,
    permissions: ["order.view"],
    permissionHotelId: guestHotelIdResolver,
    validation: validate(guestOrdersValidationSchema),
  },
  // Orders for a specific room entry (direct room service)
  {
    method: "get",
    path: "room-entries/:id/orders",
    controller: Controller.listByRoomEntry,
    authorization: true,
    permissions: ["order.view"],
    permissionHotelId: entryHotelIdResolver,
    validation: validate(roomEntryOrdersValidationSchema),
  },
  // Single order details
  {
    method: "get",
    path: "orders/:id",
    controller: Controller.show,
    authorization: true,
    permissions: ["order.view"],
    permissionHotelId: orderHotelIdResolver,
    validation: validate(orderIdParamValidationSchema),
  },
  // Place a single order line
  {
    method: "post",
    path: "orders",
    controller: Controller.create,
    authorization: true,
    permissions: ["order.manage"],
    validation: validate(createOrderValidationSchema),
  },
  // Place multiple order lines in batch
  {
    method: "post",
    path: "orders/batch",
    controller: Controller.createBatch,
    authorization: true,
    permissions: ["order.manage"],
    validation: validate(createBatchOrdersValidationSchema),
  },
  // Update order (quantity, price, status, notes)
  {
    method: "patch",
    path: "orders/:id",
    controller: Controller.update,
    authorization: true,
    permissions: ["order.manage"],
    permissionHotelId: orderHotelIdResolver,
    validation: validate(updateOrderValidationSchema),
  },
  // Update order status (e.g. pending -> preparing -> served -> cancelled)
  {
    method: "patch",
    path: "orders/:id/status",
    controller: Controller.updateStatus,
    authorization: true,
    permissions: ["order.manage"],
    permissionHotelId: orderHotelIdResolver,
    validation: validate(updateOrderValidationSchema),
  },
  // Cancel / remove order
  {
    method: "delete",
    path: "orders/:id",
    controller: Controller.destroy,
    authorization: true,
    permissions: ["order.manage"],
    permissionHotelId: orderHotelIdResolver,
    validation: validate(orderIdParamValidationSchema),
  },
];

export default routes;
