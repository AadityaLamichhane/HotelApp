import jwt from "jsonwebtoken";
import env from "../config/env";

const sign = async (params: any, expiresIn: string) => {
  // @ts-ignore jwt types accept string
  return jwt.sign(params, env.JWT_SECRET, { expiresIn });
};

const verify = async (token: any) => {
  const splitToken: any = token.split(" ").pop();
  const decoded: any = jwt.verify(splitToken, env.JWT_SECRET || "");
  return decoded?.id ? decoded : null;
};

export default { sign, verify };
