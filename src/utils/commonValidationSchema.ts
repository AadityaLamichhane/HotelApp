import { z } from "zod";
import { imageValidationExtensions } from "@/constant";

// Zod port of khumbaya's `imageInputSchema`
// (src/utils/commonValidationSchema.ts). Accepts either a
// base64 upload object or an already-stored `uploads/...` path.
export const imageInputSchema = z.union([
  z.object({
    base64: z.string(),
    extension: z
      .string()
      .refine((ext) => (imageValidationExtensions as readonly string[]).includes(ext), {
        message: "Invalid image extension",
      }),
    id: z.number().optional(),
    filename: z.string().optional(),
  }),
  z.string().regex(/^uploads\//, { message: "Must be a valid upload path" }),
]);

export type ImageInput = z.infer<typeof imageInputSchema>;
