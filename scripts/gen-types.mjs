// Generates packages/shared/src/database.types.ts from lfcc-manup (no Docker, no
// `supabase login`). Uses @supabase/postgrest-typegen, the engine behind
// `supabase gen types`.
//
// Like test-db.mjs, it opens a transaction, applies migrations the database has not
// recorded yet, introspects, and rolls back. So types can include a migration
// before it is pushed. Respects APPLIED_MIGRATIONS the same way.
//
// Usage: pnpm gen:types

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { introspect } from "@supabase/postgrest-typegen/introspection";
import { generateTypescript, sortGeneratorMetadata } from "@supabase/postgrest-typegen/generation";
import { connect } from "./db.mjs";

const MIGRATIONS_DIR = "supabase/migrations";
const OUT = "packages/shared/src/database.types.ts";
// Hosted PostgREST version (GET /rest/v1/ info.version). Update if Supabase upgrades.
const POSTGREST_VERSION = "14.5";

const client = await connect();

let applied;
if (process.env.APPLIED_MIGRATIONS) {
  applied = new Set(process.env.APPLIED_MIGRATIONS.split(",").map((v) => v.trim()));
} else {
  const { rows } = await client.query("select version from supabase_migrations.schema_migrations");
  applied = new Set(rows.map((r) => r.version));
}
const pending = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql") && !applied.has(f.split("_")[0]))
  .sort()
  .map((f) => join(MIGRATIONS_DIR, f));

try {
  await client.query("begin");
  for (const m of pending) {
    console.log(`applying ${basename(m)} inside the transaction (rolled back)`);
    await client.query(readFileSync(m, "utf8"));
  }
  const metadata = await introspect(client, { includedSchemas: ["public"] });
  const types = await generateTypescript(sortGeneratorMetadata(metadata), {
    postgrestVersion: POSTGREST_VERSION,
  });
  writeFileSync(OUT, types);
  console.log(`wrote ${OUT}`);
} finally {
  await client.query("rollback");
  await client.end();
}
