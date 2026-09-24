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
export const selectRoomEntryQuery = {
    id: schema.roomEntrySchema.id,
    customerName: schema.roomEntrySchema.customerName,
    roomId: schema.roomEntrySchema.roomId,
    checkInDate: schema.roomEntrySchema.checkInDate,
    identityNumber: schema.roomEntrySchema.identityNumber,
    numberOfguest: schema.roomEntrySchema.numberOfguest,
    mobileNumber: schema.roomEntrySchema.mobileNumber,
    malesCount: schema.roomEntrySchema.malesCount,
    femalesCount: schema.roomEntrySchema.femalesCount,
    purpose: schema.roomEntrySchema.purpose,
    signature: schema.roomEntrySchema.signature,
    checkOutDate: schema.roomEntrySchema.checkOutDate,
    roomRate: schema.roomEntrySchema.roomRate,
    createdAt: schema.roomEntrySchema.createdAt,
    updatedAt: schema.roomEntrySchema.updatedAt
};
