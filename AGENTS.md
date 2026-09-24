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
2. **Hotel-user endpoints** MUST be hotel-scoped: take `hotelId` from the PATH
   (`/hotels/:hotelId/...`), force `WHERE hotel_id = :hotelId` in the service,
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
6. **Ownership model (no membership table yet)**: a hotel belongs to the user
   who created it (`hotels.created_by`). Every hotel/room read/write resolves
   its hotel and enforces `viewer.role === "admin" OR hotel.created_by ===
   viewer.id`, else 403 (`requireHotelAccess` in hotels/rooms services).
7. **Validation lives in Zod, once**: services MUST NOT regex-check UUID shape —
   route validators own that. Services check existence (404) + ownership (403)
   and fail closed on anything else.
8. **Error helpers need explicit `throw`**: always call them as
   `throw throwNotFoundError(...)` (never bare). Bare calls don't narrow
   guards under the repo's strict TS config (`tsc --noEmit` must stay clean).

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
| `GET /api/hotels/:hotelId/rooms` (`?search=&page=&limit=`) | any logged-in user | ONLY owned `hotelId` (forced from path), else 403/404 |
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

## Migration status

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
- **TODO — multi-staff hotels**: ownership is single-owner (`created_by`).
  For multiple users per hotel, add a `hotel_members(hotel_id, user_id,
  role)` join table, include `hotelId` in the user JWT at login, and switch
  `requireHotelAccess` to a membership lookup.
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
2. **Multi-staff hotels** (see TODO above): `hotel_members` join table + JWT
   `hotelId` + membership lookup in `requireHotelAccess`.
3. **Backfill old user JWTs**: tokens issued before this change carry no
   `role`. They still authenticate (role is only checked when `authCheckType`
   is set) but will get 403 on admin routes. Users just re-login; consider
   shortening `expiresIn` or bumping a token version if forced rotation is
   needed.
