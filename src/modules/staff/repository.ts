import { hotelsSchema } from "../hotels/schema";
import { usersSchema } from "../users/schema";
import schema from "./schema";

export const staffSelect = {
  id: schema.hotelStaffSchema.id,
  hotelId: schema.hotelStaffSchema.hotelId,
  userId: schema.hotelStaffSchema.userId,
  role: schema.hotelStaffSchema.role,
  isActive: schema.hotelStaffSchema.isActive,
  invitedBy: schema.hotelStaffSchema.invitedBy,
  createdAt: schema.hotelStaffSchema.createdAt,
  updatedAt: schema.hotelStaffSchema.updatedAt,
};

// Staff lists always join the user + hotel so the UI can render
// "Sita (sita@example.com) — Front Desk" without N+1 requests.
export const staffWithUserSelect = {
  ...staffSelect,
  hotelName: hotelsSchema.name,
  userEmail: usersSchema.email,
  userName: usersSchema.name,
  userAvatarUrl: usersSchema.avatarUrl,
};
