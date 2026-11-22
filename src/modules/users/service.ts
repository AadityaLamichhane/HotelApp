import { and, eq, ilike, sql } from "drizzle-orm";
import db from "@/config/db";
import schema from "./schema";
import { publicUserSelect, userAuthSelect } from "./repository";
import Resource from "./resource";
import { hashPassword, comparePassword } from "@/utils/hashPassword";
import Token from "@/utils/token";
import { verifyGoogleIdToken } from "./googleOAuth";
import type { VerifiedOAuthProfile } from "./oauthTypes";
import {
  throwConflictError,
  throwErrorOnValidation,
  throwNotFoundError,
  throwUnauthorizedError,
} from "@/utils/error";
import { ERROR_CODES } from "@/utils/errorCodes";

type PaginationQuery = { page?: number; limit?: number; search?: string };

type PublicUser = {
  id: number;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const tokenFor = (user: { id: number; email: string }) =>
  Token.sign({ id: user.id, email: user.email, role: "user" }, "7d");

/**
 * Staged-auth lookup. `hasPassword` is false for Google-only accounts, so the
 * client can hide the password field and point at the Google button instead.
 * No profile fields leave this endpoint — only whether the email is known.
 */
export type EmailLookupResult = { exists: boolean; hasPassword: boolean };

const emailLookup = async (input: { email: string }): Promise<EmailLookupResult> => {
  const email = normalizeEmail(input.email);
  const [row] = await db
    .select({ passwordHash: schema.usersSchema.passwordHash })
    .from(schema.usersSchema)
    .where(eq(schema.usersSchema.email, email))
    .limit(1);

  return {
    exists: row !== undefined,
    hasPassword: Boolean(row?.passwordHash),
  };
};

const signup = async (input: { email: string; password: string }) => {
  const email = normalizeEmail(input.email);
  const existing = await db
    .select({ id: schema.usersSchema.id })
    .from(schema.usersSchema)
    .where(eq(schema.usersSchema.email, email))
    .limit(1);
  if (existing.length > 0) {
    throw throwConflictError(
      "An account with this email already exists",
      ERROR_CODES.AUTH_EMAIL_TAKEN,
    );
  }

  const passwordHash = await hashPassword(input.password);
  const created =
    (
      await db.insert(schema.usersSchema).values({ email, passwordHash }).returning(publicUserSelect)
    )[0] ?? throwErrorOnValidation("Failed to create user");
  const token = await tokenFor(created);
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
    )[0] ??
    throwUnauthorizedError("Invalid email or password", ERROR_CODES.AUTH_INVALID_CREDENTIALS);
  // OAuth-only accounts have no password. Never call bcrypt with null.
  if (!row.passwordHash) {
    throw throwUnauthorizedError(
      "This account uses Google sign-in",
      ERROR_CODES.AUTH_ACCOUNT_USES_GOOGLE,
    );
  }
  const ok = await comparePassword(input.password, row.passwordHash);
  if (!ok) {
    throw throwUnauthorizedError("Invalid email or password", ERROR_CODES.AUTH_INVALID_CREDENTIALS);
  }
  const token = await tokenFor(row);
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

const refreshOAuthProfile = async (user: PublicUser, profile: VerifiedOAuthProfile) => {
  const patch: Partial<Pick<PublicUser, "name" | "avatarUrl" | "updatedAt">> = {};
  if (profile.name && profile.name !== user.name) patch.name = profile.name;
  if (profile.avatarUrl && profile.avatarUrl !== user.avatarUrl) patch.avatarUrl = profile.avatarUrl;
  if (Object.keys(patch).length === 0) return user;

  patch.updatedAt = new Date();
  const [updated] = await db
    .update(schema.usersSchema)
    .set(patch)
    .where(eq(schema.usersSchema.id, user.id))
    .returning(publicUserSelect);
  return updated ?? user;
};

const findByOAuthLink = async (profile: VerifiedOAuthProfile) => {
  const [link] = await db
    .select()
    .from(schema.oauthAccountsSchema)
    .where(
      and(
        eq(schema.oauthAccountsSchema.provider, profile.provider),
        eq(schema.oauthAccountsSchema.providerAccountId, profile.providerAccountId),
      ),
    )
    .limit(1);
  return link;
};

const findOrCreateOAuthUser = async (profile: VerifiedOAuthProfile) => {
  const existingLink = await findByOAuthLink(profile);
  if (existingLink) {
    const [linkedUser] = await db
      .select(publicUserSelect)
      .from(schema.usersSchema)
      .where(eq(schema.usersSchema.id, existingLink.userId))
      .limit(1);
    if (!linkedUser) {
      throw throwUnauthorizedError(
        "Linked account no longer exists",
        ERROR_CODES.AUTH_LINKED_USER_MISSING,
      );
    }
    const user = await refreshOAuthProfile(linkedUser, profile);
    return { user: Resource.toUserJson(user), token: await tokenFor(user), isNewUser: false };
  }

  let isNewUser = false;
  let user: PublicUser | undefined;

  // Link by email only when the provider verified it. This is what lets a
  // password user press "Continue with Google" without a duplicate account.
  if (profile.email && profile.emailVerified) {
    const email = normalizeEmail(profile.email);
    [user] = await db
      .select(publicUserSelect)
      .from(schema.usersSchema)
      .where(eq(schema.usersSchema.email, email))
      .limit(1);

    if (user) {
      const [otherProviderLink] = await db
        .select()
        .from(schema.oauthAccountsSchema)
        .where(
          and(
            eq(schema.oauthAccountsSchema.userId, user.id),
            eq(schema.oauthAccountsSchema.provider, profile.provider),
          ),
        )
        .limit(1);
      if (
        otherProviderLink &&
        otherProviderLink.providerAccountId !== profile.providerAccountId
      ) {
        throw throwUnauthorizedError(
          "This account is already linked to a different Google account",
          ERROR_CODES.AUTH_GOOGLE_LINKED_TO_OTHER,
        );
      }

      // First Google login for a password account: adopt Google's profile.
      user = await refreshOAuthProfile(user, profile);
    }
  }

  if (!user) {
    if (!profile.email) {
      throw throwUnauthorizedError(
        "Google account has no email",
        ERROR_CODES.AUTH_GOOGLE_EMAIL_MISSING,
      );
    }
    const email = normalizeEmail(profile.email);
    const created = (
      await db
        .insert(schema.usersSchema)
        .values({
          email,
          passwordHash: null,
          name: profile.name ?? null,
          avatarUrl: profile.avatarUrl ?? null,
        })
        .returning(publicUserSelect)
    )[0];
    if (!created) throw throwErrorOnValidation("Failed to create user");
    user = created;
    isNewUser = true;
  }

  const inserted = await db
    .insert(schema.oauthAccountsSchema)
    .values({
      userId: user.id,
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      email: profile.email ? normalizeEmail(profile.email) : null,
    })
    .onConflictDoNothing()
    .returning({ userId: schema.oauthAccountsSchema.userId });

  // Lost a concurrent first-login race: the winning request's link is truth.
  if (inserted.length === 0) {
    const winner = await findByOAuthLink(profile);
    if (winner && winner.userId !== user.id) {
      const [winnerUser] = await db
        .select(publicUserSelect)
        .from(schema.usersSchema)
        .where(eq(schema.usersSchema.id, winner.userId))
        .limit(1);
      if (!winnerUser) {
        throw throwUnauthorizedError(
          "Linked account no longer exists",
          ERROR_CODES.AUTH_LINKED_USER_MISSING,
        );
      }
      user = winnerUser;
      isNewUser = false;
    }
  }

  return { user: Resource.toUserJson(user), token: await tokenFor(user), isNewUser };
};

const oauthGoogle = async (idToken: string) => {
  const profile = await verifyGoogleIdToken(idToken);
  return findOrCreateOAuthUser(profile);
};

export default {
  signup,
  login,
  emailLookup,
  me,
  list,
  oauthGoogle,
  findOrCreateOAuthUser,
};
