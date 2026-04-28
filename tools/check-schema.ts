import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tableNames } from "../packages/db/src/index.js";

const migrationPath = resolve("migrations/0001_initial.sql");
const migration = readFileSync(migrationPath, "utf8").toLowerCase();

const missing = tableNames.filter((table) => !migration.includes(`create table ${table}`));

if (missing.length > 0) {
  throw new Error(`Migration ${migrationPath} is missing tables: ${missing.join(", ")}`);
}

console.log(`Schema check passed for ${tableNames.length} tables.`);
