import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(currentDir, "../../db/003_media_assets.sql");
const config = loadConfig();
const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 1 });

try {
  await pool.query(await fs.readFile(migrationPath, "utf8"));
  console.log("Media migration applied.");
} finally {
  await pool.end();
}
