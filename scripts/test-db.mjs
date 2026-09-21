// pgTAP runner for the hosted database (no Docker).
//
// For each test file: BEGIN, apply every migration in supabase/migrations that the
// database has not recorded yet, run the _*.sql fixtures, run the test file, ROLLBACK. Nothing a test or a
// pending migration does is ever committed, so unreviewed policies can be tested
// against lfcc-manup without being applied to it. `supabase db push` stays a
// separate, deliberate step.
//
// Usage: pnpm test:db [test files...]   (defaults to supabase/tests/*.sql)

import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { connect } from "./db.mjs";

const MIGRATIONS_DIR = "supabase/migrations";
const TESTS_DIR = "supabase/tests";

const sqlFiles = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join(dir, f));

const client = await connect();

// APPLIED_MIGRATIONS=0001,0002 overrides the history lookup (before `migration repair`).
let applied;
if (process.env.APPLIED_MIGRATIONS) {
  applied = new Set(process.env.APPLIED_MIGRATIONS.split(",").map((v) => v.trim()));
} else {
  try {
    const { rows } = await client.query("select version from supabase_migrations.schema_migrations");
    applied = new Set(rows.map((r) => r.version));
  } catch {
    console.error(
      "No migration history on this database. Run:\n" +
        "  pnpm exec supabase migration repair --status applied <version>\n" +
        "for each migration already applied by hand, or set APPLIED_MIGRATIONS=0001 for now.",
    );
    process.exit(1);
  }
}

const pending = sqlFiles(MIGRATIONS_DIR).filter((f) => !applied.has(basename(f).split("_")[0]));
// Files named _*.sql in the tests dir are shared fixtures, run before every test file.
const isFixture = (f) => basename(f).startsWith("_");
const fixtures = sqlFiles(TESTS_DIR).filter(isFixture);
const tests = process.argv.length > 2 ? process.argv.slice(2) : sqlFiles(TESTS_DIR).filter((f) => !isFixture(f));

if (pending.length) console.log(`Pending migrations applied inside each test transaction:\n  ${pending.join("\n  ")}\n`);

let failed = 0;
for (const file of tests) {
  console.log(`# ${file}`);
  try {
    await client.query("begin");
    for (const m of pending) await client.query(readFileSync(m, "utf8"));
    for (const f of fixtures) await client.query(readFileSync(f, "utf8"));
    // Test files use their own begin/rollback; strip them so everything shares ours.
    const body = readFileSync(file, "utf8").replace(/^\s*(begin|rollback)\s*;\s*$/gim, "");
    const results = [].concat(await client.query(body));
    const tap = results.flatMap((r) => r.rows ?? []).flatMap((row) => Object.values(row)).map(String);
    // Print TAP only (skip rows from setup selects such as tests.login()).
    for (const line of tap) if (/^(ok|not ok|#|\s+#|1\.\.)/.test(line)) console.log(line);
    const notOk = tap.filter((l) => /^\s*not ok/.test(l)).length;
    const planMismatch = tap.some((l) => /Looks like you (planned|failed)/.test(l));
    if (notOk || planMismatch || !tap.some((l) => /^ok/.test(l))) failed++;
  } catch (err) {
    failed++;
    console.log(`not ok - ${file} errored: ${err.message}`);
  } finally {
    await client.query("rollback");
  }
  console.log();
}

await client.end();
console.log(failed ? `FAILED: ${failed} of ${tests.length} test files` : `PASSED: ${tests.length} test files`);
process.exit(failed ? 1 : 0);
