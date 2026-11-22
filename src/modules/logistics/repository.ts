import schema from "./schema";

export const selectQuery = {
    id: schema.logisticsSchema.id,
    hotelId: schema.logisticsSchema.hotelId,
    name: schema.logisticsSchema.name,
    quantity: schema.logisticsSchema.quantity,
    roomId: schema.logisticsSchema.roomId,
    createdBy: schema.logisticsSchema.createdBy,
    createdAt: schema.logisticsSchema.createdAt,
    updatedAt: schema.logisticsSchema.updatedAt,
};
