import { ordersSchema } from "./schema";

export const selectQuery = {
  id: ordersSchema.id,
  guestId: ordersSchema.guestId,
  roomEntryId: ordersSchema.roomEntryId,
  hotelId: ordersSchema.hotelId,
  itemName: ordersSchema.itemName,
  quantity: ordersSchema.quantity,
  unitPriceNpr: ordersSchema.unitPriceNpr,
  totalNpr: ordersSchema.totalNpr,
  status: ordersSchema.status,
  notes: ordersSchema.notes,
  createdBy: ordersSchema.createdBy,
  createdAt: ordersSchema.createdAt,
  updatedAt: ordersSchema.updatedAt,
};
