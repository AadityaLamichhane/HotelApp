import type { MenuItemRow, MenuRow } from "./schema";

export interface MenuColumn {
  id: string;
  hotelId: string;
  hotelName?: string | null;
  name: string;
  isActive: boolean | null;
  createdBy: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface MenuItemColumn {
  id: string;
  menuId: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  isVeg: boolean | null;
  isAvailable: boolean | null;
  imageUrl: string | null;
  sortOrder: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

type RawMenu = Partial<MenuRow> & { hotelName?: string | null };
type RawMenuItem = Partial<MenuItemRow>;

class Resource {
  static toMenuJson(menu: RawMenu | null | undefined): Partial<MenuColumn> | null {
    if (!menu) return null;
    return {
      id: menu.id,
      hotelId: menu.hotelId,
      name: menu.name,
      isActive: menu.isActive ?? null,
      createdBy: menu.createdBy ?? null,
      createdAt: menu.createdAt ?? null,
      updatedAt: menu.updatedAt ?? null,
    };
  }

  static toMenuWithHotelJson(menu: RawMenu | null | undefined) {
    const json = Resource.toMenuJson(menu);
    if (!json) return null;
    return { ...json, hotelName: menu?.hotelName ?? null };
  }

  static toMenuItemJson(item: RawMenuItem | null | undefined): Partial<MenuItemColumn> | null {
    if (!item) return null;
    return {
      id: item.id,
      menuId: item.menuId,
      name: item.name,
      description: item.description ?? null,
      price: item.price,
      category: item.category,
      isVeg: item.isVeg ?? null,
      isAvailable: item.isAvailable ?? null,
      imageUrl: item.imageUrl ?? null,
      sortOrder: item.sortOrder ?? null,
      createdAt: item.createdAt ?? null,
      updatedAt: item.updatedAt ?? null,
    };
  }

  static menuCollection(menus: RawMenu[]) {
    return menus
      .map((m) => Resource.toMenuWithHotelJson(m))
      .filter(Boolean) as Partial<MenuColumn>[];
  }

  static menuItemCollection(items: RawMenuItem[]) {
    return items
      .map((i) => Resource.toMenuItemJson(i))
      .filter(Boolean) as Partial<MenuItemColumn>[];
  }

  // Menu detail shape: menu fields + its items. Kept flat (items ungrouped)
  // so the client can group by `category`/`sortOrder` however it likes.
  static toMenuWithItemsJson(
    menu: RawMenu | null | undefined,
    items: RawMenuItem[],
  ) {
    return {
      menu: Resource.toMenuJson(menu),
      items: Resource.menuItemCollection(items),
    };
  }
}

export default Resource;
