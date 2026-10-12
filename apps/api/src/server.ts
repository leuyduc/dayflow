import { buildApp } from "./app.js";
import { createPostgresStore } from "./db/postgres-store.js";

const databaseUrl = process.env.DATABASE_URL;
const csrfSecret = process.env.DAYFLOW_CSRF_SECRET;
const allowedOrigin = process.env.DAYFLOW_APP_ORIGIN;
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && (!databaseUrl || !csrfSecret || !allowedOrigin)) {
  throw new Error("Missing required production auth configuration");
}
if (databaseUrl && (!csrfSecret || !allowedOrigin)) {
  throw new Error("DATABASE_URL requires DAYFLOW_CSRF_SECRET and DAYFLOW_APP_ORIGIN");
}

const postgres = databaseUrl ? createPostgresStore(databaseUrl) : null;
const app = buildApp({
  auth:
    postgres && csrfSecret && allowedOrigin
      ? {
          store: postgres.store,
          tasks: postgres.store,
          csrfSecret,
          allowedOrigin,
          cookieSecure: isProduction,
        }
      : undefined,
});

const port = Number(process.env.DAYFLOW_API_PORT ?? "3002");
const host = process.env.DAYFLOW_API_HOST ?? "127.0.0.1";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
  await postgres?.close();
}
