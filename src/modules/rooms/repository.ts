import schema from "./schema"
export const selectQuery = {
    id: schema.roomschema.id,
    hotelId: schema.roomschema.hotelId,
    name: schema.roomschema.name,
    description: schema.roomschema.description,
    price: schema.roomschema.price,
    isAvailable: schema.roomschema.isAvailable,
    createdBy: schema.roomschema.createdBy,
    createdAt: schema.roomschema.createdAt,
    updatedAt: schema.roomschema.updatedAt
};
