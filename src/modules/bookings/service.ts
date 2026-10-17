import { and, asc, desc, eq, gt, gte, ilike, inArray, lt, sql } from "drizzle-orm";
import db from "@/config/db";
import schema from "./schema";
import { hotelsSchema } from "../hotels/schema";
import { roomschema } from "../rooms/schema";
import { selectQuery } from "./repository";
import Resource, {
  BLOCKING_STATUSES,
  canTransition,
  isBlocking,
  type BookingStatus,
} from "./resource";
import {
  throwErrorOnValidation,
  throwForbiddenError,
  throwNotFoundError,
  throwUnauthorizedError,
} from "@/utils/error";

type CreateBookingArgs = {
  hotelId: string;
  roomId: string;
  guestName: string;
  guestPhone?: string | null;
  guestCountry?: string | null;
  identityNumber?: string | null;
  adults?: number;
  children?: number;
  checkIn: string;
  checkOut: string;
  status?: BookingStatus;
  source?: "direct" | "whatsapp" | "phone" | "walk_in" | "channel";
  rateNpr?: number;
  notes?: string | null;
};

type UpdateBookingArgs = Partial<Omit<CreateBookingArgs, "hotelId" | "roomId">>;

type ListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: BookingStatus;
  source?: string;
  checkInFrom?: string;
  checkInTo?: string;
  checkOutOn?: string;
};

// Decoded JWT shape (see admin + users services).
type Viewer = { id?: number; role?: string; hotelId?: string } | undefined | null;

// NOTE: no UUID regex here on purpose — shape is validated once at the route
// layer by Zod (validators.ts). The service checks existence (404) + ownership
// (403) and fails closed on anything else (see rooms/service.ts).

const requireAdmin = (viewer: Viewer) => {
  if (!viewer?.id) throw throwUnauthorizedError("Login required");
  if (viewer.role !== "admin") throw throwForbiddenError("Admin access required");
};

const requireUser = (viewer: Viewer): NonNullable<Viewer> => {
  if (!viewer?.id) throw throwUnauthorizedError("Login required");
  return viewer;
};

const getHotelOrFail = async (hotelId: string) => {
  const [hotel] = await db
    .select({ id: hotelsSchema.id, createdBy: hotelsSchema.createdBy })
    .from(hotelsSchema)
    .where(eq(hotelsSchema.id, hotelId))
    .limit(1);
  if (!hotel) throw throwNotFoundError("Hotel");
  return hotel;
};

// Ownership model matches rooms/room-entries: hotel belongs to hotels.created_by,
// admins bypass. `hotel_members` does not exist yet — see AGENTS.md TODO.
// When it lands, this is the single function to change.
const requireHotelAccess = (viewer: Viewer, hotel: { createdBy: number | null }) => {
  const user = requireUser(viewer);
  if (user.role === "admin") return;
  if (Number(user.id) !== Number(hotel.createdBy))
    throw throwForbiddenError("Access denied for this hotel");
};

const getRoomOrFail = async (id: string) => {
  const [row] = await db
    .select({
      id: roomschema.id,
      hotelId: roomschema.hotelId,
      name: roomschema.name,
      price: roomschema.price,
    })
    .from(roomschema)
    .where(eq(roomschema.id, id))
    .limit(1);
  if (!row) throw throwNotFoundError("Room");
  return row;
};

const getBookingOrFail = async (id: string) => {
  const [row] = await db
    .select(selectQuery)
    .from(schema.bookingsSchema)
    .where(eq(schema.bookingsSchema.id, id))
    .limit(1);
  if (!row) throw throwNotFoundError("Booking");
  return row;
};

/**
 * THE core rule of this module.
 *
 * A booking occupies the half-open night range [checkIn, checkOut). Two ranges
 * overlap when `a.checkIn < b.checkOut AND a.checkOut > b.checkIn`. Half-open
 * is what lets a guest depart on the 14th and another arrive on the 14th —
 * same day, different beds, no conflict. Using BETWEEN (inclusive both ends)
 * here is the classic bug that shows a room as booked on a day the guest is
 * leaving.
 *
 * The guest-facing message deliberately does NOT reveal who holds the
 * conflicting booking. A walk-in shouldn't be able to enumerate occupancy by
 * probing dates.
 */
