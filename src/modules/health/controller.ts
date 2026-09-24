import type { IAuthRequest } from "@/routes";

/**
 * Health module — public, no auth. HotelManagement starter ships with
 * ONLY this and `db`; there is no admin module.
 */
const ping = async (_req: IAuthRequest) => {
  return { status: "ok", service: "hotelmanagement-api", timestamp: new Date().toISOString() };
};

export default { ping };
