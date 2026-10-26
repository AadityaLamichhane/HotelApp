import { z } from "zod";
import { paginationQuerySchema } from "@/utils/baseValidation";

// All ids are UUIDs. createdBy is NEVER accepted from the client — the
// service injects request.user.id. hotelId/menuId used as scope always
// come from the PATH, never from the body or a caller-chosen filter.
const hotelIdField = z.string().uuid("Valid hotelId is required");
const menuIdField = z.string().uuid("Invalid menu ID");
const menuItemIdField = z.string().uuid("Invalid menu item ID");

const nameField = z.string().min(1, "Name is required").max(255);
const optionalNameField = z.string().min(1).max(255).optional();
const descriptionField = z.string().max(2000).optional().nullable();
const priceField = z.coerce.number().int().min(0, "Price cannot be negative");
const categoryField = z.string().min(1).max(100);
const imageUrlField = z.string().url("Invalid image URL").max(2048).optional().nullable();
const sortOrderField = z.coerce.number().int().min(0, "Sort order cannot be negative");

// Query strings arrive as "true"/"false"; z.coerce.boolean() would turn the
// string "false" into true, so normalize explicitly.
const booleanQuery = z.preprocess(
  (value) => {
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return value;
  },
  z.boolean().optional(),
);

const requireAtLeastOneField = (body: Record<string, unknown>) =>
  Object.values(body).some((value) => value !== undefined);

export const createMenuValidationSchema = z.object({
  params: z.object({ id: hotelIdField }),
  body: z.object({
    name: optionalNameField,
    isActive: z.boolean().optional(),
  }),
});

export const updateMenuValidationSchema = z.object({
  params: z.object({ id: menuIdField }),
  body: z
    .object({
      name: optionalNameField,
      isActive: z.boolean().optional(),
    })
    .refine(requireAtLeastOneField, "At least one field is required"),
});

export const menuIdParamValidationSchema = z.object({
  params: z.object({ id: menuIdField }),
});

export const hotelMenuParamValidationSchema = z.object({
  params: z.object({ id: hotelIdField }),
});

// ADMIN PANEL — cross-hotel menu list.
export const listMenusValidationSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().max(255).optional(),
    hotelId: hotelIdField.optional(),
    isActive: booleanQuery,
  }),
});

// HOTEL-SCOPED item list — menu id from the PATH.
export const listMenuItemsValidationSchema = z.object({
  params: z.object({ id: menuIdField }),
  query: paginationQuerySchema.extend({
    search: z.string().max(255).optional(),
    category: z.string().max(100).optional(),
    isVeg: booleanQuery,
    isAvailable: booleanQuery,
  }),
});

export const createMenuItemValidationSchema = z.object({
  params: z.object({ id: menuIdField }),
  body: z.object({
    name: nameField,
    description: descriptionField,
    price: priceField,
    category: categoryField.optional(),
    isVeg: z.boolean().optional(),
    isAvailable: z.boolean().optional(),
    imageUrl: imageUrlField,
    sortOrder: sortOrderField.optional(),
  }),
});

export const updateMenuItemValidationSchema = z.object({
  params: z.object({ id: menuItemIdField }),
  body: z
    .object({
      name: optionalNameField,
      description: descriptionField,
      price: priceField.optional(),
      category: categoryField.optional(),
      isVeg: z.boolean().optional(),
      isAvailable: z.boolean().optional(),
      imageUrl: imageUrlField,
      sortOrder: sortOrderField.optional(),
    })
    .refine(requireAtLeastOneField, "At least one field is required"),
});

export const menuItemIdParamValidationSchema = z.object({
  params: z.object({ id: menuItemIdField }),
});

export type CreateMenuInput = z.infer<typeof createMenuValidationSchema>;
export type UpdateMenuInput = z.infer<typeof updateMenuValidationSchema>;
export type CreateMenuItemInput = z.infer<typeof createMenuItemValidationSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemValidationSchema>;
