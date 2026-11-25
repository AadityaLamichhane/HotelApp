import type { IAuthRequest } from "@/routes";
import Service from "./service";

// HOTEL-SCOPED — hotelId forced from the path (`:id`), never from query/body.
// The route middleware already resolved `report.view`; the service re-checks
// ownership via the stamped hotelAccess.
const overview = async (req: IAuthRequest) => {
  const { id: hotelId } = req.params ?? {};
  const days = req?.query?.days;
  return Service.overview(req.user, String(hotelId), {
    days: days === undefined ? undefined : Number(days),
  });
};

export default { overview };
