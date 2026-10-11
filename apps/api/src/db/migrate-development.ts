import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { assertLocalDevelopmentDatabase } from "./development-guard.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
assertLocalDevelopmentDatabase(databaseUrl, process.env.DAYFLOW_DB_ENV);

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  connectionTimeoutMillis: 3000,
});
try {
  const db = drizzle(pool);
  const migrationFolder = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  await migrate(db, { migrationsFolder: migrationFolder });
  console.log("Development migrations applied (database credentials not displayed).");
} finally {
  await pool.end();
}
