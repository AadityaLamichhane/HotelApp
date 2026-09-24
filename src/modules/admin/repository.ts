import schema from "./schema";

// Public projection — NEVER select passwordHash for responses.
// Login uses auth select explicitly in the service.
export const publicAdminSelect = {
  id: schema.adminsSchema.id,
  email: schema.adminsSchema.email,
  createdAt: schema.adminsSchema.createdAt,
  updatedAt: schema.adminsSchema.updatedAt,
};

export const adminAuthSelect = {
  ...publicAdminSelect,
  passwordHash: schema.adminsSchema.passwordHash,
};
