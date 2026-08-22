import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(currentDir, "../../db/006_paypal_payments.sql");
const pool = new pg.Pool({ connectionString: loadConfig().databaseUrl, max: 1 });

try {
  await pool.query(await fs.readFile(migrationPath, "utf8"));
  console.log("Payment migration applied.");
} finally {
  await pool.end();
}
