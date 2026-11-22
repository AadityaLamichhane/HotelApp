import type { OrderRow } from "./schema";

export interface OrderColumn {
  id: number;
  guestId: number | null;
  roomEntryId: number | null;
  hotelId: string;
  itemName: string;
  quantity: number;
  unitPriceNpr: number;
  totalNpr: number;
  status: "pending" | "preparing" | "served" | "cancelled";
  notes: string | null;
  createdBy: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface OrderWithDetails extends OrderColumn {
  tableName?: string | null;
  guestName?: string | null;
  roomName?: string | null;
}

type RawOrder = Partial<OrderRow> & {
  tableName?: string | null;
  guestName?: string | null;
  roomName?: string | null;
};

class Resource {
  static toOrderJson(order: RawOrder | null | undefined): Partial<OrderColumn> | null {
    if (!order) return null;
    return {
      id: order.id as number,
      guestId: order.guestId != null ? Number(order.guestId) : null,
      roomEntryId: order.roomEntryId != null ? Number(order.roomEntryId) : null,
      hotelId: order.hotelId as string,
      itemName: order.itemName as string,
      quantity: order.quantity ?? 1,
      unitPriceNpr: order.unitPriceNpr ?? 0,
      totalNpr: order.totalNpr ?? 0,
      status: order.status as "pending" | "preparing" | "served" | "cancelled",
      notes: order.notes ?? null,
      createdBy: order.createdBy ?? null,
      createdAt: order.createdAt ?? null,
      updatedAt: order.updatedAt ?? null,
    };
  }

  static orderCollection(orders: RawOrder[]): Partial<OrderColumn>[] {
    return orders
      .map((o) => Resource.toOrderJson(o))
      .filter(Boolean) as Partial<OrderColumn>[];
  }

  static mapWithDetails(row: RawOrder): OrderWithDetails {
    return {
      ...(Resource.toOrderJson(row) as OrderColumn),
      tableName: row.tableName ?? null,
      guestName: row.guestName ?? null,
      roomName: row.roomName ?? null,
    };
  }

  static collectionWithDetails(rows: RawOrder[]): OrderWithDetails[] {
    return rows.map((r) => Resource.mapWithDetails(r));
  }
}

export default Resource;
