import type { BookingRow } from "./schema";

export type BookingStatus = "pending" | "confirmed" | "checked_in" | "cancelled" | "no_show";
export type BookingSource = "direct" | "whatsapp" | "phone" | "walk_in" | "channel";

/**
 * Statuses that hold the room and therefore must block availability.
 * Keep this list the single source of truth — the availability query, the
 * create-time conflict check, and the status-transition guard all read it.
 */
export const BLOCKING_STATUSES: BookingStatus[] = ["pending", "confirmed"];

/**
 * Legal status transitions. A booking is not a free-form status field: letting
 * it be one is how you end up with a `pending` booking that a guest already
 * paid for, or a `checked_in` booking with no room_entries row.
 *
 *   pending    -> confirmed | cancelled | checked_in | no_show
 *   confirmed  -> checked_in | cancelled | no_show
 *   checked_in -> (terminal; use check-out on the room_entry, not this field)
 *   cancelled  -> pending  (staff reinstate a mistaken cancellation)
 *   no_show    -> confirmed (guest arrived late and we corrected the record)
 */
const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "cancelled", "checked_in", "no_show"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: [],
  cancelled: ["pending"],
  no_show: ["confirmed"],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isBlocking(status: BookingStatus): boolean {
  return BLOCKING_STATUSES.includes(status);
}

// Frontend-facing booking shape. `checkIn`/`checkOut` are date-only strings
// (YYYY-MM-DD) on the wire — the UI must never receive a Date it has to
// timezone-shift, because "arrives on the 14th" is the whole meaning.
export interface BookingColumn {
  id: string;
  hotelId: string;
  roomId: string;
  guestName: string;
  guestPhone: string | null;
  guestCountry: string | null;
  identityNumber: string | null;
  adults: number;
  children: number;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  source: BookingSource;
  rateNpr: number;
  totalNpr: number;
  notes: string | null;
  roomEntryId: number | null;
  createdBy: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface BookingWithRoom extends BookingColumn {
  roomName: string | null;
}

type RawBooking = Partial<BookingRow> & {
  roomName?: string | null;
};

/**
 * Drizzle's `date` mode returns a string for `date` columns, but the inferred
 * type is `string | Date` depending on version. Normalize to the wire format
 * explicitly rather than trusting either.
 */
const toDateString = (value: string | Date | null | undefined): string => {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
};

class Resource {
  static toBookingJson(booking: RawBooking | null | undefined): Partial<BookingColumn> | null {
    if (!booking) return null;
    return {
      id: booking.id as string,
      hotelId: booking.hotelId as string,
      roomId: booking.roomId as string,
      guestName: booking.guestName as string,
      guestPhone: booking.guestPhone ?? null,
      guestCountry: booking.guestCountry ?? null,
      identityNumber: booking.identityNumber ?? null,
      adults: booking.adults ?? 1,
      children: booking.children ?? 0,
      checkIn: toDateString(booking.checkIn),
      checkOut: toDateString(booking.checkOut),
      status: booking.status as BookingStatus,
      source: booking.source as BookingSource,
      rateNpr: booking.rateNpr ?? 0,
      totalNpr: booking.totalNpr ?? 0,
      notes: booking.notes ?? null,
      roomEntryId: booking.roomEntryId ?? null,
      createdBy: booking.createdBy ?? null,
      createdAt: booking.createdAt ?? null,
      updatedAt: booking.updatedAt ?? null,
    };
  }

  static bookingCollection(rows: RawBooking[]): Partial<BookingColumn>[] {
    return rows
      .map((b) => Resource.toBookingJson(b))
      .filter(Boolean) as Partial<BookingColumn>[];
  }

  static mapWithRoom(row: RawBooking): BookingWithRoom {
    return {
      ...(Resource.toBookingJson(row) as BookingColumn),
      roomName: row.roomName ?? null,
    };
  }

  static collectionWithRoom(rows: RawBooking[]): BookingWithRoom[] {
    return rows.map((r) => Resource.mapWithRoom(r));
  }

  /** Nights = number of nights in a half-open [checkIn, checkOut) window. */
  static nightsBetween(checkIn: string, checkOut: string): number {
    const a = Date.parse(`${checkIn}T00:00:00Z`);
    const b = Date.parse(`${checkOut}T00:00:00Z`);
    if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
    return Math.round((b - a) / 86_400_000);
  }
}

export default Resource;