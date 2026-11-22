# AGENTS.md — hotelSaas backend conventions (auth, roles, room scoping)

## Auth model (two JWT issuers, one verifier)

| Issuer | Login endpoint | JWT payload | Role |
|---|---|---|---|
| Admin | `POST /api/admin/login` (`src/modules/admin/*`) | `{ id, email, role: "admin" }` | `admin` |
| User | `POST /api/users/login`, `POST /api/users/signup` (`src/modules/users/*`) | `{ id, email, role: "user" }` | `user` |

- Signing: `Token.sign(payload, "7d")` (`src/utils/token.ts`, `JWT_SECRET` from `.env`).
- Verifying: `checkAuthentication(ctx, allowTo)` (`src/middlewares/checkAuthentication.ts`)
  reads the `Authorization: Bearer <jwt>` header, verifies it, populates
  `request.user` (the decoded payload), and — when `allowTo` is non-empty —
  rejects any token whose `role` is not in the list.
- Route wiring: `src/routes/index.ts` maps route flags to the middleware:
  `authorization: true` = any valid JWT; plus `authCheckType: ["admin"]` =
  admin JWT only. `src/routes/plugin.ts` `routeConfig` must list every module
  folder (`"admin"` is registered there).
- OAuth: `POST /api/users/oauth/google` (`src/modules/users/googleOAuth.ts`)
  verifies a Google `id_token` (signature, issuer, audience, expiry,
  `email_verified`), then `findOrCreateOAuthUser` links by
  `(provider, providerAccountId)` or verified email and mints the same user
  JWT. `users.password_hash` is nullable (`null` = OAuth-only); password
  login on such accounts returns 401. Accepted client IDs come from the
  comma-separated `GOOGLE_CLIENT_IDS` env var (empty = endpoint returns 503).
- **Error contract**: every deliberate failure is thrown as an `AppError`
  (`src/utils/error.ts`) carrying an `ERROR_CODES` key (`src/utils/errorCodes.ts`).
  `src/middlewares/errorHandler.ts` is the ONLY serializer:
  `{ success: false, error: "<CODE>", message: "<user-safe copy>", details? }`.
  Hooks (validation, rate limit, auth) throw instead of returning bodies, and
  404s come from Elysia's `NOT_FOUND` (`ROUTE_NOT_FOUND`). Never add a failure
  response shape anywhere else; never put internal prefixes (`UNAUTHORIZED:`,
  `NOT_FOUND:`) or raw provider text in `message`.

## ID model (all UUIDs)

- `hotels.id` is `uuid` PK with `.defaultRandom()` (`src/modules/hotels/attributes.ts`).
- `rooms.id` is `uuid` PK with `.defaultRandom()`; `rooms.hotel_id` is a `uuid`
  FK → `hotels.id`; `room_entries.room_id` is `uuid` (FK-free, matches
  `rooms.id`). See `src/modules/rooms/attributes.ts`.
- `users.id` stays `serial integer`; `hotels.created_by` / `rooms.created_by`
  are integers FK → `users.id`.
- All `:id` / `:hotelId` params and `hotelId` body/query fields validate as
  `z.string().uuid()` in the module `validators.ts` files.

## Rules for agents adding routes

1. **Admin-panel / cross-hotel endpoints** (sees ALL hotels) MUST carry BOTH flags:
   `{ authorization: true, authCheckType: ["admin"] }`.
2. **Hotel-user endpoints** MUST be hotel-scoped: take the hotel id from the PATH
   (`/hotels/:id/rooms` — note `:id`, not `:hotelId`, per rule 9), force
   `WHERE hotel_id = :id` in the service,
   and NEVER accept scope from query/body. `{ authorization: true }` with no
   `authCheckType` is enough; the service still checks ownership (below).
3. **Defense in depth**: admin-only services MUST re-check
   `viewer.role === "admin"` (see `requireAdmin` in
   `src/modules/rooms/service.ts`) so a future route misconfiguration can't
   leak cross-hotel data. Throw via `throwForbiddenError` (403) for wrong
   role, `throwUnauthorizedError` (401) for missing/invalid token.
4. **Never trust client identity**: `createdBy` / `role` / `hotelId`-as-identity
   always come from `req.user` (JWT), never from `req.body`.
5. **No public admin signup**: admins are seeded directly in the DB (below).
   Only `POST /api/admin/login` exists in `src/modules/admin/route.ts`.
