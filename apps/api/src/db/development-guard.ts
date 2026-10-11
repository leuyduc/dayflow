/** Prevent developer scripts from contacting an unrelated or remote database. */
export function assertLocalDevelopmentDatabase(url: string, marker: string | undefined): void {
  if (marker !== "development") {
    throw new Error("DAYFLOW_DB_ENV=development is required");
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid DATABASE_URL");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("DATABASE_URL must use PostgreSQL");
  }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)) {
    throw new Error("Development scripts only accept loopback PostgreSQL");
  }
  const databaseName = decodeURIComponent(parsed.pathname).slice(1);
  if (!/^dayflow_(dev|test)(_|$)/.test(databaseName)) {
    throw new Error("Development scripts refuse non-DayFlow development databases");
  }
  if (!parsed.username || ["root", "postgres"].includes(decodeURIComponent(parsed.username))) {
    throw new Error("Use a dedicated unprivileged database role");
  }
}
