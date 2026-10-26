import schema from "./schema";

export const selectMenuQuery = {
  id: schema.menusSchema.id,
  hotelId: schema.menusSchema.hotelId,
  name: schema.menusSchema.name,
  isActive: schema.menusSchema.isActive,
  createdBy: schema.menusSchema.createdBy,
  createdAt: schema.menusSchema.createdAt,
  updatedAt: schema.menusSchema.updatedAt,
};

export const selectMenuItemQuery = {
  id: schema.menuItemsSchema.id,
  menuId: schema.menuItemsSchema.menuId,
  name: schema.menuItemsSchema.name,
  description: schema.menuItemsSchema.description,
  price: schema.menuItemsSchema.price,
  category: schema.menuItemsSchema.category,
  isVeg: schema.menuItemsSchema.isVeg,
  isAvailable: schema.menuItemsSchema.isAvailable,
  imageUrl: schema.menuItemsSchema.imageUrl,
  sortOrder: schema.menuItemsSchema.sortOrder,
  createdAt: schema.menuItemsSchema.createdAt,
  updatedAt: schema.menuItemsSchema.updatedAt,
};