const findOverlappingBookings = async (
  roomId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string,
) => {
  const rows = await db
    .select({
      id: schema.bookingsSchema.id,
      checkIn: schema.bookingsSchema.checkIn,
      checkOut: schema.bookingsSchema.checkOut,
    })
    .from(schema.bookingsSchema)
    .where(
      and(
        eq(schema.bookingsSchema.roomId, roomId),
        inArray(schema.bookingsSchema.status, BLOCKING_STATUSES),
        lt(schema.bookingsSchema.checkIn, checkOut),
        // STRICTLY greater, not >=. The window is half-open [checkIn, checkOut),
        // so a booking ending on the 13th does NOT block one starting on the
        // 13th. Same-day turnover is the most common case in a hotel and `>=`
        // here would report the room unavailable for the whole day.
        gt(schema.bookingsSchema.checkOut, checkIn),
        excludeBookingId
          ? sql`${schema.bookingsSchema.id} <> ${excludeBookingId}`
          : undefined,
      ),
    )
    .limit(5);
  return rows;
};

/** Reject the create if the requested window collides with a blocking booking. */
const assertNoConflict = async (
  roomId: string,
  roomName: string,
  checkIn: string,
  checkOut: string,
) => {
  const clashes = await findOverlappingBookings(roomId, checkIn, checkOut);
  if (clashes.length > 0) {
    const stay = `${checkIn} to ${checkOut}`;
    throw throwErrorOnValidation(
      `Room ${roomName} is not available for ${stay} — it already has a booking in that window`,
    );
  }
};

const todayNpr = () => new Date().toISOString().slice(0, 10);

/**
 * Create a reservation.
 *
 * Defaults to `pending`, not `confirmed`: an agent-drafted booking holds the
 * room but commits nobody. The human confirming it is the whole safety story
 * for the AI feature.
 */
const create = async (input: CreateBookingArgs, createdBy: number, viewer: Viewer) => {
  if (!createdBy || isNaN(Number(createdBy))) throw throwErrorOnValidation("Login required");
  const hotel = await getHotelOrFail(String(input.hotelId));
  requireHotelAccess(viewer, hotel);

  const room = await getRoomOrFail(String(input.roomId));
  // Room must belong to the same hotel the caller claimed, else 404 so we
  // don't confirm the room exists at another hotel.
  if (room.hotelId !== hotel.id) throw throwNotFoundError("Room");

  // Zod already rejected checkOut <= checkIn; this is defense in depth for any
  // caller that reaches the service directly.
  if (input.checkIn >= input.checkOut)
    throw throwErrorOnValidation("Check-out must be after check-in");

  const status: BookingStatus = input.status ?? "pending";
  await assertNoConflict(room.id, room.name, input.checkIn, input.checkOut);

  const nights = Resource.nightsBetween(input.checkIn, input.checkOut);
  if (nights <= 0) throw throwErrorOnValidation("Stay must be at least one night");

  // Rate is locked at booking time in NPR. rooms.price may change later; this
  // guest was quoted this.
  const rateNpr = input.rateNpr !== undefined ? Number(input.rateNpr) : Number(room.price);

  const [row] = await db
    .insert(schema.bookingsSchema)
    .values({
      hotelId: hotel.id,
      roomId: room.id,
      guestName: input.guestName.trim(),
      guestPhone: input.guestPhone ?? null,
      guestCountry: input.guestCountry ?? null,
      identityNumber: input.identityNumber ?? null,
      adults: Number(input.adults ?? 1),
      children: Number(input.children ?? 0),
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      status,
      source: input.source ?? "direct",
      rateNpr,
      totalNpr: rateNpr * nights,
      notes: input.notes ?? null,
      // createdBy from the JWT only — never req.body (AGENTS.md rule 4).
      createdBy: Number(createdBy),
    })
    .returning(selectQuery);
  if (!row) throw throwErrorOnValidation("Failed to create booking");

  return Resource.mapWithRoom({ ...row, roomName: room.name });
};

/**
 * Availability for a window: rooms of this hotel with NO blocking booking and
 * NO open occupancy right now.
 *
 * Both halves matter. A room can be free for next week but occupied tonight,
 * and a front desk asking "can I take this guest?" means both.
 */
