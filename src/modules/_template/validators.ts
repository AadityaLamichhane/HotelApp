import { z } from "zod";
import { paginationQuerySchema, idParamSchema } from "@/utils/baseValidation";

/**
 * Copy-paste template for a new module (Khumbaya style).
 * Every schema wraps `{ body, query, params }` so the SAME schema
 * validates everything about the request in one place.
 */

export const createItemValidationSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(255),
    description: z.string().max(2000).optional().nullable(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateItemValidationSchema = z.object({
  params: z.object({ id: idParamSchema }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional().nullable(),
  }),
});

export const itemIdParamValidationSchema = z.object({
  params: z.object({ id: idParamSchema }),
});

export const listItemsValidationSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().max(255).optional(),
  }),
});

export type CreateItemInput = z.infer<typeof createItemValidationSchema>;
export type UpdateItemInput = z.infer<typeof updateItemValidationSchema>;
