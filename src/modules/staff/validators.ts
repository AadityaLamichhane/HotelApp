import { z } from "zod";
import { paginationQuerySchema } from "@/utils/baseValidation";
import { STAFF_PERMISSIONS, STAFF_ROLES } from "./constants";

// IDs are UUIDs (hotel_staff.id / hotels.id are uuid PKs). `userId` is the
// integer users.id. createdBy / invitedBy are ALWAYS server-set.
const hotelIdField = z.string().uuid("Valid hotelId is required");
const staffIdField = z.string().uuid("Invalid ID");
const roleField = z.enum(STAFF_ROLES);
const permissionField = z.enum(STAFF_PERMISSIONS);
const permissionsField = z
  .array(permissionField)
  .max(STAFF_PERMISSIONS.length, "Too many permissions");

// Query strings arrive as text; "false" must stay false (z.coerce.boolean
// would turn every non-empty string into true).
const optionalBooleanQuery = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return value;
}, z.boolean().optional());

const listQueryFields = {
  search: z.string().max(255).optional(),
  userId: z.coerce.number().int().positive().optional(),
  role: roleField.optional(),
  permission: permissionField.optional(),
  isActive: optionalBooleanQuery,
};

export const createStaffValidationSchema = z.object({
  params: z.object({ id: hotelIdField }),
  body: z
    .object({
      // Add an EXISTING account by userId...
      userId: z.coerce.number().int().positive().optional(),
      // ...or by email. If the email is unknown, name + password creates the
      // account in the same call (onboarding flow).
      email: z.string().email("Valid email is required").max(255).optional(),
      name: z.string().min(1).max(255).optional(),
      password: z.string().min(8, "Password must be at least 8 characters").max(128).optional(),
      role: roleField.optional(),
      permissions: permissionsField.optional(),
    })
    .refine((value) => value.userId !== undefined || value.email !== undefined, {
      message: "Either userId or email is required",
      path: ["userId"],
    }),
  query: z.object({}).optional(),
});

export const updateStaffValidationSchema = z.object({
  params: z.object({ id: staffIdField }),
  body: z
    .object({
      role: roleField.optional(),
      isActive: z.boolean().optional(),
      // Replace the whole grant set. Omit to leave permissions untouched.
      permissions: permissionsField.optional(),
    })
    .refine(
      (value) =>
        value.role !== undefined ||
        value.isActive !== undefined ||
        value.permissions !== undefined,
      { message: "At least one field is required" },
    ),
});

export const staffIdParamValidationSchema = z.object({
  params: z.object({ id: staffIdField }),
});

export const hotelStaffParamValidationSchema = z.object({
  params: z.object({ id: hotelIdField }),
});

// ADMIN panel list — cross-hotel, optional hotelId filter.
export const listStaffValidationSchema = z.object({
  query: paginationQuerySchema.extend({
    ...listQueryFields,
    hotelId: hotelIdField.optional(),
  }),
});

// HOTEL-SCOPED list: hotel id is forced from the PATH (`:id` — memoirist
// requires the same param name at the same position as `hotels/:id`).
export const listHotelStaffValidationSchema = z.object({
  params: z.object({ id: hotelIdField }),
  query: paginationQuerySchema.extend(listQueryFields),
});

export type CreateStaffInput = z.infer<typeof createStaffValidationSchema>["body"];
export type UpdateStaffInput = z.infer<typeof updateStaffValidationSchema>["body"];
