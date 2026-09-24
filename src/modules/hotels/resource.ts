import type { HotelRow } from "./schema";

// Frontend-facing hotel shape + hotel-with-rooms grouping so list pages
// can render without N+1 joins on the client. ids are UUID strings.
export interface HotelColumn {
  id: string;
  name: string;
  slug: string;
  isActive: boolean | null;
  createdBy: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface HotelWithRooms extends HotelColumn {
  rooms: { id: string; name: string }[];
}

type RawHotel = Partial<HotelRow>;

class Resource {
  static toHotelJson(hotel: RawHotel | null | undefined): Partial<HotelColumn> | null {
    if (!hotel) return null;
    return {
      id: hotel.id,
      name: hotel.name,
      slug: hotel.slug,
      isActive: hotel.isActive ?? null,
      createdBy: hotel.createdBy ?? null,
      createdAt: hotel.createdAt ?? null,
      updatedAt: hotel.updatedAt ?? null,
    };
  }

  static hotelCollection(hotels: RawHotel[]): Partial<HotelColumn>[] {
    return hotels.map((h) => Resource.toHotelJson(h)).filter(Boolean) as Partial<HotelColumn>[];
  }

  static groupRoomsByHotel(
    hotels: RawHotel[],
    rooms: { id: string; name: string; hotelId: string }[],
  ): HotelWithRooms[] {
    const byHotel = new Map<string, { id: string; name: string }[]>();
    for (const room of rooms) {
      const list = byHotel.get(room.hotelId) ?? [];
      list.push({ id: room.id, name: room.name });
      byHotel.set(room.hotelId, list);
    }
    return hotels
      .map((h) => ({
        ...(Resource.toHotelJson(h) as HotelColumn),
        rooms: byHotel.get(h.id as string) ?? [],
      }))
      .filter((h) => h.id !== undefined);
  }
}

export default Resource;
