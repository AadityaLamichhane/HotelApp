import { guestsSchema } from "./schema";

export const selectQuery = {
  id: guestsSchema.id,
  hotelId: guestsSchema.hotelId,
  tableId: guestsSchema.tableId,
  guestName: guestsSchema.guestName,
  guestCount: guestsSchema.guestCount,
  status: guestsSchema.status,
  bookingId: guestsSchema.bookingId,
  roomEntryId: guestsSchema.roomEntryId,
  notes: guestsSchema.notes,
  openedAt: guestsSchema.openedAt,
  closedAt: guestsSchema.closedAt,
  createdBy: guestsSchema.createdBy,
  createdAt: guestsSchema.createdAt,
  updatedAt: guestsSchema.updatedAt,
};
