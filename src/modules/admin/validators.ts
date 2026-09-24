import { z } from "zod";

const emailField = z.string().email("Valid email is required").max(255);

// Admin login body. No signup endpoint on purpose — admins are seeded
// (see AGENTS.md). Keeps the admin panel closed to public registration.
export const adminLoginValidationSchema = z.object({
  body: z.object({
    email: emailField,
    password: z.string().min(1, "Password is required").max(128),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export type AdminLoginInput = z.infer<typeof adminLoginValidationSchema>;
