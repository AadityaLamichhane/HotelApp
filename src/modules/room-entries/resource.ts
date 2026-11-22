import type { RoomEntryRow } from "./schema";

// Frontend-facing shape for one occupancy window. `status` is what the UI
// should branch on ("open" = guest in house, "closed" = past stay) — never
// infer it from checkOutDate being null.
export interface RoomEntryColumn {
  id: number;
  guestId: number | null;
  customerName: string;
  roomId: string;
  status: "open" | "closed";
  checkInDate: Date | null;
  identityNumber: string | null;
  numberOfguest: number;
  mobileNumber: string | null;
  malesCount: number;
  femalesCount: number;
  purpose: string | null;
  signature: string | null;
  checkOutDate: Date | null;
  roomRate: number;
  advanceAmount: number;
  discountAmount: number;
  paidAmount: number;
  paymentMethod: string | null;
  createdBy: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface RoomEntryWithRoom extends RoomEntryColumn {
  roomName: string | null;
  hotelId: string | null;
}

type RawEntry = Partial<RoomEntryRow> & {
  roomName?: string | null;
  hotelId?: string | null;
};

class Resource {
  static toRoomEntryJson(entry: RawEntry | null | undefined): Partial<RoomEntryColumn> | null {
    if (!entry) return null;
    return {
      id: entry.id as number,
      guestId: entry.guestId ?? null,
      customerName: entry.customerName as string,
      roomId: entry.roomId as string,
      status: entry.status as "open" | "closed",
      checkInDate: entry.checkInDate ?? null,
      identityNumber: entry.identityNumber ?? null,
      numberOfguest: entry.numberOfguest ?? 1,
      mobileNumber: entry.mobileNumber ?? null,
      malesCount: entry.malesCount ?? 0,
      femalesCount: entry.femalesCount ?? 0,
      purpose: entry.purpose ?? null,
      signature: entry.signature ?? null,
      checkOutDate: entry.checkOutDate ?? null,
      roomRate: entry.roomRate ?? 0,
      advanceAmount: entry.advanceAmount ?? 0,
      discountAmount: entry.discountAmount ?? 0,
      paidAmount: entry.paidAmount ?? 0,
      paymentMethod: entry.paymentMethod ?? null,
      createdBy: entry.createdBy ?? null,
      createdAt: entry.createdAt ?? null,
      updatedAt: entry.updatedAt ?? null,
    };
  }

  static roomEntryCollection(entries: RawEntry[]): Partial<RoomEntryColumn>[] {
    return entries
      .map((e) => Resource.toRoomEntryJson(e))
      .filter(Boolean) as Partial<RoomEntryColumn>[];
  }

  // For the front-desk list: who is in which room, with the room's name.
  static mapWithRoom(row: RawEntry): RoomEntryWithRoom {
    return {
      ...(Resource.toRoomEntryJson(row) as RoomEntryColumn),
      roomName: row.roomName ?? null,
      hotelId: row.hotelId ?? null,
    };
  }

  static collectionWithRoom(rows: RawEntry[]): RoomEntryWithRoom[] {
    return rows.map((r) => Resource.mapWithRoom(r));
  }
}

export default Resource;
