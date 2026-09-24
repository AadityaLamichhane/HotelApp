import { cors } from "@elysiajs/cors";

// Native mobile apps (iOS/Android) do NOT enforce CORS — only browsers do.
// Keep this locked down for the web app + local dev.
export const availableCors = [
  "http://localhost:3000",
  "http://localhost:9000",
  "https://app.hotelmanagement.com",
];

const corsOptions = cors({
  origin: availableCors,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "Api-Key", "isGuestMode"],
  credentials: true,
  exposeHeaders: ["Authorization", "Api-Key"],
  maxAge: 86400,
});

export default corsOptions;

