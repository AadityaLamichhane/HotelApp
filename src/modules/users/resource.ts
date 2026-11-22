// Frontend-facing shape for users. Password hash NEVER leaves the backend:
// toUserJson only picks whitelisted columns, so responses stay safe even
// if a service accidentally returns the full row.
export interface UserColumn {
  id: number;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

type RawUser = {
  id: number;
  email: string;
  passwordHash?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

class Resource {
  static toUserJson(user: Partial<RawUser> | null | undefined): Partial<UserColumn> | null {
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      avatarUrl: user.avatarUrl ?? null,
      createdAt: user.createdAt ?? null,
      updatedAt: user.updatedAt ?? null,
    };
  }

  static userCollection(users: Partial<RawUser>[]): Partial<UserColumn>[] {
    return users.map((u) => Resource.toUserJson(u)).filter(Boolean) as Partial<UserColumn>[];
  }
}

export default Resource;
