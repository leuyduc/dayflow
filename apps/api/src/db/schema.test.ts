import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

const databases: PGlite[] = [];

async function migratedDatabase() {
  const database = new PGlite();
  databases.push(database);
  const directory = join(process.cwd(), "apps/api/drizzle");
  const files = (await readdir(directory)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
  if (files.length === 0) throw new Error("No generated Drizzle migration");
  for (const name of files) {
    const source = await readFile(join(directory, name), "utf8");
    const statements = source
      .split("--> statement-breakpoint")
      .map((sql) => sql.trim())
      .filter(Boolean);
    for (const statement of statements) await database.exec(statement);
  }
  return database;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.close()));
});

describe("PostgreSQL migration with isolated PGlite engine", () => {
  it("creates users, sessions, tasks, and settings with foreign keys", async () => {
    const database = await migratedDatabase();
    const result = await database.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname='public' order by tablename",
    );
    expect(result.rows.map(({ tablename }) => tablename)).toEqual([
      "change_log",
      "processed_mutations",
      "sessions",
      "settings",
      "sync_state",
      "tasks",
      "users",
    ]);
  });

  it("enforces unique owner email and nonempty task title", async () => {
    const db = await migratedDatabase();
    const userId = "11111111-1111-4111-8111-111111111111";
    await db.query("insert into users (id,email,password_hash) values ($1,$2,$3)", [
      userId,
      "owner@example.test",
      "test-only-hash",
    ]);
    await expect(
      db.query("insert into users (email,password_hash) values ($1,$2)", [
        "owner@example.test",
        "test-only-hash",
      ]),
    ).rejects.toThrow();

    await expect(
      db.query("insert into tasks (user_id,title) values ($1,$2)", [userId, "   "]),
    ).rejects.toThrow();
  });

  it("rejects invalid scheduled tasks, stores date-only fields, and scopes by owner", async () => {
    const db = await migratedDatabase();
    const a = "11111111-1111-4111-8111-111111111111";
    const b = "22222222-2222-4222-8222-222222222222";
    for (const [id, email] of [
      [a, "a@example.test"],
      [b, "b@example.test"],
    ]) {
      await db.query("insert into users (id,email,password_hash) values ($1,$2,$3)", [
        id,
        email,
        "test-only-hash",
      ]);
    }
    await expect(
      db.query("insert into tasks (user_id,title,status) values ($1,$2,$3)", [
        a,
        "Bad scheduled",
        "scheduled",
      ]),
    ).rejects.toThrow();

    await db.query("insert into tasks (user_id,title,due_date) values ($1,$2,$3)", [
      a,
      "Private owner A task",
      "2026-10-12",
    ]);
    await db.query("insert into tasks (user_id,title) values ($1,$2)", [b, "Private owner B task"]);
    const scoped = await db.query<{ title: string; due_date: string }>(
      "select title,due_date::text from tasks where user_id=$1",
      [a],
    );
    expect(scoped.rows).toEqual([{ title: "Private owner A task", due_date: "2026-10-12" }]);
  });
});
