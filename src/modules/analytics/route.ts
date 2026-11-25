import Controller from "./controller";
import { validate } from "@/middlewares/zodValidation";
import { hotelOverviewValidationSchema } from "./validators";

/**
 * Front-desk overview = the numbers the home screen puts above the fold.
 *
 * Deliberately separate from `GET /hotels/:id/dashboard` (bookings): that
 * endpoint reports RESERVATIONS, which are a claim on future dates. This one
 * reports actual occupancy from `room_entries` — the authoritative source
 * (see backend/AGENTS.md "Occupancy model") — plus the reservation counts, so
 * the home screen never shows zeros while guests are checked in.
 */
const routes = [
  {
    method: "get",
    path: "hotels/:id/overview",
    controller: Controller.overview,
    authorization: true,
    permissions: ["report.view"],
    validation: validate(hotelOverviewValidationSchema),
  },
];

export default routes;
