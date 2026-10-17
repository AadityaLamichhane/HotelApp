import type { TableRow } from "./schema";

export interface TableColumn {
  id: string;
  hotelId: string;
  name: string;
  seats: number;
  isAvailable: boolean | null;
  createdBy: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

type RawTable = Partial<TableRow>;

class Resource {
  static toTableJson(table: RawTable | null | undefined): Partial<TableColumn> | null {
    if (!table) return null;
    return {
      id: table.id,
      hotelId: table.hotelId,
      name: table.name,
      seats: table.seats,
      isAvailable: table.isAvailable ?? null,
      createdBy: table.createdBy ?? null,
      createdAt: table.createdAt ?? null,
      updatedAt: table.updatedAt ?? null,
    };
  }

  static tableCollection(tables: RawTable[]): Partial<TableColumn>[] {
    return tables.map((t) => Resource.toTableJson(t)).filter(Boolean) as Partial<TableColumn>[];
  }
}

export default Resource;
