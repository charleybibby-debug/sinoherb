import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("checkout exposes stacked PayPal and manual order paths", async () => {
  const html = await read("checkout.html");
  const script = await read("frontend-api.js");
  const styles = await read("styles.css");
  assert.match(html, /name="countryCode"/);
  assert.match(html, /name="city"/);
  assert.match(html, /name="postalCode"/);
  assert.match(html, /id="paypalButtons"/);
  assert.match(html, /id="paypalStatus"/);
  assert.match(html, /data-payment-method="manual"/);
  assert.match(script, /payments\/paypal\/config/);
  assert.match(script, /payments\/paypal\/orders/);
  assert.match(styles, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
  assert.doesNotMatch(html, /PAYPAL_CLIENT_SECRET|client-secret/);
});

test("confirmation and admin expose limited payment state", async () => {
  const confirmation = await read("order-confirmation.html");
  const frontend = await read("frontend-api.js");
  const admin = await read("admin/admin.js");
  assert.match(confirmation, /id="orderConfirmation"/);
  assert.match(frontend, /\/orders\/.*\/confirmation\?token=/);
  assert.match(admin, /paymentMethodLabel/);
  assert.match(admin, /paymentStatusLabel/);
  assert.doesNotMatch(admin, /data-paypal-refund|发起退款/);
});
