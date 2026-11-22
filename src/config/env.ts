import dotenv from "dotenv";
dotenv.config();

// Single source of truth for env. Fail fast on required keys.
const required = ["API_KEY", "JWT_SECRET", "DATABASE_URL"] as const;

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`[env] WARNING: ${key} is missing. Copy .env.example -> .env`);
  }
}

const env: any = {
  APP_NAME: process.env.APP_NAME ?? "HotelManagement",
  MODE: process.env.MODE || "development",
  PORT: Number(process.env.PORT) || 9000,
  DATABASE_URL: process.env.DATABASE_URL,
  API_KEY: process.env.API_KEY,
  JWT_SECRET: process.env.JWT_SECRET || "",
  // Comma-separated Google OAuth client IDs accepted as id_token audiences.
  // Empty means Google sign-in is disabled (endpoint returns 503).
  GOOGLE_CLIENT_IDS: process.env.GOOGLE_CLIENT_IDS ?? "",
  // Optional. If set, menu OCR uses Google Cloud Vision (better on real
  // photos); otherwise Tesseract.js runs locally with no API key needed.
  GOOGLE_VISION_API_KEY: process.env.GOOGLE_VISION_API_KEY ?? "",
  // Optional. If set, parsed OCR items are enriched with Jev (TypeSafe)
  // Choice/Noul classification for canonical categories + veg detection.
  TYPESAFE_API_KEY: process.env.TYPESAFE_API_KEY ?? "",
  JEV_MODEL: process.env.JEV_MODEL ?? "jev-latest",
  SMS_AUTH_TOKEN: process.env.SMS_AUTH_TOKEN,
  MAIL_HOST: process.env.MAIL_HOST,
  MAIL_PORT: process.env.MAIL_PORT,
  MAIL_USER: process.env.MAIL_USER,
  MAIL_PASSWORD: process.env.MAIL_PASS || "",
  TIMEZONE: "Asia/Kathmandu",
};

export default env;

