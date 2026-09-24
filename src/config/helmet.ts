import { helmet } from "elysia-helmet";

// contentSecurityPolicy: false because this is a pure JSON API (no HTML).
const helmetOptions = helmet({
  contentSecurityPolicy: false,
  frameguard: { action: "deny" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

export default helmetOptions;

