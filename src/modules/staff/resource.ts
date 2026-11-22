import type { StaffRole } from "./constants";

export interface StaffColumn {
  id: string;
  hotelId: string;
  hotelName: string | null;
  userId: number;
  role: StaffRole;
  isActive: boolean;
  permissions: string[];
  user: {
    id: number;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
  } | null;
  invitedBy: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

type RawStaff = {
  id: string;
  hotelId: string;
  userId: number;
  role: StaffRole;
  isActive: boolean;
  invitedBy: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  hotelName?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userAvatarUrl?: string | null;
};

class Resource {
  static toStaffJson(
    row: RawStaff | null | undefined,
    permissions: string[] = [],
  ): Partial<StaffColumn> | null {
    if (!row) return null;
    return {
      id: row.id,
      hotelId: row.hotelId,
      hotelName: row.hotelName ?? null,
      userId: row.userId,
      role: row.role,
      isActive: row.isActive,
      permissions: [...permissions],
      user: {
        id: row.userId,
        email: row.userEmail ?? null,
        name: row.userName ?? null,
        avatarUrl: row.userAvatarUrl ?? null,
      },
      invitedBy: row.invitedBy ?? null,
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
    };
  }

  static staffCollection(
    rows: RawStaff[],
    permissionsByStaff: Map<string, string[]>,
  ): Partial<StaffColumn>[] {
    return rows
      .map((row) => Resource.toStaffJson(row, permissionsByStaff.get(row.id) ?? []))
      .filter(Boolean) as Partial<StaffColumn>[];
  }
}

export default Resource;