6. **Ownership + staff model**: a hotel belongs to the user who created it
   (`hotels.created_by`) — that is the owner and implicitly has every
   permission. Other users get access through `hotel_staff` (one row per
   hotel+user) plus explicit `staff_permissions` grants. Every hotel-scoped
   route declares the permission it needs; the middleware resolves
   admin → owner → active staff, else 403. Services use the synchronous
   `authorizeHotelAccess` stamp (see "Staff & permission model").
7. **Validation lives in Zod, once**: services MUST NOT regex-check UUID shape —
   route validators own that. Services check existence (404) + ownership (403)
   and fail closed on anything else.
8. **Error helpers need explicit `throw`**: always call them as
   `throw throwNotFoundError(...)` (never bare). Bare calls don't narrow
   guards under the repo's strict TS config (`tsc --noEmit` must stay clean).
9. **Elysia/memoirist param naming (unlike Express)**: the radix-tree router
   allows only ONE param name per path position. `hotels/:id` already
   exists, so a nested route MUST reuse `:id` (`hotels/:id/rooms`), never
   `:hotelId` — `hotels/:hotelId/rooms` crashes at startup with
   `Cannot create route ... different parameter name ("id")`. Express
   allowed this (linear matching); Elysia does not. Rule: same position =
   same name. Validators/controllers then alias it
   (`const { id: hotelId } = req.params`).

## Hotel endpoints (current)

| Method + path | Access | Scope |
|---|---|---|
| `GET /api/hotels` (`?search=&page=&limit=`) | any logged-in user | own hotels only (admins: all) |
| `GET /api/hotels/:id` | any logged-in user | own hotel only, else 403 (admins: any) |
| `POST /api/hotels`, `PATCH /api/hotels/:id`, `DELETE /api/hotels/:id` | any logged-in user | create as self; update/delete own only, else 403 (admins: any) |

## Room endpoints (current)

| Method + path | Access | Scope |
|---|---|---|
| `GET /api/rooms` (`?hotelId=&search=&page=&limit=`) | admin only (`authCheckType: ["admin"]`) | all hotels; optional `hotelId` (uuid) filter |
| `GET /api/hotels/:id/rooms` (`?search=&page=&limit=`) | any logged-in user | ONLY owned hotel `:id` (forced from path, aliased to `hotelId` in controller/validator), else 403/404 |
| `GET /api/rooms/:id` | any logged-in user | own hotel's room only, else 403 (admins: any) |
| `POST /api/rooms` | any logged-in user | create only into owned hotel, else 403 (admins: any) |
| `PATCH /api/rooms/:id`, `DELETE /api/rooms/:id` | any logged-in user | own hotel's room only, else 403 (admins: any) |

## Seeding the first admin