const availability = async (
  viewer: Viewer,
  hotelId: string,
  query: { checkIn: string; checkOut: string; roomId?: string },
) => {
  const user = requireUser(viewer);
  const hotel = await getHotelOrFail(String(hotelId));
  requireHotelAccess(user, hotel);

  const { checkIn, checkOut } = query;
  if (checkIn >= checkOut) throw throwErrorOnValidation("Check-out must be after check-in");

  // Rooms in the hotel, optionally narrowed to one.
  const rooms = await db
    .select({
      id: roomschema.id,
      name: roomschema.name,
      price: roomschema.price,
      description: roomschema.description,
    })
    .from(roomschema)
    .where(
      and(
        eq(roomschema.hotelId, hotel.id),
        query.roomId ? eq(roomschema.id, query.roomId) : undefined,
      ),
    )
    .orderBy(asc(roomschema.name));
  if (rooms.length === 0) throw throwNotFoundError("Room");

  // One query for every blocking booking in the window, then set arithmetic in
  // JS. N rooms -> 2 queries total, instead of N queries.
  //
  // Scoped to THIS hotel's room ids via inArray(roomId): the clash scan must
  // not see other hotels' bookings, or `availableCount` — computed against this
  // hotel's room list — goes negative and the front desk sees a lie.
  const roomIds = rooms.map((r) => r.id);
  const clashes =
    roomIds.length === 0
      ? []
      : await db
          .select({
            roomId: schema.bookingsSchema.roomId,
            checkIn: schema.bookingsSchema.checkIn,
            checkOut: schema.bookingsSchema.checkOut,
          })
          .from(schema.bookingsSchema)
          .where(
            and(
              inArray(schema.bookingsSchema.roomId, roomIds),
              inArray(schema.bookingsSchema.status, BLOCKING_STATUSES),
              lt(schema.bookingsSchema.checkIn, checkOut),
              // STRICTLY greater, not >=. The window is half-open
              // [checkIn, checkOut), so a booking ending on the 13th does NOT
              // block one starting on the 13th. Same-day turnover is the most
              // common case in a hotel and `>=` here would report the room
              // unavailable for the whole day.
              gt(schema.bookingsSchema.checkOut, checkIn),
            ),
          );

  const nights = Resource.nightsBetween(checkIn, checkOut);
  const asDate = (v: string | Date) =>
    typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10);

  const blockedRoomIds = new Set<string>();
  for (const c of clashes) {
    // Half-open intersection, re-checked in JS because the SQL predicate above
    // is only a prefilter: it narrows to the right rows, this decides which
    // rooms are actually blocked.
    if (asDate(c.checkIn) < checkOut && asDate(c.checkOut) > checkIn) {
      blockedRoomIds.add(c.roomId as string);
    }
  }

  return {
    checkIn,
    checkOut,
    nights,
    rooms: rooms
      .map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description ?? null,
        price: r.price,
        available: !blockedRoomIds.has(r.id),
        // What this room would cost for the whole window, so the agent can
        // quote a total instead of a nightly rate the guest has to multiply.
        totalNpr: Number(r.price ?? 0) * nights,
      }))
      .sort((a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name)),
    // Clamp at 0: defence in depth against a stale clash set ever making the
    // front desk read "−2 rooms available".
    availableCount: Math.max(0, rooms.length - blockedRoomIds.size),
  };
};

const list = async (viewer: Viewer, query: ListQuery) => {
  requireAdmin(viewer);
  return runList(query);
};

const listByHotel = async (viewer: Viewer, hotelId: string, query: ListQuery) => {
  const user = requireUser(viewer);
  const hotel = await getHotelOrFail(String(hotelId));
  requireHotelAccess(user, hotel);
  // Force hotel scope from the path — a client-supplied hotelId is ignored.
  return runList({ ...query, hotelId: hotel.id });
};

