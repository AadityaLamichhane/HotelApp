import { z } from "zod";

// hotels.id is a uuid PK. The hotel id is forced from the path, never the
// query — see backend/AGENTS.md rule 2.
export const hotelOverviewValidationSchema = z.object({
  params: z.object({ id: z.string().uuid("Valid hotel id is required") }),
  query: z
    .object({
      // Number of days in the occupancy trend, including today.
      days: z.coerce.number().int().min(1).max(30).default(7),
    })
    .optional(),
});
