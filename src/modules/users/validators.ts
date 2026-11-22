import { z } from "zod";
import { paginationQuerySchema, idParamSchema } from "@/utils/baseValidation";

// Khumbaya envelope: every schema validates { body, query, params } together.
const emailField = z.string().email("Valid email is required").max(255);
const passwordField = z.string().min(8, "Password must be at least 8 characters").max(128);

export const signupValidationSchema = z.object({
  body: z.object({
    email: emailField,
    password: passwordField,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const loginValidationSchema = z.object({
  body: z.object({
    email: emailField,
    password: z.string().min(1, "Password is required").max(128),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// Staged auth: the client asks about the email before collecting a password.
export const emailLookupValidationSchema = z.object({
  body: z.object({
    email: emailField,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const userIdParamValidationSchema = z.object({
  params: z.object({ id: idParamSchema }),
});

export const googleOAuthValidationSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, "idToken is required").max(8192),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const listUsersValidationSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().max(255).optional(),
  }),
});

export type SignupInput = z.infer<typeof signupValidationSchema>;
export type LoginInput = z.infer<typeof loginValidationSchema>;