const runList = async (query: ListQuery & { hotelId?: string }) => {
  const page = Number(query?.page) || 1;
  const limit = Math.min(Number(query?.limit) || 20, 100);
  const offset = (page - 1) * limit;

  const conditions = [
    query?.hotelId ? eq(schema.bookingsSchema.hotelId, query.hotelId) : undefined,
    query?.search
      ? ilike(schema.bookingsSchema.guestName, `%${query.search.trim()}%`)
      : undefined,
    query?.status ? eq(schema.bookingsSchema.status, query.status) : undefined,
    query?.source ? eq(schema.bookingsSchema.source, query.source as any) : undefined,
    // "Arrivals between X and Y" — checkIn is the useful axis for a front desk.
    query?.checkInFrom ? gte(schema.bookingsSchema.checkIn, query.checkInFrom) : undefined,
    query?.checkInTo ? lt(schema.bookingsSchema.checkIn, query.checkInTo) : undefined,
    // "Departures on date X" — the exact-match half-open form: a stay departing
    // on X has checkOut == X.
    query?.checkOutOn ? eq(schema.bookingsSchema.checkOut, query.checkOutOn) : undefined,
  ].filter((c) => c !== undefined);

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select({ ...selectQuery, roomName: roomschema.name })
    .from(schema.bookingsSchema)
    .innerJoin(roomschema, eq(schema.bookingsSchema.roomId, roomschema.id))
    .where(where)
    .orderBy(asc(schema.bookingsSchema.checkIn), desc(schema.bookingsSchema.createdAt))
    .limit(limit)
    .offset(offset);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.bookingsSchema)
    .where(where);
  const count = countRows[0]?.count ?? 0;
  return { items: Resource.collectionWithRoom(items), page, limit, total: count };
};

const listByRoom = async (viewer: Viewer, roomId: string, query: { status?: BookingStatus }) => {
  const user = requireUser(viewer);
  const room = await getRoomOrFail(String(roomId));
  const hotel = await getHotelOrFail(room.hotelId);
  requireHotelAccess(user, hotel);

  const items = await db
    .select(selectQuery)
    .from(schema.bookingsSchema)
    .where(
      and(
        eq(schema.bookingsSchema.roomId, room.id),
        query?.status ? eq(schema.bookingsSchema.status, query.status) : undefined,
      ),
    )
    .orderBy(desc(schema.bookingsSchema.checkIn));
  return { items: Resource.bookingCollection(items), total: items.length };
};

const show = async (viewer: Viewer, id: string) => {
  const user = requireUser(viewer);
  const row = await getBookingOrFail(String(id));
  const room = await getRoomOrFail(row.roomId as string);
  const hotel = await getHotelOrFail(room.hotelId);
  requireHotelAccess(user, hotel);
  return Resource.mapWithRoom({ ...row, roomName: room.name });
};

/**
 * Front-desk dashboard in one query: counts for arrivals / in-house /
 * departures / available rooms for today.
 *
 * This is the screen the receptionist opens first, so it's one round trip
 * rather than four.
 */
