import schema from "./schema";

export const hotelSelect = {
  id: schema.hotelsSchema.id,
  name: schema.hotelsSchema.name,
  slug: schema.hotelsSchema.slug,
  isActive: schema.hotelsSchema.isActive,
  createdBy: schema.hotelsSchema.createdBy,
  createdAt: schema.hotelsSchema.createdAt,
  updatedAt: schema.hotelsSchema.updatedAt,
};
