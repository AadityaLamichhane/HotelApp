import type { IAuthRequest } from "@/routes";
import Service from "./service";

// Thin controller: pull from req, delegate to Service.
const login = async (req: IAuthRequest) => Service.login(req.body);

export default { login };