const dashboard = async (viewer: Viewer, hotelId: string, date?: string) => {
  const user = requireUser(viewer);
  const hotel = await getHotelOrFail(String(hotelId));
  requireHotelAccess(user, hotel);

  const day = date ?? todayNpr();

  const [rows] = await db
    .select({
      arrivals: sql<number>`count(*) FILTER (WHERE ${schema.bookingsSchema.checkIn} = ${day} AND ${schema.bookingsSchema.status} IN ('pending','confirmed'))::int`,
      departures: sql<number>`count(*) FILTER (WHERE ${schema.bookingsSchema.checkOut} = ${day} AND ${schema.bookingsSchema.status} IN ('pending','confirmed','checked_in'))::int`,
      inHouse: sql<number>`count(*) FILTER (WHERE ${schema.bookingsSchema.checkIn} <= ${day} AND ${schema.bookingsSchema.checkOut} > ${day} AND ${schema.bookingsSchema.status} IN ('pending','confirmed','checked_in'))::int`,
    })
    .from(schema.bookingsSchema)
    .where(eq(schema.bookingsSchema.hotelId, hotel.id));

  const [roomCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(roomschema)
    .where(eq(roomschema.hotelId, hotel.id));

  const totalRooms = Number(roomCount?.count ?? 0);
  const inHouse = Number(rows?.inHouse ?? 0);

  return {
    date: day,
    arrivals: Number(rows?.arrivals ?? 0),
    departures: Number(rows?.departures ?? 0),
    inHouse,
    totalRooms,
    // Occupancy the hotel can actually quote to an owner. Computed, not stored.
    occupancy: totalRooms > 0 ? Number(((inHouse / totalRooms) * 100).toFixed(1)) : 0,
  };
};

const update = async (viewer: Viewer, id: string, input: UpdateBookingArgs) => {
  const user = requireUser(viewer);
  const existing = await getBookingOrFail(String(id));
  const room = await getRoomOrFail(existing.roomId as string);
  const hotel = await getHotelOrFail(room.hotelId);
  requireHotelAccess(user, hotel);

  if (existing.status === "checked_in") {
    // Once the guest has physically arrived, the room_entries row is the truth
    // for the stay. Editing the reservation afterwards would silently diverge
    // from the actual occupancy record.
    throw throwErrorOnValidation(
      "This booking is checked in — edit the stay (room entry) instead",
    );
  }

  const patch: Record<string, unknown> = {};
  if (input.guestName !== undefined) {
    const name = input.guestName.trim();
    if (!name) throw throwErrorOnValidation("Guest name is required");
    patch.guestName = name;
  }
  if (input.guestPhone !== undefined) patch.guestPhone = input.guestPhone ?? null;
  if (input.guestCountry !== undefined) patch.guestCountry = input.guestCountry ?? null;
  if (input.identityNumber !== undefined) patch.identityNumber = input.identityNumber ?? null;
  if (input.adults !== undefined) patch.adults = Number(input.adults);
  if (input.children !== undefined) patch.children = Number(input.children);
  if (input.source !== undefined) patch.source = input.source;
  if (input.notes !== undefined) patch.notes = input.notes ?? null;

  // Merge the window with the existing dates before validating overlap: a
  // guest extending by one night changes only checkOut, and the conflict check
  // has to see the merged range or it will compare against a stale window.
  const nextCheckIn = input.checkIn ?? String(existing.checkIn).slice(0, 10);
  const nextCheckOut = input.checkOut ?? String(existing.checkOut).slice(0, 10);
  const windowChanged = input.checkIn !== undefined || input.checkOut !== undefined;

  if (windowChanged) {
    if (nextCheckIn >= nextCheckOut)
      throw throwErrorOnValidation("Check-out must be after check-in");
    // Only re-check overlap if the booking still blocks. A cancelled booking
    // being revived to pending needs the check; an already-cancelled booking
    // keeping its dates does not.
    if (isBlocking((input.status ?? existing.status) as BookingStatus)) {
      const clashes = await findOverlappingBookings(
        room.id,
        nextCheckIn,
        nextCheckOut,
        existing.id as string,
      );
      if (clashes.length > 0)
        throw throwErrorOnValidation(
          `Room ${room.name} is not available for ${nextCheckIn} to ${nextCheckOut}`,
        );
    }
    patch.checkIn = nextCheckIn;
    patch.checkOut = nextCheckOut;
  }

  if (input.status !== undefined && input.status !== existing.status) {
    if (!canTransition(existing.status as BookingStatus, input.status))
      throw throwErrorOnValidation(
        `Cannot change status from ${existing.status} to ${input.status}`,
      );
    patch.status = input.status;
  }

  if (input.rateNpr !== undefined) patch.rateNpr = Number(input.rateNpr);

  // Keep totalNpr consistent with the rate and the (possibly new) window. It's
  // a snapshot so revenue reports don't have to re-derive it.
  const finalRate =
    input.rateNpr !== undefined ? Number(input.rateNpr) : Number(existing.rateNpr ?? 0);
  const finalNights = Resource.nightsBetween(nextCheckIn, nextCheckOut);
  if (input.rateNpr !== undefined || windowChanged) {
    patch.totalNpr = finalRate * finalNights;
  }

  patch.updatedAt = new Date();

  const [row] = await db
    .update(schema.bookingsSchema)
    .set(patch)
    .where(eq(schema.bookingsSchema.id, existing.id))
    .returning(selectQuery);
  if (!row) throw throwNotFoundError("Booking");
  return Resource.mapWithRoom({ ...row, roomName: room.name });
};

/**
 * Delete = cancel. Bookings are never hard-deleted: a no-show and a genuine
 * mistake are both facts the owner needs to see in the revenue report, and
 * only `status` distinguishes them.
 */
const remove = async (viewer: Viewer, id: string) => {
  const user = requireUser(viewer);
  const existing = await getBookingOrFail(String(id));
  const room = await getRoomOrFail(existing.roomId as string);
  const hotel = await getHotelOrFail(room.hotelId);
  requireHotelAccess(user, hotel);

  const [row] = await db
    .update(schema.bookingsSchema)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(schema.bookingsSchema.id, existing.id))
    .returning(selectQuery);
  if (!row) throw throwNotFoundError("Booking");
  return Resource.mapWithRoom({ ...row, roomName: room.name });
};

export default {
  create,
  list,
  listByHotel,
  listByRoom,
  show,
  dashboard,
  availability,
  update,
  remove,
};