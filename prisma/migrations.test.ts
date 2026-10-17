import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

// Every table in `public` is reachable through Supabase's PostgREST with the
// public anon key unless Row Level Security is on. Applies the real
// migrations to an in-memory Postgres, the way `prisma migrate deploy` would,
// and lists the tables left open.
describe("migrations", () => {
  it("enable Row Level Security on every table in public", async () => {
    const db = new PGlite({ extensions: { unaccent } });
    // What every Supabase project has and the migrations assume (the CI build
    // job creates the same on its bare Postgres).
    await db.exec(
      "CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA IF NOT EXISTS extensions;",
    );
    const names = readdirSync(MIGRATIONS_DIR)
      .filter((name) => /^\d+_/.test(name))
      .sort();
    for (const name of names) {
      await db.exec(readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf8"));
    }

    const { rows } = await db.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity ORDER BY tablename",
    );
    expect(rows.map((row) => row.tablename)).toEqual([]);
    await db.close();
  }, 60_000);
});
