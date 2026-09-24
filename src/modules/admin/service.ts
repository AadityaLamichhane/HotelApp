import { eq } from "drizzle-orm";
import db from "@/config/db";
import schema from "./schema";
import { adminAuthSelect } from "./repository";
import Resource from "./resource";
import { comparePassword } from "@/utils/hashPassword";
import Token from "@/utils/token";
import { throwUnauthorizedError } from "@/utils/error";

export const ADMIN_ROLE = "admin" as const;

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const login = async (input: { email: string; password: string }) => {
  const email = normalizeEmail(input.email);
  const row =
    (
      await db
        .select(adminAuthSelect)
        .from(schema.adminsSchema)
        .where(eq(schema.adminsSchema.email, email))
        .limit(1)
    )[0] ?? throwUnauthorizedError("Invalid email or password");
  const ok = await comparePassword(input.password, row.passwordHash);
  if (!ok) throwUnauthorizedError("Invalid email or password");
  // Role claim is what authCheckType: ["admin"] enforces downstream.
  const token = await Token.sign({ id: row.id, email: row.email, role: ADMIN_ROLE }, "7d");
  return { admin: Resource.toAdminJson(row), token };
};

export default { login, ADMIN_ROLE };
