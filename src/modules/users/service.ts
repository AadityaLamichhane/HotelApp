import { eq, ilike, sql } from "drizzle-orm";
import db from "@/config/db";
import schema from "./schema";
import { publicUserSelect, userAuthSelect } from "./repository";
import Resource from "./resource";
import { hashPassword, comparePassword } from "@/utils/hashPassword";
import Token from "@/utils/token";
import {
  throwErrorOnValidation,
  throwNotFoundError,
  throwUnauthorizedError,
} from "@/utils/error";

type PaginationQuery = { page?: number; limit?: number; search?: string };

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const signup = async (input: { email: string; password: string }) => {
  const email = normalizeEmail(input.email);
  const existing = await db
    .select({ id: schema.usersSchema.id })
    .from(schema.usersSchema)
    .where(eq(schema.usersSchema.email, email))
    .limit(1);
  if (existing.length > 0) throwErrorOnValidation("Email already registered");

  const passwordHash = await hashPassword(input.password);
  const created =
    (
      await db.insert(schema.usersSchema).values({ email, passwordHash }).returning(publicUserSelect)
    )[0] ?? throwErrorOnValidation("Failed to create user");
  const token = await Token.sign({ id: created.id, email: created.email, role: "user" }, "7d");
  return { user: Resource.toUserJson(created), token };
};

const login = async (input: { email: string; password: string }) => {
  const email = normalizeEmail(input.email);
  const row =
    (
      await db
        .select(userAuthSelect)
        .from(schema.usersSchema)
        .where(eq(schema.usersSchema.email, email))
        .limit(1)
    )[0] ?? throwUnauthorizedError("Invalid email or password");
  const ok = await comparePassword(input.password, row.passwordHash);
  if (!ok) throwUnauthorizedError("Invalid email or password");
  const token = await Token.sign({ id: row.id, email: row.email, role: "user" }, "7d");
  return { user: Resource.toUserJson(row), token };
};

const me = async (userId: number) => {
  const [row] = await db
    .select(publicUserSelect)
    .from(schema.usersSchema)
    .where(eq(schema.usersSchema.id, userId))
    .limit(1);
  if (!row) throwNotFoundError("User");
  return Resource.toUserJson(row);
};

const list = async (query: PaginationQuery) => {
  const page = Number(query?.page) || 1;
  const limit = Math.min(Number(query?.limit) || 10, 100);
  const offset = (page - 1) * limit;

  const where = query?.search
    ? ilike(schema.usersSchema.email, `%${query.search.trim()}%`)
    : undefined;
  const items = await db
    .select(publicUserSelect)
    .from(schema.usersSchema)
    .where(where)
    .limit(limit)
    .offset(offset);
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.usersSchema)
    .where(where);
  const count = countRows[0]?.count ?? 0;
  return { items: Resource.userCollection(items), page, limit, total: count };
};

export default { signup, login, me, list };
