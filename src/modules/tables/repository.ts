import schema from "./schema";

export const selectQuery = {
  id: schema.tablesSchema.id,
  hotelId: schema.tablesSchema.hotelId,
  name: schema.tablesSchema.name,
  seats: schema.tablesSchema.seats,
  isAvailable: schema.tablesSchema.isAvailable,
  createdBy: schema.tablesSchema.createdBy,
  createdAt: schema.tablesSchema.createdAt,
  updatedAt: schema.tablesSchema.updatedAt,
};
