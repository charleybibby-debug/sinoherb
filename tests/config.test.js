import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../server/config.js";

test("loadConfig uses typed values for a test environment", () => {
  const config = loadConfig({
    NODE_ENV: "test",
    PORT: "3100",
    DATABASE_URL: "postgres://test",
    SESSION_SECRET: "test-secret",
    CONFIG_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  });

  assert.equal(config.port, 3100);
  assert.equal(config.databaseUrl, "postgres://test");
  assert.equal(config.sessionSecret, "test-secret");
  assert.equal(config.chatRetentionDays, 7);
  assert.equal(config.mediaMaxBytes, 5 * 1024 * 1024);
  assert.equal(config.mediaBackupLimit, 10);
  assert.equal(config.configEncryptionKey.length, 64);
});
