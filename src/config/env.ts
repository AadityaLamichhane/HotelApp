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
  SMS_AUTH_TOKEN: process.env.SMS_AUTH_TOKEN,
  MAIL_HOST: process.env.MAIL_HOST,
  MAIL_PORT: process.env.MAIL_PORT,
  MAIL_USER: process.env.MAIL_USER,
  MAIL_PASSWORD: process.env.MAIL_PASS || "",
  TIMEZONE: "Asia/Kathmandu",
};

export default env;

