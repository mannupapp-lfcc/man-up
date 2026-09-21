// Runs SQL files against the hosted database in one transaction and COMMITS.
// Any error rolls the whole run back. Used for the dev seed; never for migrations
// (those go through `supabase db push`).
//
// Usage: node --env-file=.env scripts/run-sql.mjs [--dry-run] <file.sql> [...more files]
//   --dry-run  run everything, print seed row counts, then roll back

import { readFileSync } from "node:fs";
import { connect } from "./db.mjs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const files = args.filter((a) => a !== "--dry-run");
if (!files.length) {
  console.error("Usage: run-sql.mjs <file.sql> [...]");
  process.exit(1);
}

const client = await connect();
try {
  await client.query("begin");
  for (const f of files) {
    console.log(`running ${f}`);
    await client.query(readFileSync(f, "utf8"));
  }
  const { rows } = await client.query(`
    select t.relname as table, (xpath('/row/c/text()',
      query_to_xml(format('select count(*) as c from %I.%I', n.nspname, t.relname), false, true, '')))[1]::text::int as rows
    from pg_class t join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relkind = 'r' order by 1`);
  console.table(rows.filter((r) => r.rows > 0));
  await client.query(dryRun ? "rollback" : "commit");
  console.log(dryRun ? "dry run: rolled back" : "committed");
} catch (err) {
  await client.query("rollback");
  console.error(`rolled back: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
