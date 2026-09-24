import { z } from "zod";
import { paginationQuerySchema } from "@/utils/baseValidation";

// hotels.id is a uuid PK (defaultRandom), so all :id params are UUIDs.
const hotelIdParam = z.string().uuid("Invalid ID");

export const createHotelValidationSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(255),
    // slug/isActive/createdBy are server-set — never accepted from clients.
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateHotelValidationSchema = z.object({
  params: z.object({ id: hotelIdParam }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const hotelIdParamValidationSchema = z.object({
  params: z.object({ id: hotelIdParam }),
});

export const listHotelsValidationSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().max(255).optional(),
  }),
});

export type CreateHotelInput = z.infer<typeof createHotelValidationSchema>;
export type UpdateHotelInput = z.infer<typeof updateHotelValidationSchema>;
