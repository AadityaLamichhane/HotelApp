// Staff roles are LABELS + default permission bundles. The authoritative
// check is always the explicit `staff_permissions` grant, never the role.
//
// There is deliberately no "owner" role: `hotels.created_by` is the owner,
// it is derived at request time, and it always has every permission.
export const STAFF_ROLES = [
  "manager",
  "front_desk",
  "housekeeping",
  "maintenance",
  "accountant",
  "staff",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

// `manage` implies `view` (enforced by permissionSatisfied below), so the
// defaults below never need to list both for the same module.
export const STAFF_PERMISSIONS = [
  "hotel.view",
  "hotel.manage",
  "staff.view",
  "staff.manage",
  "room.view",
  "room.manage",
  "entry.view",
  "entry.manage",
  "booking.view",
  "booking.manage",
  "guest.view",
  "guest.manage",
  "menu.view",
  "menu.manage",
  "order.view",
  "order.manage",
  "table.view",
  "table.manage",
  "logistics.view",
  "logistics.manage",
  "report.view",
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

/**
 * Seed data for the `permissions` catalog table. Keeping the catalog in the
 * DB (instead of an enum on the grant row) means permissions have stable
 * integer ids the frontend can submit, and adding one is a data change.
 */
export const PERMISSION_CATALOG: ReadonlyArray<{
  key: StaffPermission;
  module: string;
  action: string;
  description: string;
}> = STAFF_PERMISSIONS.map((key) => {
  const [module, action] = key.split(".") as [string, string];
  return {
    key,
    module,
    action,
    description: `${module.charAt(0).toUpperCase()}${module.slice(1)} ${action} access`,
  };
});

export const ALL_PERMISSIONS: readonly StaffPermission[] = STAFF_PERMISSIONS;

const ALL = [...STAFF_PERMISSIONS];

export const ROLE_DEFAULT_PERMISSIONS: Record<StaffRole, readonly StaffPermission[]> = {
  // Managers run the hotel day-to-day; only the owner can change hotel
  // settings/delete it.
  manager: ALL.filter((p) => p !== "hotel.manage"),
  front_desk: [
    "hotel.view",
    "staff.view",
    "room.view",
    "entry.view",
    "entry.manage",
    "booking.view",
    "booking.manage",
    "guest.view",
    "guest.manage",
    "menu.view",
    "order.view",
    "order.manage",
    "table.view",
    "table.manage",
    "report.view",
  ],
  housekeeping: ["hotel.view", "room.view", "entry.view", "logistics.view", "logistics.manage"],
  maintenance: ["hotel.view", "room.view", "logistics.view", "logistics.manage"],
  accountant: ["hotel.view", "room.view", "booking.view", "order.view", "report.view"],
  staff: ["hotel.view"],
};

/**
 * `manage` is a superset of `view` for the same module, so a route that
 * requires `room.view` is satisfied by a `room.manage` grant. This keeps
 * permission rows minimal and stops a mis-seeded row from producing a
 * half-granted staff member.
 */
export const permissionSatisfied = (
  granted: readonly string[],
  required: StaffPermission,
): boolean => {
  if (granted.includes(required)) return true;
  if (required.endsWith(".view")) {
    const manage = `${required.slice(0, -".view".length)}.manage`;
    return granted.includes(manage);
  }
  return false;
};
