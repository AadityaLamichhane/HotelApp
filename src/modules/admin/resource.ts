// Frontend-facing shape for admins. Password hash NEVER leaves the backend.
export interface AdminColumn {
  id: number;
  email: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

type RawAdmin = {
  id: number;
  email: string;
  passwordHash?: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

class Resource {
  static toAdminJson(admin: Partial<RawAdmin> | null | undefined): Partial<AdminColumn> | null {
    if (!admin) return null;
    return {
      id: admin.id,
      email: admin.email,
      createdAt: admin.createdAt ?? null,
      updatedAt: admin.updatedAt ?? null,
    };
  }
}

export default Resource;
