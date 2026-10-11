import { Algorithm, hash } from "@node-rs/argon2";
import { Pool } from "pg";
import { z } from "zod";
import { assertLocalDevelopmentDatabase } from "./development-guard.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
assertLocalDevelopmentDatabase(databaseUrl, process.env.DAYFLOW_DB_ENV);
if (process.env.DAYFLOW_BOOTSTRAP_CONFIRM !== "YES") {
  throw new Error("DAYFLOW_BOOTSTRAP_CONFIRM=YES is required for owner creation");
}

const email = z.email().max(254).parse(process.env.DAYFLOW_OWNER_EMAIL).toLowerCase();
const password = z.string().min(12).max(1024).parse(process.env.DAYFLOW_OWNER_PASSWORD);
const passwordHash = await hash(password, {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
});

const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 3000 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("LOCK TABLE users IN EXCLUSIVE MODE");
  const count = await client.query<{ count: string }>("SELECT count(*)::text as count FROM users");
  if (count.rows[0]?.count !== "0") {
    throw new Error("Owner already exists; bootstrap refuses to add a second account");
  }
  const saved = await client.query<{ id: string }>(
    "INSERT INTO users (email,password_hash) VALUES ($1,$2) RETURNING id",
    [email, passwordHash],
  );
  const ownerId = saved.rows[0]?.id;
  if (!ownerId) throw new Error("Could not create owner");
  await client.query("INSERT INTO settings (user_id) VALUES ($1)", [ownerId]);
  await client.query("COMMIT");
  console.log("Development owner created successfully. No credentials printed.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