No signup route exists, so insert directly (hash with the repo's helper):

```bash
bun -e 'import("./src/utils/hashPassword.ts").then(async m => console.log(await m.hashPassword("YOUR_STRONG_PASSWORD")))'
# then:
# INSERT INTO admins (email, password_hash) VALUES ('admin@example.com', '<hash above>');
```

After `drizzle-kit push`, login: `POST /api/admin/login`
`{ "email": "admin@example.com", "password": "..." }` →
`{ data: { admin, token }, message: "SUCCESS" }`. Use the token as
`Authorization: Bearer <token>` for `GET /api/rooms`.

## Occupancy model (read this before adding orders/items)

`rooms` is static inventory and holds NO occupancy truth. `rooms.is_available`
is only a convenience mirror for the dashboard grid — never read it to answer
"who is in this room". The authoritative record is `room_entries` (module
`src/modules/room-entries`), one row per guest-per-room-per-window:

- `status: 'open' | 'closed'` (pgEnum `room_entry_status`) is the single
  source of truth. "Open entry exists for room X" = room is occupied.
- Partial unique index `room_entries_one_open_per_room` on `room_id WHERE
  status = 'open'` — the DB-level guarantee that two clerks can't double-book
  a room concurrently. Verified: 6 parallel check-ins → exactly 1 wins.
- `room_rate` is the price locked at check-in; `rooms.price` may change after.
- `guest_id` is nullable — walk-ins exist before identity is known.
- Entries are NEVER hard-deleted. `DELETE /room-entries/:id` closes the entry
  (like a checkout) so the audit trail survives.
- `room_entries.room_id` now has a real FK → `rooms.id` (it was FK-free when
  it lived inside the rooms module).

**Orders must point at `room_entries.id`, never at (guestId, roomId).** That
temporal join is the whole reason this table exists.

### Room entry endpoints (current)

| Method + path | Access | Scope |
|---|---|---|
| `GET /api/room-entries` (`?hotelId=&search=&status=&page=&limit=`) | admin only | all hotels |
| `GET /api/hotels/:id/entries` (`?search=&status=&page=&limit=`) | any logged-in user | only owned hotel `:id` |
| `GET /api/room/:id/entries` (`?status=open\|closed`) | any logged-in user | own hotel's room only |
| `GET /api/room-entries/:id` | any logged-in user | own hotel's entry only |
| `POST /api/room-entries/check-in` | any logged-in user | 422 if room already has an open entry |
| `POST /api/room-entries/:id/check-out` | any logged-in user | own hotel's entry only; 422 if out < in |
| `PATCH /api/room-entries/:id` | any logged-in user | own hotel's entry only; 422 if closed |
| `DELETE /api/room-entries/:id` | any logged-in user | closes the entry (never deletes) |

Route paths note: entry ids are SERIAL INTEGERS while `rooms.id`/`hotels.id`
are uuids, so entries own `:id` as an integer param. `room/:id/entries` uses a
distinct first segment (`room`, singular) to stay clear of the uuid `:id`
already bound at that position by `rooms/:id`.

## Logistics endpoints (current)

Simple stock ledger (`src/modules/logistics`): one row per item ("Towel",
quantity 40). `room_id` is NULLABLE — null = general hotel stock; FK is
`ON DELETE SET NULL` so deleting a room returns its stock to general.
When `roomId` is sent, the service verifies the room belongs to the SAME
hotel (422 otherwise). Lists LEFT JOIN rooms to return `roomName`.

| Method + path | Access | Scope |
|---|---|---|
| `GET /api/logistics` (`?hotelId=&roomId=&search=&page=&limit=`) | admin only | all hotels |
| `GET /api/hotels/:id/logistics` (`?roomId=&search=&page=&limit=`) | any logged-in user | only owned hotel `:id` |
| `GET /api/logistics/:id` | any logged-in user | own hotel's item only |
| `POST /api/logistics` | any logged-in user | `{ hotelId, name, quantity, roomId? }`; create only into owned hotel |
| `PATCH /api/logistics/:id` | any logged-in user | `{ name?, quantity?, roomId? }`; `roomId: null` clears assignment |
| `DELETE /api/logistics/:id` | any logged-in user | hard delete (ledger row, no audit requirement yet) |

Migration `drizzle/0004_lush_starfox.sql` (additive CREATE TABLE only) was
applied directly via pg; verified with 26 live API tests incl. cross-hotel
403s, foreign-room 422, and admin gating. Frontend: `features/logistics`
+ `/hotels/:id/logistics` (bottom-sheet add/edit per frontend/AGENTS.md).

## Staff & permission model (current)

Three tables (`src/modules/staff`), all in `drizzle/0005_hotel_staff.sql`:

- `hotel_staff` — one row per `(hotel_id, user_id)` membership
  (`UNIQUE`), `role` = pgEnum `staff_role`, `is_active` boolean,
  `invited_by` nullable. FKs cascade on hotel/user delete.
- `permissions` — catalog keyed by `key` (e.g. `room.manage`), with
  `module` / `action` / `description`. Seeded from
  `PERMISSION_CATALOG` (`constants.ts`) both in the migration and lazily
  by `ensurePermissionCatalog()`.
- `staff_permissions` — explicit grants, `UNIQUE(staff_id, permission_id)`,
  cascade on staff/permission delete.

Roles are labels + default bundles only; **the explicit grant row is the
authority**. There is no `owner` role: owner is `hotels.created_by` and
always has all permissions. Admins (`role: "admin"`) bypass everything.
Permission keys: `hotel|staff|room|entry|booking|guest|menu|order|table|logistics|report`
× `.view|.manage`; `manage` implies `view` (`permissionSatisfied`).

**Route-level gate (one DB lookup per request).** Add to a route:

```ts
{
  authorization: true,
  permissions: ["room.manage"],            // ALL listed are required
  permissionHotelId: roomHotelIdResolver,  // resource id -> hotel id
}
```

`src/middlewares/checkPermission.ts` resolves admin → owner → active staff
and stamps `ctx.user.hotelAccess`. Services then call the synchronous
`authorizeHotelAccess(viewer, hotel, permission)` (`staff/access.ts`),
which reads that stamp and never queries again. Without a stamp (internal
call), it falls back to owner/admin only — staff grants are never assumed.
Hook order is rate limit → auth → validation → permission, so validation
errors (422) win before any hotel lookup.

| Method + path | Permission |
|---|---|
| `GET /api/staff/permissions/catalog` | any logged-in user |
| `GET /api/staff` (`?hotelId=&userId=&role=&permission=&isActive=&search=&page=&limit=`) | admin only |
| `GET /api/hotels/:id/staff` | `staff.view` |
| `GET /api/hotels/:id/staff/me` | any logged-in user (own effective access) |
| `GET /api/staff/:id` | `staff.view` |
| `POST /api/hotels/:id/staff` (`{ userId \| email, name?, password?, role?, permissions? }`) | `staff.manage` |
| `PATCH /api/staff/:id` (`{ role?, isActive?, permissions? }`) | `staff.manage` |
| `DELETE /api/staff/:id` | `staff.manage` |

Rules: owner cannot be added/deactivated/removed; only owner/admin can
assign `manager`; duplicate membership → 409; unknown email requires
`name`+`password` (creates the user) else 422; role change resets grants to
that role's defaults unless `permissions` is sent; explicit grants always
win. Every existing hotel-scoped route now declares `permissions` (see the
module `route.ts` files) — a new route without one is owner/admin-only by
default because no stamp is produced.

## Build order for the remaining work

The billing side hangs off `room_entries`. Build in this order; each slice is
independently demoable:

1. **DONE — room_entries** (this module).
2. `items` — the hotel's menu (`hotel_id`, name, price, category). Orders are
   meaningless without it.
3. `table_sessions` — same open/closed pattern for restaurant tables.
4. `orders` + `order_items` — `{ roomEntryId?, tableSessionId?, status }`,
   both FKs nullable. "Charge to room 204" is then just
   `UPDATE orders SET room_entry_id = ...`.
5. QR + live folio — resolve opaque token → `roomEntryId`/`tableSessionId`,
   create order, read `SUM(order_items)`. Needs 1–4.
6. Inventory — `inventory_items` + `stock_movements` (append-only event log,
   current stock = `SUM(quantity)` grouped). Independent of 1–5; can be
   parallel or last.

## Migration status

- **DONE — room_entries promoted** out of the rooms module to its own
  top-level module with FK → rooms.id, `status` enum, and the one-open-per-room
  partial unique index. `bun run db:push` applied (no data loss — the table
  was empty). `tsc --noEmit` clean; check-in/check-out/re-check-in,
  double-book rejection, date guard, cross-hotel 403, and the 6-way
  concurrent race were all exercised against the live DB.
- **DONE — UUID everywhere**: `hotels.id` got `.defaultRandom()`; `rooms.id`
  `serial → uuid`; `rooms.hotel_id` `integer → uuid`; `room_entries.room_id`
  `integer → uuid`; all validators/controllers/services/resources use uuid
  strings. `tsc --noEmit` is clean.
- **DONE — ownership scoping**: `requireHotelAccess` (created_by ownership,
  admin bypass) enforced on all hotel/room reads + writes; `GET /api/hotels`
  and `GET /api/hotels/:id` now require auth and are owner-scoped.
- **TODO — run the migration**: PK/FK types changed, so `bun run db:push`
  will recreate the `rooms`/`room_entries` tables (**existing room data is
  lost**) and alter `rooms.hotel_id`. Then re-test the
  login → create hotel → create room flow.
- **DONE — multi-staff hotels**: `hotel_staff` + `permissions` +
  `staff_permissions` (`drizzle/0005_hotel_staff.sql`, applied directly via
  pg; catalog seeded 21 rows). Permissions are resolved per request by the
  route middleware and stamped for synchronous service checks; no
  permissions are stored in the JWT. `tsc --noEmit` clean; live tests covered
  owner/manager/staff gates, default bundles, explicit grants, `manage`
  implying `view`, duplicate 409, owner protections, and removal.
- **TODO — old JWTs**: tokens issued before this change carry integer-style
  assumptions but no `hotelId`; they still authenticate (ownership resolves
  server-side from `created_by`, so no backfill needed). Users on very old
  tokens without `role` get 403 on admin routes and just re-login.

## Proposed follow-up changes (not yet done — in priority order)

1. **Run the migration**: `admins` table is new (`src/modules/admin/schema.ts`,
   exported from `src/config/db/schema.ts`). Run `bun run db:push` (or
   `db:generate` + migrate), then seed per above. Optional: add
   `ADMIN_EMAIL`/`ADMIN_PASSWORD` to `.env.example` + a `bun run db:seed:admin`
   script so seeding is one command.
2. **DONE — multi-staff hotels**: see "Staff & permission model" above.
3. **Backfill old user JWTs**: tokens issued before this change carry no
   `role`. They still authenticate (role is only checked when `authCheckType`
   is set) but will get 403 on admin routes. Users just re-login; consider
   shortening `expiresIn` or bumping a token version if forced rotation is
   needed.
