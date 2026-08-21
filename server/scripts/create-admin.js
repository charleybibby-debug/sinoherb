import argon2 from "argon2";
import pg from "pg";
import { loadConfig } from "../config.js";

const username = process.argv[2];
const password = process.argv[3];
if (!username || !password || password.length < 12) {
  console.error("Usage: node server/scripts/create-admin.js <username> <password at least 12 chars>");
  process.exit(1);
}
const config = loadConfig();
const pool = new pg.Pool({ connectionString: config.databaseUrl });
try {
  const passwordHash = await argon2.hash(password);
  await pool.query(
    "INSERT INTO admin_users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'active', updated_at = NOW()",
    [username, passwordHash],
  );
  console.log("Admin user created:", username);
} finally {
  await pool.end();
}
