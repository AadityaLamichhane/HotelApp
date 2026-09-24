import type { RoomRow } from "./schema";

// Frontend-facing room shape. ids are UUID strings the UI can
// filter/group by; grouping helpers below turn flat lists into
// hotel-grouped maps without extra requests.
export interface RoomColumn {
  id: string;
  hotelId: string;
  name: string;
  description: string | null;
  price: number;
  isAvailable: boolean | null;
  createdBy: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface RoomWithHotel extends RoomColumn {
  hotelName: string | null;
}

type RawRoom = Partial<RoomRow> & { hotelName?: string | null };

class Resource {
  static toRoomJson(room: RawRoom | null | undefined): Partial<RoomColumn> | null {
    if (!room) return null;
    return {
      id: room.id,
      hotelId: room.hotelId,
      name: room.name,
      description: room.description ?? null,
      price: room.price,
      isAvailable: room.isAvailable ?? null,
      createdBy: room.createdBy ?? null,
      createdAt: room.createdAt ?? null,
      updatedAt: room.updatedAt ?? null,
    };
  }

  static roomCollection(rooms: RawRoom[]): Partial<RoomColumn>[] {
    return rooms.map((r) => Resource.toRoomJson(r)).filter(Boolean) as Partial<RoomColumn>[];
  }

  static mapRoomWithHotel(row: RawRoom): RoomWithHotel {
    return {
      ...(Resource.toRoomJson(row) as RoomColumn),
      hotelName: row.hotelName ?? null,
    };
  }

  static groupRoomsByHotel(rows: RawRoom[]): Map<string, Partial<RoomColumn>[]> {
    const grouped = new Map<string, Partial<RoomColumn>[]>();
    for (const row of rows) {
      const json = Resource.toRoomJson(row);
      if (!json || json.hotelId === undefined) continue;
      const key = json.hotelId as string;
      const list = grouped.get(key) ?? [];
      list.push(json);
      grouped.set(key, list);
    }
    return grouped;
  }
}

export default Resource;
