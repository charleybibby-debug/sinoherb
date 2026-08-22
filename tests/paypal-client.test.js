import assert from "node:assert/strict";
import test from "node:test";
import { createPaypalClient } from "../server/paypal/client.js";

test("creates and captures a PayPal order with one cached access token", async () => {
  const calls = [];
  const replies = [
    { access_token: "TOKEN", expires_in: 3600 },
    { id: "PP-ORDER", status: "CREATED" },
    {
      id: "PP-ORDER",
      status: "COMPLETED",
      purchase_units: [{
        invoice_id: "SH-1",
        payments: { captures: [{ id: "CAP-1", status: "COMPLETED", amount: { currency_code: "USD", value: "68.00" } }] },
      }],
    },
  ];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => replies.shift() };
  };
  const client = createPaypalClient({
    paypalEnv: "sandbox",
    paypalClientId: "client",
    paypalClientSecret: "secret",
    paypalTimeoutMs: 1000,
  }, fetchImpl);

  await client.createOrder({ orderNumber: "SH-1", amount: "68.00", requestId: "create-SH-1" });
  const capture = await client.captureOrder("PP-ORDER", "capture-SH-1");

  assert.equal(calls.filter((call) => call.url.endsWith("/v1/oauth2/token")).length, 1);
  assert.equal(calls[1].options.headers["PayPal-Request-Id"], "create-SH-1");
  assert.equal(capture.captureId, "CAP-1");
  assert.equal(capture.invoiceId, "SH-1");
});

test("maps PayPal HTTP failures without leaking provider details", async () => {
  const client = createPaypalClient({
    paypalEnv: "sandbox",
    paypalClientId: "client",
    paypalClientSecret: "secret",
    paypalTimeoutMs: 1000,
  }, async () => ({ ok: false, status: 401, json: async () => ({ error_description: "secret detail" }) }));

  await assert.rejects(
    () => client.createOrder({ orderNumber: "SH-1", amount: "68.00", requestId: "create-SH-1" }),
    (error) => error.code === "PAYPAL_PROVIDER_ERROR" && !error.message.includes("secret detail"),
  );
});

test("verifies Webhook transmission metadata", async () => {
  const calls = [];
  const replies = [{ access_token: "TOKEN", expires_in: 3600 }, { verification_status: "SUCCESS" }];
  const client = createPaypalClient({
    paypalEnv: "sandbox",
    paypalClientId: "client",
    paypalClientSecret: "secret",
    paypalWebhookId: "WH-1",
    paypalTimeoutMs: 1000,
  }, async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => replies.shift() };
  });

  const verified = await client.verifyWebhook({
    headers: {
      "paypal-transmission-id": "TX-1",
      "paypal-transmission-time": "TIME",
      "paypal-transmission-sig": "SIG",
      "paypal-cert-url": "CERT",
      "paypal-auth-algo": "SHA256withRSA",
    },
    event: { id: "EV-1" },
  });

  assert.equal(verified, true);
  assert.match(calls[1].options.body, /"webhook_id":"WH-1"/);
});

test("maps aborted PayPal requests to a timeout", async () => {
  const aborted = new Error("aborted");
  aborted.name = "AbortError";
  const client = createPaypalClient({
    paypalEnv: "sandbox",
    paypalClientId: "client",
    paypalClientSecret: "secret",
    paypalTimeoutMs: 1000,
  }, async () => { throw aborted; });

  await assert.rejects(
    () => client.createOrder({ orderNumber: "SH-1", amount: "68.00", requestId: "create-SH-1" }),
    (error) => error.code === "PAYPAL_TIMEOUT",
  );
});
