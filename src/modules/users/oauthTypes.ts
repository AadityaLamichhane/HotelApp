export type OAuthProvider = "google" | "apple" | "facebook" | string;

// The only identity shape the account-linking code trusts. It is produced by
// a provider verifier (e.g. googleOAuth.ts) after signature/audience checks.
export type VerifiedOAuthProfile = {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  name?: string | null;
  avatarUrl?: string | null;
};

export type GoogleIdTokenPayload = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};
