import type { GuestRow } from "./schema";

export interface GuestColumn {
  id: number;
  hotelId: string;
  tableId: string;
  guestName: string | null;
  guestCount: number;
  status: "open" | "completed" | "cancelled";
  bookingId: string | null;
  roomEntryId: number | null;
  notes: string | null;
  openedAt: Date | null;
  closedAt: Date | null;
  createdBy: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface GuestWithDetails extends GuestColumn {
  tableName?: string | null;
  roomName?: string | null;
  bookingGuestName?: string | null;
  totalOrdersNpr?: number;
  ordersCount?: number;
  orders?: any[];
}

type RawGuest = Partial<GuestRow> & {
  tableName?: string | null;
  roomName?: string | null;
  bookingGuestName?: string | null;
  totalOrdersNpr?: number;
  ordersCount?: number;
  orders?: any[];
};

class Resource {
  static toGuestJson(guest: RawGuest | null | undefined): Partial<GuestColumn> | null {
    if (!guest) return null;
    return {
      id: guest.id as number,
      hotelId: guest.hotelId as string,
      tableId: guest.tableId as string,
      guestName: guest.guestName ?? null,
      guestCount: guest.guestCount ?? 1,
      status: guest.status as "open" | "completed" | "cancelled",
      bookingId: guest.bookingId ?? null,
      roomEntryId: guest.roomEntryId ?? null,
      notes: guest.notes ?? null,
      openedAt: guest.openedAt ?? null,
      closedAt: guest.closedAt ?? null,
      createdBy: guest.createdBy ?? null,
      createdAt: guest.createdAt ?? null,
      updatedAt: guest.updatedAt ?? null,
    };
  }

  static guestCollection(guests: RawGuest[]): Partial<GuestColumn>[] {
    return guests
      .map((g) => Resource.toGuestJson(g))
      .filter(Boolean) as Partial<GuestColumn>[];
  }

  static mapWithDetails(row: RawGuest): GuestWithDetails {
    return {
      ...(Resource.toGuestJson(row) as GuestColumn),
      tableName: row.tableName ?? null,
      roomName: row.roomName ?? null,
      bookingGuestName: row.bookingGuestName ?? null,
      totalOrdersNpr: row.totalOrdersNpr ?? 0,
      ordersCount: row.ordersCount ?? 0,
      orders: row.orders ?? undefined,
    };
  }

  static collectionWithDetails(rows: RawGuest[]): GuestWithDetails[] {
    return rows.map((r) => Resource.mapWithDetails(r));
  }
}

export default Resource;
