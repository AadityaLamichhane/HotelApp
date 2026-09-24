import schema from "./schema";

// Public projection — NEVER select passwordHash for responses.
// Login uses a separate explicit select in the service.
export const publicUserSelect = {
  id: schema.usersSchema.id,
  email: schema.usersSchema.email,
  createdAt: schema.usersSchema.createdAt,
  updatedAt: schema.usersSchema.updatedAt,
};

export const userAuthSelect = {
  ...publicUserSelect,
  passwordHash: schema.usersSchema.passwordHash,
};
