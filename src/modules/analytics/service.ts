import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import db from "@/config/db";
import { hotelsSchema } from "../hotels/schema";
import { roomschema } from "../rooms/schema";
import { roomEntrySchema } from "../room-entries/schema";
import { bookingsSchema } from "../bookings/schema";
import { authorizeHotelAccess } from "../staff/access";
import { throwNotFoundError, throwUnauthorizedError } from "@/utils/error";

type Viewer = { id?: number; role?: string } | undefined | null;

type OverviewQuery = { days?: number };

type TrendPoint = {
  /** Calendar day in the hotel timezone, YYYY-MM-DD. */
  date: string;
  /** Guests physically in a room that day (entries overlapping the day). */
  guests: number;
  /** New stays opened that day. */
  checkIns: number;
};

/**
 * Nepal has a fixed UTC+05:45 offset and no DST, so day boundaries can be
 * pinned to a literal offset instead of a timezone database lookup. The
 * `room_entries` timestamps are `timestamp` (no tz), written by `new Date()`,
 * so we compare them against the same instants.
 */
const NPR_OFFSET = "+05:45";

const nprDay = (date: Date = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

/** Start of a calendar day in Nepal, as an absolute instant. */
const dayStart = (day: string): Date => new Date(`${day}T00:00:00${NPR_OFFSET}`);

/** Pure calendar arithmetic on a YYYY-MM-DD string. */
const shiftDay = (day: string, delta: number): string => {
  const [yearStr, monthStr, dateStr] = day.split("-");
  const year = Number(yearStr) || 1970;
  const month = Number(monthStr) || 1;
  const date = Number(dateStr) || 1;
  const shifted = new Date(Date.UTC(year, month - 1, date));
  shifted.setUTCDate(shifted.getUTCDate() + delta);
  return shifted.toISOString().slice(0, 10);
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

/**
 * Everything the home screen needs in one round trip.
 *
 * Occupancy numbers come from `room_entries` (the only source of truth for
 * "who is in a room"), NOT from `rooms.is_available`. Reservation numbers come
 * from `bookings` and are reported separately so the UI can label them
 * honestly as arrivals/departures rather than pretending they are in-house
 * guests.
 */
const overview = async (viewer: Viewer, hotelId: string, query: OverviewQuery = {}) => {
  const user = requireUser(viewer);
  const hotel = await getHotelOrFail(String(hotelId));
  authorizeHotelAccess(user, hotel, "report.view");

  const days = Math.min(Math.max(Number(query.days) || 7, 1), 30);
  const today = nprDay();
  const todayStart = dayStart(today);
  const tomorrowStart = dayStart(shiftDay(today, 1));

  const [totals] = await db
    .select({
      openRooms: sql<number>`count(*) FILTER (WHERE ${roomEntrySchema.status} = 'open')::int`,
      inHouseGuests: sql<number>`coalesce(sum(${roomEntrySchema.numberOfguest}) FILTER (WHERE ${roomEntrySchema.status} = 'open'), 0)::int`,
      guestsBooked: sql<number>`coalesce(sum(${roomEntrySchema.numberOfguest}), 0)::int`,
      totalStays: sql<number>`count(*)::int`,
      checkedInToday: sql<number>`count(*) FILTER (WHERE ${roomEntrySchema.checkInDate} >= ${todayStart} AND ${roomEntrySchema.checkInDate} < ${tomorrowStart})::int`,
      checkedOutToday: sql<number>`count(*) FILTER (WHERE ${roomEntrySchema.status} = 'closed' AND ${roomEntrySchema.checkOutDate} >= ${todayStart} AND ${roomEntrySchema.checkOutDate} < ${tomorrowStart})::int`,
      collectedNpr: sql<number>`coalesce(sum(${roomEntrySchema.paidAmount}), 0)::int`,
    })
    .from(roomEntrySchema)
    .innerJoin(roomschema, eq(roomEntrySchema.roomId, roomschema.id))
    .where(eq(roomschema.hotelId, hotel.id));

  const [roomCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(roomschema)
    .where(eq(roomschema.hotelId, hotel.id));

  const [reservations] = await db
    .select({
      arrivalsToday: sql<number>`count(*) FILTER (WHERE ${bookingsSchema.checkIn} = ${today}::date AND ${bookingsSchema.status} IN ('pending','confirmed'))::int`,
      departuresToday: sql<number>`count(*) FILTER (WHERE ${bookingsSchema.checkOut} = ${today}::date AND ${bookingsSchema.status} IN ('pending','confirmed','checked_in'))::int`,
      upcoming: sql<number>`count(*) FILTER (WHERE ${bookingsSchema.checkIn} > ${today}::date AND ${bookingsSchema.status} IN ('pending','confirmed'))::int`,
    })
    .from(bookingsSchema)
    .where(eq(bookingsSchema.hotelId, hotel.id));

  const totalRooms = Number(roomCount?.count ?? 0);
  const occupiedRooms = Number(totals?.openRooms ?? 0);
  const occupancyRate =
    totalRooms > 0 ? Number(((occupiedRooms / totalRooms) * 100).toFixed(1)) : 0;

  // One read for the whole trend window: every entry that overlaps it. Small
  // enough (<= 30 days) to bucket in JS, and it avoids a generate_series
  // query that would need its own timezone handling.
  const trendStartDay = shiftDay(today, -(days - 1));
  const trendStart = dayStart(trendStartDay);
  const trendEnd = tomorrowStart;

  const trendRows = await db
    .select({
      checkInDate: roomEntrySchema.checkInDate,
      checkOutDate: roomEntrySchema.checkOutDate,
      numberOfguest: roomEntrySchema.numberOfguest,
    })
    .from(roomEntrySchema)
    .innerJoin(roomschema, eq(roomEntrySchema.roomId, roomschema.id))
    .where(
      and(
        eq(roomschema.hotelId, hotel.id),
        lt(roomEntrySchema.checkInDate, trendEnd),
        or(isNull(roomEntrySchema.checkOutDate), gt(roomEntrySchema.checkOutDate, trendStart)),
      ),
    );

  const trend: TrendPoint[] = [];
  for (let index = 0; index < days; index += 1) {
    const day = shiftDay(trendStartDay, index);
    const start = dayStart(day);
    const end = dayStart(shiftDay(day, 1));

    let guests = 0;
    let checkIns = 0;
    for (const row of trendRows) {
      const checkIn = row.checkInDate as Date;
      if (checkIn >= start && checkIn < end) checkIns += 1;
      // Half-open overlap: the guest is here if the stay started before the
      // day ended and had not ended when the day started. A null check-out is
      // an open stay, i.e. still in house.
      const checkOut = row.checkOutDate as Date | null;
      if (checkIn < end && (checkOut === null || checkOut > start)) {
        guests += Number(row.numberOfguest ?? 0);
      }
    }

    trend.push({ date: day, guests, checkIns });
  }

  return {
    hotelId: hotel.id,
    today,
    generatedAt: new Date().toISOString(),
    guests: {
      inHouse: Number(totals?.inHouseGuests ?? 0),
      inHouseRooms: occupiedRooms,
      checkedInToday: Number(totals?.checkedInToday ?? 0),
      checkedOutToday: Number(totals?.checkedOutToday ?? 0),
      totalBooked: Number(totals?.guestsBooked ?? 0),
      totalStays: Number(totals?.totalStays ?? 0),
    },
    rooms: {
      total: totalRooms,
      occupied: occupiedRooms,
      available: Math.max(0, totalRooms - occupiedRooms),
      occupancyRate,
    },
    reservations: {
      arrivalsToday: Number(reservations?.arrivalsToday ?? 0),
      departuresToday: Number(reservations?.departuresToday ?? 0),
      upcoming: Number(reservations?.upcoming ?? 0),
    },
    revenue: {
      /** Everything collected against stays (advances + settlement). */
      collectedNpr: Number(totals?.collectedNpr ?? 0),
    },
    trend,
  };
};

export default { overview };
export type { TrendPoint };
