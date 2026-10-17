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
} from "./validators";

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
    validation: validate(listHotelOrdersValidationSchema),
  },
  // Orders for a specific guest/table session
  {
    method: "get",
    path: "guests/:id/orders",
    controller: Controller.listByGuest,
    authorization: true,
    validation: validate(guestOrdersValidationSchema),
  },
  // Single order details
  {
    method: "get",
    path: "orders/:id",
    controller: Controller.show,
    authorization: true,
    validation: validate(orderIdParamValidationSchema),
  },
  // Place a single order line
  {
    method: "post",
    path: "orders",
    controller: Controller.create,
    authorization: true,
    validation: validate(createOrderValidationSchema),
  },
  // Place multiple order lines in batch
  {
    method: "post",
    path: "orders/batch",
    controller: Controller.createBatch,
    authorization: true,
    validation: validate(createBatchOrdersValidationSchema),
  },
  // Update order (quantity, price, status, notes)
  {
    method: "patch",
    path: "orders/:id",
    controller: Controller.update,
    authorization: true,
    validation: validate(updateOrderValidationSchema),
  },
  // Update order status (e.g. pending -> preparing -> served -> cancelled)
  {
    method: "patch",
    path: "orders/:id/status",
    controller: Controller.updateStatus,
    authorization: true,
    validation: validate(updateOrderValidationSchema),
  },
  // Cancel / remove order
  {
    method: "delete",
    path: "orders/:id",
    controller: Controller.destroy,
    authorization: true,
    validation: validate(orderIdParamValidationSchema),
  },
];

export default routes;
