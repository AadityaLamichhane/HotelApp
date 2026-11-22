import type { LogisticsRow } from "./schema";

// Frontend-facing logistics shape. roomId null = general hotel stock.
// roomName is joined in for display so the UI can badge "Room 204"
// without a second request.
export interface LogisticsColumn {
  id: string;
  hotelId: string;
  name: string;
  quantity: number;
  roomId: string | null;
  roomName: string | null;
  createdBy: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

type RawLogistics = Partial<LogisticsRow> & { roomName?: string | null };

class Resource {
  static toLogisticsJson(row: RawLogistics | null | undefined): Partial<LogisticsColumn> | null {
    if (!row) return null;
    return {
      id: row.id,
      hotelId: row.hotelId,
      name: row.name,
      quantity: row.quantity ?? 0,
      roomId: row.roomId ?? null,
      roomName: row.roomName ?? null,
      createdBy: row.createdBy ?? null,
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
    };
  }

  static logisticsCollection(rows: RawLogistics[]): Partial<LogisticsColumn>[] {
    return rows.map((r) => Resource.toLogisticsJson(r)).filter(Boolean) as Partial<LogisticsColumn>[];
  }
}

export default Resource;
