import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

async function loadLocalEnv() {
  try {
    const envFile = await readFile(resolve(".env.local"), "utf8");

    for (const line of envFile.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);

      if (!match || process.env[match[1]]) {
        continue;
      }

      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // The script can still run when DATABASE_URL is provided by the shell.
  }
}

const migrationFiles = process.argv.slice(2);

if (migrationFiles.length === 0) {
  console.error("Usage: node scripts/run-migration.mjs <path-to-sql> [path-to-sql...]");
  process.exit(1);
}

await loadLocalEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 8_000,
});

try {
  await client.connect();

  for (const migrationFile of migrationFiles) {
    const sql = await readFile(resolve(migrationFile), "utf8");
    await client.query(sql);
    console.log(`Applied migration: ${migrationFile}`);
  }
} finally {
  await client.end();
}
