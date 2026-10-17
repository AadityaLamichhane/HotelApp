import { roomEntrySchema } from "./schema";

export const selectQuery = {
  id: roomEntrySchema.id,
  guestId: roomEntrySchema.guestId,
  customerName: roomEntrySchema.customerName,
  roomId: roomEntrySchema.roomId,
  status: roomEntrySchema.status,
  checkInDate: roomEntrySchema.checkInDate,
  identityNumber: roomEntrySchema.identityNumber,
  numberOfguest: roomEntrySchema.numberOfguest,
  mobileNumber: roomEntrySchema.mobileNumber,
  malesCount: roomEntrySchema.malesCount,
  femalesCount: roomEntrySchema.femalesCount,
  purpose: roomEntrySchema.purpose,
  signature: roomEntrySchema.signature,
  checkOutDate: roomEntrySchema.checkOutDate,
  roomRate: roomEntrySchema.roomRate,
  createdBy: roomEntrySchema.createdBy,
  createdAt: roomEntrySchema.createdAt,
  updatedAt: roomEntrySchema.updatedAt,
};