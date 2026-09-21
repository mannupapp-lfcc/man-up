// Shared connection to the hosted database for scripts (no Docker, no psql).
// Reads SUPABASE_DB_URL, falling back to manup_POSTGRES_URL_NON_POOLING (root .env).
import pg from "pg";

export async function connect() {
  const rawUrl = process.env.SUPABASE_DB_URL ?? process.env.manup_POSTGRES_URL_NON_POOLING;
  if (!rawUrl) {
    console.error("Set SUPABASE_DB_URL (or manup_POSTGRES_URL_NON_POOLING) in the root .env");
    process.exit(1);
  }
  // node-pg treats sslmode=require as full verification, which fails on the Supabase
  // pooler chain. Strip it and configure TLS explicitly.
  const url = new URL(rawUrl);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("supa");
  const client = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}
