import { z } from "zod";
import { paginationQuerySchema } from "@/utils/baseValidation";

const hotelIdField = z.string().uuid("Valid hotelId is required");
const guestIdField = z.coerce.number().int().positive("Invalid guest id");
const roomEntryIdField = z.coerce.number().int().positive("Invalid room entry id");
const orderIdField = z.coerce.number().int().positive("Invalid order id");
const quantityField = z.coerce.number().int().min(1, "Quantity must be at least 1").max(1000).default(1);
const unitPriceField = z.coerce.number().int().min(0, "Price must be non-negative").default(0);

const orderItemSchema = z.object({
  itemName: z.string().min(1, "Item name is required").max(255),
  quantity: quantityField,
  unitPriceNpr: unitPriceField,
  notes: z.string().max(500).optional().nullable(),
});

export const createOrderValidationSchema = z.object({
  body: z
    .object({
      hotelId: hotelIdField,
      guestId: guestIdField.optional().nullable(),
      roomEntryId: roomEntryIdField.optional().nullable(),
      itemName: z.string().min(1, "Item name is required").max(255),
      quantity: quantityField,
      unitPriceNpr: unitPriceField,
      notes: z.string().max(500).optional().nullable(),
    })
    .refine((data) => data.guestId != null || data.roomEntryId != null, {
      message: "Either guestId or roomEntryId must be provided",
      path: ["guestId"],
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const createBatchOrdersValidationSchema = z.object({
  body: z
    .object({
      hotelId: hotelIdField,
      guestId: guestIdField.optional().nullable(),
      roomEntryId: roomEntryIdField.optional().nullable(),
      items: z.array(orderItemSchema).min(1, "At least one item is required"),
    })
    .refine((data) => data.guestId != null || data.roomEntryId != null, {
      message: "Either guestId or roomEntryId must be provided",
      path: ["guestId"],
    }),
});

export const updateOrderValidationSchema = z.object({
  params: z.object({ id: orderIdField }),
  body: z.object({
    itemName: z.string().min(1).max(255).optional(),
    quantity: quantityField.optional(),
    unitPriceNpr: unitPriceField.optional(),
    status: z.enum(["pending", "preparing", "served", "cancelled"]).optional(),
    notes: z.string().max(500).optional().nullable(),
  }),
});

export const orderIdParamValidationSchema = z.object({
  params: z.object({ id: orderIdField }),
});

export const listOrdersValidationSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().max(255).optional(),
    hotelId: hotelIdField.optional(),
    guestId: guestIdField.optional(),
    roomEntryId: roomEntryIdField.optional(),
    status: z.enum(["pending", "preparing", "served", "cancelled"]).optional(),
  }),
});

export const listHotelOrdersValidationSchema = z.object({
  params: z.object({ id: hotelIdField }),
  query: paginationQuerySchema.extend({
    search: z.string().max(255).optional(),
    guestId: guestIdField.optional(),
    roomEntryId: roomEntryIdField.optional(),
    status: z.enum(["pending", "preparing", "served", "cancelled"]).optional(),
  }),
});

export const guestOrdersValidationSchema = z.object({
  params: z.object({ id: guestIdField }),
  query: z.object({
    status: z.enum(["pending", "preparing", "served", "cancelled"]).optional(),
  }),
});

export const roomEntryOrdersValidationSchema = z.object({
  params: z.object({ id: roomEntryIdField }),
  query: z.object({
    status: z.enum(["pending", "preparing", "served", "cancelled"]).optional(),
  }),
});

export type CreateOrderInput = z.infer<typeof createOrderValidationSchema>;
export type CreateBatchOrdersInput = z.infer<typeof createBatchOrdersValidationSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderValidationSchema>;
