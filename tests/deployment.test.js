import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("deployment config keeps database and api ports private", () => {
  const compose = read("docker-compose.yml");
  assert.match(compose, /"80:80"/);
  assert.doesNotMatch(compose, /"5432:5432"/);
  assert.doesNotMatch(compose, /"3000:3000"/);
  assert.match(compose, /sinoherb-postgres/);
});

test("environment and operations docs include approved retention settings", () => {
  assert.match(read(".env.example"), /CHAT_RETENTION_DAYS=7/);
  assert.match(read(".env.example"), /BACKUP_RETENTION_DAYS=14/);
  assert.match(read("deploy/backup.sh"), /BACKUP_RETENTION_DAYS/);
});

test("media migration defines stable slots and compose persists uploads", () => {
  const migration = read("db/003_media_assets.sql");
  const compose = read("docker-compose.yml");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS media_assets/);
  assert.match(migration, /slot_key TEXT NOT NULL UNIQUE/);
  assert.match(migration, /philosophy\.hero/);
  assert.match(compose, /sinoherb-media/);
  assert.match(read("Dockerfile"), /migrate-media\.js/);
});

test("payment migration defines PayPal state and runs before startup", () => {
  const paymentMigration = read("db/006_paypal_payments.sql");
  assert.match(paymentMigration, /paypal_webhook_events/);
  assert.match(paymentMigration, /payment_status/);
  assert.match(paymentMigration, /stock_released_at/);
  assert.match(read("Dockerfile"), /migrate-payments\.js.*server\/app\.js/);
});

test("PayPal setup docs cover Sandbox, Webhooks, Live, and refunds", () => {
  const paypalDocs = read("docs/paypal-setup.md");
  assert.match(paypalDocs, /Sandbox Business/);
  assert.match(paypalDocs, /Sandbox Personal/);
  assert.match(paypalDocs, /PAYMENT\.CAPTURE\.COMPLETED/);
  assert.match(paypalDocs, /PAYMENT\.CAPTURE\.REFUNDED/);
  assert.match(paypalDocs, /PAYPAL_ENV=live/);
  assert.match(paypalDocs, /HTTPS/);
  assert.match(paypalDocs, /最小金额真实交易/);
  assert.match(paypalDocs, /PayPal 后台退款/);
});
