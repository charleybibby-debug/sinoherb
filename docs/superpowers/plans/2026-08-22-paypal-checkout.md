# PayPal Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure USD PayPal Checkout with Sandbox/Live switching while preserving SinoHerb's manual-contact order path.

**Architecture:** Keep PayPal credentials and order operations behind a focused server adapter. A payment service owns local order creation, stock reservation, Capture verification, idempotency, Webhook reconciliation, and confirmation tokens; thin Fastify routes expose it to the existing static checkout. The browser loads PayPal's JS SDK only when public configuration is enabled and never sends trusted prices.

**Tech Stack:** Node.js 22, Fastify 5, PostgreSQL 16, native `fetch`, PayPal REST Orders v2 and JS SDK, HTML/CSS/vanilla JavaScript, Node test runner.

---

## File Structure

**Create:**

- `db/006_paypal_payments.sql` — order payment columns, state constraints, Webhook event table, indexes.
- `server/scripts/migrate-payments.js` — applies migration 006 to an existing database.
- `server/domain/payments.js` — USD formatting, customer validation, payment state helpers, Capture verification.
- `server/paypal/client.js` — OAuth token cache and PayPal REST calls.
- `server/services/payment-service.js` — checkout orchestration and idempotent state changes.
- `server/routes/payments.js` — public config, Create, Capture, confirmation, and Webhook endpoints.
- `order-confirmation.html` — limited, token-protected payment result page.
- `tests/payments-domain.test.js` — domain validation and amount checks.
- `tests/paypal-client.test.js` — outbound PayPal request and error mapping tests.
- `tests/payment-service.test.js` — local/remote orchestration and inventory compensation tests.
- `tests/payment-routes.test.js` — Fastify endpoint contract tests.
- `tests/paypal-checkout-ui.test.js` — static checkout, confirmation, and admin markup contract tests.
- `docs/paypal-setup.md` — account, Sandbox, Webhook, Live, and smoke-test instructions.

**Modify:**

- `.env.example` — PayPal configuration names and safe defaults.
- `server/config.js` — typed PayPal settings.
- `server/domain/orders.js` — add `pending_payment` transitions.
- `server/repositories/memory-repository.js` — payment-aware orders, lookups, idempotent updates, Webhook events, stock release.
- `server/repositories/postgres-repository.js` — matching PostgreSQL behavior and transactions.
- `server/app.js` — construct PayPal client/payment service and register routes.
- `server/routes/public.js` — manual orders explicitly store manual/unpaid metadata and full address.
- `server/routes/admin.js` — return payment fields in admin orders.
- `server/retention.js` — cancel expired pending payments and release reserved inventory.
- `Dockerfile` — run the payment migration before app startup.
- `checkout.html` — complete address fields and stacked PayPal/manual payment area.
- `frontend-api.js` — form validation, SDK loading, Create/Capture flow, manual flow, redirect.
- `styles.css` — payment cards, states, messages, responsive layout.
- `admin/admin.js` — render payment method and payment status.
- `README.md` — link setup instructions and state PayPal prerequisites.
- `tests/config.test.js`, `tests/domain.test.js`, `tests/repository.test.js`, `tests/deployment.test.js`, `tests/admin-workspace.test.js` — extend existing behavior coverage.

Do not add a PayPal npm package. Use REST through native `fetch`, keeping the dependency surface unchanged.

### Task 1: Payment Domain and Configuration

**Files:**

- Create: `server/domain/payments.js`
- Create: `tests/payments-domain.test.js`
- Modify: `server/config.js`
- Modify: `.env.example`
- Modify: `tests/config.test.js`
- Modify: `server/domain/orders.js`
- Modify: `tests/domain.test.js`

- [ ] **Step 1: Write failing domain and config tests**

Add these cases:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { formatUsdAmount, validateCapture, validateCheckoutCustomer } from "../server/domain/payments.js";

test("formats integer cents as PayPal USD amounts", () => {
  assert.equal(formatUsdAmount(6800), "68.00");
  assert.throws(() => formatUsdAmount(68.5), /integer cents/);
});

test("validates complete checkout customer data", () => {
  assert.deepEqual(validateCheckoutCustomer({
    firstName: "Alex", lastName: "Wong", email: "alex@example.com",
    phone: "+1 555 000 0000", address: "1 Main St", city: "Toronto",
    postalCode: "M5V 2T6", countryCode: "CA", notes: "",
  }).countryCode, "CA");
  assert.throws(() => validateCheckoutCustomer({ firstName: "Alex" }), /配送信息/);
});

test("rejects a Capture whose amount or invoice does not match", () => {
  const completed = { status: "COMPLETED", invoiceId: "SH-1", currencyCode: "USD", value: "68.00", captureId: "CAP-1" };
  assert.equal(validateCapture(completed, { orderNumber: "SH-1", subtotalCents: 6800 }).captureId, "CAP-1");
  assert.throws(() => validateCapture({ ...completed, value: "67.00" }, { orderNumber: "SH-1", subtotalCents: 6800 }), /金额/);
});
```

Extend the existing tests with exact assertions:

```js
const config = loadConfig({ NODE_ENV: "test" });
assert.equal(config.paypalEnv, "sandbox");
assert.equal(config.paypalCurrency, "USD");
assert.equal(config.paypalEnabled, false);

assert.equal(transitionOrderStatus("pending_payment", "pending_contact"), "pending_contact");
assert.equal(transitionOrderStatus("pending_payment", "cancelled"), "cancelled");
assert.throws(() => transitionOrderStatus("pending_payment", "completed"));
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --test tests/payments-domain.test.js tests/config.test.js tests/domain.test.js
```

Expected: FAIL because `server/domain/payments.js` and PayPal config fields do not exist.

- [ ] **Step 3: Implement focused domain helpers**

Create `server/domain/payments.js` with complete pure functions:

```js
export function formatUsdAmount(cents) {
  if (!Number.isInteger(cents) || cents < 0) throw new Error("amount must be non-negative integer cents");
  return (cents / 100).toFixed(2);
}

export function validateCheckoutCustomer(input = {}) {
  const customer = {
    firstName: String(input.firstName || "").trim(),
    lastName: String(input.lastName || "").trim(),
    email: String(input.email || "").trim(),
    phone: String(input.phone || "").trim(),
    address: String(input.address || "").trim(),
    city: String(input.city || "").trim(),
    postalCode: String(input.postalCode || "").trim(),
    countryCode: String(input.countryCode || "").trim().toUpperCase(),
    notes: String(input.notes || "").trim(),
  };
  if (!customer.firstName || !customer.lastName || !customer.phone || !customer.address || !customer.city || !customer.postalCode || !/^[A-Z]{2}$/.test(customer.countryCode)) {
    throw new Error("请填写完整配送信息。");
  }
  if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw new Error("邮箱格式无效。");
  return customer;
}

export function validateCapture(capture, order) {
  if (capture.status !== "COMPLETED") throw new Error("PayPal 付款尚未完成。");
  if (capture.currencyCode !== "USD") throw new Error("PayPal 付款币种不一致。");
  if (capture.value !== formatUsdAmount(order.subtotalCents)) throw new Error("PayPal 付款金额不一致。");
  if (capture.invoiceId !== order.orderNumber) throw new Error("PayPal 订单编号不一致。");
  if (!capture.captureId) throw new Error("PayPal 未返回 Capture ID。");
  return capture;
}
```

Add PayPal config fields in `loadConfig`:

```js
const paypalEnv = env.PAYPAL_ENV || "sandbox";
if (!["sandbox", "live"].includes(paypalEnv)) throw new Error("PAYPAL_ENV must be sandbox or live");
const paypalClientId = env.PAYPAL_CLIENT_ID || "";
const paypalClientSecret = env.PAYPAL_CLIENT_SECRET || "";

paypalEnv,
paypalClientId,
paypalClientSecret,
paypalWebhookId: env.PAYPAL_WEBHOOK_ID || "",
paypalCurrency: "USD",
paypalTimeoutMs: numberFromEnv(env, "PAYPAL_TIMEOUT_MS", 15000, { min: 1000, max: 60000 }),
paypalEnabled: Boolean(paypalClientId && paypalClientSecret),
```

Add `pending_payment` to the order status enum and transitions only to `pending_contact` or `cancelled`.

- [ ] **Step 4: Add safe environment examples**

Append:

```dotenv
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_TIMEOUT_MS=15000
```

- [ ] **Step 5: Run tests and verify GREEN**

Run the Step 2 command. Expected: all selected tests PASS.

- [ ] **Step 6: Review diff checkpoint**

Run `git diff --check` and inspect only Task 1 files. Do not commit unless the user explicitly authorizes commits.

### Task 2: PayPal REST Client

**Files:**

- Create: `server/paypal/client.js`
- Create: `tests/paypal-client.test.js`

- [ ] **Step 1: Write failing PayPal client tests**

Use a queued fake `fetch` and assert URLs, auth, idempotency, mapping, token reuse, and timeout errors:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { createPaypalClient } from "../server/paypal/client.js";

test("creates and captures a PayPal order with one cached access token", async () => {
  const calls = [];
  const replies = [
    { access_token: "TOKEN", expires_in: 3600 },
    { id: "PP-ORDER", status: "CREATED" },
    { id: "PP-ORDER", status: "COMPLETED", purchase_units: [{ invoice_id: "SH-1", payments: { captures: [{ id: "CAP-1", status: "COMPLETED", amount: { currency_code: "USD", value: "68.00" } }] } }] },
  ];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => replies.shift() };
  };
  const client = createPaypalClient({ paypalEnv: "sandbox", paypalClientId: "client", paypalClientSecret: "secret", paypalTimeoutMs: 1000 }, fetchImpl);
  await client.createOrder({ orderNumber: "SH-1", amount: "68.00", requestId: "create-SH-1" });
  const capture = await client.captureOrder("PP-ORDER", "capture-SH-1");
  assert.equal(calls.filter((call) => call.url.endsWith("/v1/oauth2/token")).length, 1);
  assert.equal(calls[1].options.headers["PayPal-Request-Id"], "create-SH-1");
  assert.equal(capture.captureId, "CAP-1");
  assert.equal(capture.invoiceId, "SH-1");
});
```

Add these explicit error and Webhook cases:

```js
test("maps PayPal HTTP failures without leaking provider details", async () => {
  const client = createPaypalClient({ paypalEnv: "sandbox", paypalClientId: "client", paypalClientSecret: "secret", paypalTimeoutMs: 1000 }, async () => ({ ok: false, status: 401, json: async () => ({ error_description: "secret detail" }) }));
  await assert.rejects(() => client.createOrder({ orderNumber: "SH-1", amount: "68.00", requestId: "create-SH-1" }), (error) => error.code === "PAYPAL_PROVIDER_ERROR" && !error.message.includes("secret detail"));
});

test("verifies Webhook transmission metadata", async () => {
  const calls = [];
  const replies = [{ access_token: "TOKEN", expires_in: 3600 }, { verification_status: "SUCCESS" }];
  const client = createPaypalClient({ paypalEnv: "sandbox", paypalClientId: "client", paypalClientSecret: "secret", paypalWebhookId: "WH-1", paypalTimeoutMs: 1000 }, async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => replies.shift() };
  });
  const verified = await client.verifyWebhook({ headers: { "paypal-transmission-id": "TX-1", "paypal-transmission-time": "TIME", "paypal-transmission-sig": "SIG", "paypal-cert-url": "CERT", "paypal-auth-algo": "SHA256withRSA" }, event: { id: "EV-1" } });
  assert.equal(verified, true);
  assert.match(calls[1].options.body, /"webhook_id":"WH-1"/);
});
```

Add timeout coverage with an explicit abort error:

```js
test("maps aborted PayPal requests to a timeout", async () => {
  const aborted = new Error("aborted");
  aborted.name = "AbortError";
  const client = createPaypalClient({ paypalEnv: "sandbox", paypalClientId: "client", paypalClientSecret: "secret", paypalTimeoutMs: 1000 }, async () => { throw aborted; });
  await assert.rejects(() => client.createOrder({ orderNumber: "SH-1", amount: "68.00", requestId: "create-SH-1" }), (error) => error.code === "PAYPAL_TIMEOUT");
});
```

- [ ] **Step 2: Run test and verify RED**

Run `node --test tests/paypal-client.test.js`. Expected: FAIL because the client module does not exist.

- [ ] **Step 3: Implement the PayPal client**

Implement `createPaypalClient(config, fetchImpl = fetch)` as a complete focused adapter:

```js
export class PaypalClientError extends Error {
  constructor(message, code) { super(message); this.name = "PaypalClientError"; this.code = code; }
}

export function createPaypalClient(config, fetchImpl = fetch) {
  const baseUrl = config.paypalEnv === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  let cachedToken = null;
  let tokenExpiresAt = 0;

  async function fetchJson(url, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.paypalTimeoutMs);
    try {
      const response = await fetchImpl(url, { ...options, signal: controller.signal });
      if (!response.ok) throw new PaypalClientError("PayPal 请求失败。", "PAYPAL_PROVIDER_ERROR");
      return await response.json();
    } catch (error) {
      if (error.name === "AbortError") throw new PaypalClientError("PayPal 请求超时。", "PAYPAL_TIMEOUT");
      if (error instanceof PaypalClientError) throw error;
      throw new PaypalClientError("PayPal 暂时不可用。", "PAYPAL_UNAVAILABLE");
    } finally { clearTimeout(timeout); }
  }

  async function accessToken() {
    if (cachedToken && Date.now() < tokenExpiresAt - 60000) return cachedToken;
    const basic = Buffer.from(`${config.paypalClientId}:${config.paypalClientSecret}`).toString("base64");
    const payload = await fetchJson(baseUrl + "/v1/oauth2/token", { method: "POST", headers: { authorization: "Basic " + basic, "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
    cachedToken = payload.access_token;
    tokenExpiresAt = Date.now() + Number(payload.expires_in || 0) * 1000;
    return cachedToken;
  }

  async function paypalRequest(path, { body, requestId } = {}) {
    const token = await accessToken();
    return fetchJson(baseUrl + path, { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json", ...(requestId ? { "PayPal-Request-Id": requestId } : {}) }, body: JSON.stringify(body || {}) });
  }

  const isConfigured = () => Boolean(config.paypalClientId && config.paypalClientSecret);
  return {
    isConfigured,
    publicConfig: () => ({ enabled: isConfigured(), clientId: config.paypalClientId, currency: "USD", environment: config.paypalEnv }),
    async createOrder({ orderNumber, amount, requestId }) {
      const payload = await paypalRequest("/v2/checkout/orders", { requestId, body: { intent: "CAPTURE", purchase_units: [{ invoice_id: orderNumber, amount: { currency_code: "USD", value: amount } }] } });
      return { paypalOrderId: payload.id, status: payload.status };
    },
    async captureOrder(paypalOrderId, requestId) {
      const payload = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, { requestId });
      const unit = payload.purchase_units?.[0] || {};
      const capture = unit.payments?.captures?.[0] || {};
      return { status: capture.status || payload.status, captureId: capture.id, invoiceId: unit.invoice_id, currencyCode: capture.amount?.currency_code, value: capture.amount?.value };
    },
    async verifyWebhook({ headers, event }) {
      const payload = await paypalRequest("/v1/notifications/verify-webhook-signature", { body: { auth_algo: headers["paypal-auth-algo"], cert_url: headers["paypal-cert-url"], transmission_id: headers["paypal-transmission-id"], transmission_sig: headers["paypal-transmission-sig"], transmission_time: headers["paypal-transmission-time"], webhook_id: config.paypalWebhookId, webhook_event: event } });
      return payload.verification_status === "SUCCESS";
    },
  };
}
```

Keep the adapter small. Do not log request bodies, authorization headers, access tokens, or provider error payloads.

- [ ] **Step 4: Run tests and verify GREEN**

Run `node --test tests/paypal-client.test.js`. Expected: all PayPal client tests PASS.

- [ ] **Step 5: Review diff checkpoint**

Run `git diff --check -- server/paypal/client.js tests/paypal-client.test.js`.

### Task 3: Payment Migration and Repository Contracts

**Files:**

- Create: `db/006_paypal_payments.sql`
- Create: `server/scripts/migrate-payments.js`
- Modify: `Dockerfile`
- Modify: `server/repositories/memory-repository.js`
- Modify: `server/repositories/postgres-repository.js`
- Modify: `tests/repository.test.js`
- Modify: `tests/deployment.test.js`

- [ ] **Step 1: Write failing repository tests**

Add tests that create a PayPal order, update it to paid, find it by PayPal ID, record a Webhook once, and release inventory once:

```js
test("memory repository persists PayPal payment metadata idempotently", async () => {
  const repository = new MemoryRepository({ products: [{ id: "p1", slug: "tea", name: "Tea", priceCents: 3200, stockQuantity: 2, status: "active", sortOrder: 1 }] });
  const order = await repository.createOrder({
    orderNumber: "SH-PAY", cartId: "cart-1", customer: { name: "Alex Wong", phone: "1", address: "1 Main St", city: "Toronto", postalCode: "M5V", countryCode: "CA" },
    lines: [{ productId: "p1", productSlug: "tea", productName: "Tea", unitPriceCents: 3200, quantity: 1, lineTotalCents: 3200 }],
    subtotalCents: 3200,
    payment: { method: "paypal", status: "pending", currencyCode: "USD", confirmationTokenHash: "hash" },
    status: "pending_payment",
  });
  await repository.attachPaypalOrder(order.id, "PP-1");
  const paid = await repository.markOrderPaid(order.id, { paypalCaptureId: "CAP-1", paidAt: 1000 });
  assert.equal(paid.paymentStatus, "paid");
  assert.equal((await repository.getOrderByPaypalOrderId("PP-1")).id, order.id);
  assert.equal(await repository.recordPaypalWebhookEvent({ eventId: "EV-1", eventType: "PAYMENT.CAPTURE.COMPLETED", resourceId: "CAP-1" }), true);
  assert.equal(await repository.recordPaypalWebhookEvent({ eventId: "EV-1", eventType: "PAYMENT.CAPTURE.COMPLETED", resourceId: "CAP-1" }), false);
});

test("releases reserved inventory only once", async () => {
  const repository = new MemoryRepository({ products: [{ id: "p1", slug: "tea", name: "Tea", priceCents: 3200, stockQuantity: 2, status: "active", sortOrder: 1 }] });
  const order = await repository.createOrder({
    orderNumber: "SH-RESERVE", cartId: "cart-1", customer: { name: "Alex Wong", phone: "1", address: "1 Main St", city: "Toronto", postalCode: "M5V", countryCode: "CA" },
    lines: [{ productId: "p1", productSlug: "tea", productName: "Tea", unitPriceCents: 3200, quantity: 1, lineTotalCents: 3200 }],
    subtotalCents: 3200,
    payment: { method: "paypal", status: "pending", currencyCode: "USD", confirmationTokenHash: "hash" },
    status: "pending_payment",
  });
  assert.equal(repository.getProductById("p1").stockQuantity, 1);
  await repository.cancelPendingOrder(order.id, 1000);
  await repository.cancelPendingOrder(order.id, 2000);
  assert.equal(repository.getProductById("p1").stockQuantity, 2);
  assert.equal((await repository.getOrder(order.id)).stockReleasedAt, 1000);
});
```

- [ ] **Step 2: Write failing deployment assertions**

Add exact deployment assertions:

```js
const paymentMigration = read("db/006_paypal_payments.sql");
assert.match(paymentMigration, /paypal_webhook_events/);
assert.match(paymentMigration, /payment_status/);
assert.match(paymentMigration, /stock_released_at/);
assert.match(read("Dockerfile"), /migrate-payments\.js.*server\/app\.js/);
```

- [ ] **Step 3: Run tests and verify RED**

Run `node --test tests/repository.test.js tests/deployment.test.js`. Expected: FAIL on missing migration and repository methods.

- [ ] **Step 4: Create the idempotent SQL migration**

Create `db/006_paypal_payments.sql` that:

```sql
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending_payment','pending_contact','contacted','confirmed','completed','cancelled'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_released_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_token_hash TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS postal_code TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'US';
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('manual','paypal'));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('pending','paid','failed','unpaid','refunded'));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_currency_code_check;
ALTER TABLE orders ADD CONSTRAINT orders_currency_code_check CHECK (currency_code = 'USD');
CREATE UNIQUE INDEX IF NOT EXISTS orders_paypal_order_unique_idx ON orders (paypal_order_id) WHERE paypal_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_paypal_capture_unique_idx ON orders (paypal_capture_id) WHERE paypal_capture_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS paypal_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  resource_id TEXT,
  processing_status TEXT NOT NULL,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
```

- [ ] **Step 5: Add the payment migration runner**

Create the runner with the same lifecycle as the media migration:

```js
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
} finally { await pool.end(); }
```

Update Docker `CMD` to:

```dockerfile
CMD ["sh", "-c", "node server/scripts/migrate-media.js && node server/scripts/migrate-payments.js && node server/app.js"]
```

- [ ] **Step 6: Implement matching memory repository methods**

Extend `createOrder` to accept `{ status = "pending_contact", payment = {} }`, validate and decrement each product's stock before saving the order, and store all payment/address fields. Initialize `this.paypalWebhookEvents = new Map()` in the constructor. Add these complete memory implementations:

```js
getOrderByNumber(orderNumber) {
  const order = [...this.orders.values()].find((item) => item.orderNumber === orderNumber);
  return order ? this.getOrder(order.id) : null;
}

getOrderByPaypalOrderId(paypalOrderId) {
  const order = [...this.orders.values()].find((item) => item.paypalOrderId === paypalOrderId);
  return order ? this.getOrder(order.id) : null;
}

getOrderByPaypalCaptureId(paypalCaptureId) {
  const order = [...this.orders.values()].find((item) => item.paypalCaptureId === paypalCaptureId);
  return order ? this.getOrder(order.id) : null;
}

attachPaypalOrder(id, paypalOrderId) {
  const order = this.orders.get(id);
  if (!order) return null;
  if (order.paypalOrderId && order.paypalOrderId !== paypalOrderId) throw new Error("PayPal order already attached");
  order.paypalOrderId = paypalOrderId;
  order.updatedAt = Date.now();
  return this.getOrder(id);
}

markOrderPaid(id, { paypalCaptureId, paidAt }) {
  const order = this.orders.get(id);
  if (!order) return null;
  if (order.paymentStatus === "paid") {
    if (order.paypalCaptureId !== paypalCaptureId) throw new Error("PayPal capture conflict");
    return this.getOrder(id);
  }
  order.paypalCaptureId = paypalCaptureId;
  order.paymentStatus = "paid";
  order.status = "pending_contact";
  order.paidAt = paidAt;
  order.updatedAt = paidAt;
  return this.getOrder(id);
}

markOrderRefunded(id, refundedAt) {
  const order = this.orders.get(id);
  if (!order) return null;
  order.paymentStatus = "refunded";
  order.refundedAt ||= refundedAt;
  order.updatedAt = refundedAt;
  return this.getOrder(id);
}

markOrderPaymentFailed(id, timestamp) {
  const order = this.orders.get(id);
  if (!order || order.paymentStatus === "paid" || order.paymentStatus === "refunded") return order ? this.getOrder(id) : null;
  order.paymentStatus = "failed";
  order.updatedAt = timestamp;
  return this.getOrder(id);
}

clearCartById(cartId) {
  if (cartId) this.cartItems.set(cartId, []);
}

recordPaypalWebhookEvent(event) {
  if (this.paypalWebhookEvents.has(event.eventId)) return false;
  this.paypalWebhookEvents.set(event.eventId, { ...event, processingStatus: "processing", processedAt: null, errorCode: null });
  return true;
}

completePaypalWebhookEvent(eventId, processingStatus, errorCode = null) {
  const event = this.paypalWebhookEvents.get(eventId);
  if (!event) return null;
  Object.assign(event, { processingStatus, errorCode, processedAt: Date.now() });
  return { ...event };
}

cancelPendingOrder(id, timestamp) {
  const order = this.orders.get(id);
  if (!order || order.paymentStatus === "paid" || order.paymentStatus === "refunded") return order ? this.getOrder(id) : null;
  if (!order.stockReleasedAt) {
    for (const line of this.orderItems.get(id) || []) {
      const product = this.products.find((item) => item.id === line.productId);
      if (product) product.stockQuantity += line.quantity;
    }
    order.stockReleasedAt = timestamp;
  }
  order.status = "cancelled";
  order.paymentStatus = "failed";
  order.updatedAt = timestamp;
  return this.getOrder(id);
}

listExpiredPendingPaymentOrders(cutoff) {
  return [...this.orders.values()].filter((order) => order.status === "pending_payment" && order.paymentStatus === "pending" && order.createdAt < cutoff).map((order) => this.getOrder(order.id));
}
```

- [ ] **Step 7: Implement PostgreSQL repository methods transactionally**

Update SELECT projections once as a shared `orderColumns` constant to include payment/address fields. Parameterize all writes. Use these atomic guards as the center of the PostgreSQL implementation:

```sql
UPDATE orders
SET paypal_capture_id = $2, payment_status = 'paid', status = 'pending_contact', paid_at = $3, updated_at = $3
WHERE id = $1 AND payment_status = 'pending'
RETURNING *;

INSERT INTO paypal_webhook_events (event_id, event_type, resource_id, processing_status)
VALUES ($1, $2, $3, 'processing')
ON CONFLICT (event_id) DO NOTHING
RETURNING event_id;

SELECT id, stock_released_at, payment_status FROM orders WHERE id = $1 FOR UPDATE;
UPDATE products p
SET stock_quantity = p.stock_quantity + oi.quantity, updated_at = NOW()
FROM order_items oi
WHERE oi.order_id = $1 AND oi.product_id = p.id;
UPDATE orders SET status = 'cancelled', payment_status = 'failed', stock_released_at = $2, updated_at = $2
WHERE id = $1 AND stock_released_at IS NULL;
```

Wrap the final three cancellation statements in one transaction; skip the inventory update when the locked row already has `stock_released_at` or has payment status `paid/refunded`. If the guarded paid update returns no row, load the order and return it only when the stored Capture ID matches; otherwise throw a capture conflict.

- [ ] **Step 8: Run tests and verify GREEN**

Run the Step 3 command. Expected: all repository and deployment tests PASS.

- [ ] **Step 9: Review diff checkpoint**

Run `git diff --check` and inspect migration SQL for rerun safety.

### Task 4: Payment Service Orchestration

**Files:**

- Create: `server/services/payment-service.js`
- Create: `tests/payment-service.test.js`

- [ ] **Step 1: Write failing service tests**

Build the service with a `MemoryRepository`, fake PayPal client, and deterministic token factory. Start with complete Create/Capture coverage:

```js
const repository = new MemoryRepository({ products: [{ id: "p1", slug: "tea", name: "Tea", priceCents: 3200, stockQuantity: 2, status: "active", sortOrder: 1 }] });
repository.saveCartItem("visitor", "p1", 1);
const paypalClient = {
  created: null,
  publicConfig: () => ({ enabled: true, clientId: "client", currency: "USD", environment: "sandbox" }),
  async createOrder(input) { this.created = input; return { paypalOrderId: "PP-1", status: "CREATED" }; },
  async captureOrder() { return { status: "COMPLETED", captureId: "CAP-1", invoiceId: "SH-1000", currencyCode: "USD", value: "32.00" }; },
  async verifyWebhook() { return true; },
};
const service = new PaymentService({
  repository,
  paypalClient,
  tokenFactory: () => "checkout-token",
  now: () => 1000,
  orderNumberFactory: () => "SH-1000",
});

const validCustomer = { firstName: "Alex", lastName: "Wong", phone: "+1", email: "alex@example.com", address: "1 Main St", city: "Toronto", postalCode: "M5V 2T6", countryCode: "CA", notes: "" };
const created = await service.createPaypalOrder({ visitorToken: "visitor", userId: null, customer: validCustomer });
assert.equal(created.paypalOrderId, "PP-1");
assert.equal(created.checkoutToken, "checkout-token");
assert.equal(paypalClient.created.amount, "32.00");

const captured = await service.capturePaypalOrder({ paypalOrderId: "PP-1", checkoutToken: "checkout-token", visitorToken: "visitor" });
assert.equal(captured.paymentStatus, "paid");
assert.equal((await repository.getCart("visitor")).items.length, 0);
```

Add explicit compensation and Webhook idempotency cases:

```js
const validWebhookHeaders = { "paypal-transmission-id": "TX-1", "paypal-transmission-time": "TIME", "paypal-transmission-sig": "SIG", "paypal-cert-url": "CERT", "paypal-auth-algo": "SHA256withRSA" };

function seededRepository() {
  const repository = new MemoryRepository({ products: [{ id: "p1", slug: "tea", name: "Tea", priceCents: 3200, stockQuantity: 2, status: "active", sortOrder: 1 }] });
  repository.saveCartItem("visitor", "p1", 1);
  return repository;
}

async function paidOrderFixture() {
  const repository = seededRepository();
  const paypalClient = {
    publicConfig: () => ({ enabled: true, clientId: "client", currency: "USD", environment: "sandbox" }),
    async createOrder() { return { paypalOrderId: "PP-PAID", status: "CREATED" }; },
    async captureOrder() { return { status: "COMPLETED", captureId: "CAP-1", invoiceId: "SH-PAID", currencyCode: "USD", value: "32.00" }; },
    async verifyWebhook() { return true; },
  };
  const service = new PaymentService({ repository, paypalClient, tokenFactory: () => "token", now: () => 1000, orderNumberFactory: () => "SH-PAID" });
  await service.createPaypalOrder({ visitorToken: "visitor", customer: validCustomer });
  await service.capturePaypalOrder({ paypalOrderId: "PP-PAID", checkoutToken: "token", visitorToken: "visitor" });
  return { repository, service };
}

test("compensates stock when PayPal Create fails", async () => {
  const repository = seededRepository();
  const service = new PaymentService({ repository, paypalClient: { publicConfig: () => ({ enabled: true }), async createOrder() { throw new Error("provider failed"); } }, tokenFactory: () => "token", now: () => 1000, orderNumberFactory: () => "SH-FAIL" });
  await assert.rejects(() => service.createPaypalOrder({ visitorToken: "visitor", customer: validCustomer }));
  const order = await repository.getOrderByNumber("SH-FAIL");
  assert.equal(order.status, "cancelled");
  assert.equal(order.paymentStatus, "failed");
  assert.equal(repository.getProductById("p1").stockQuantity, 2);
  assert.equal((await repository.getCart("visitor")).items.length, 1);
});

test("processes a refund Webhook only once", async () => {
  const fixture = await paidOrderFixture();
  const event = { id: "EV-REFUND", event_type: "PAYMENT.CAPTURE.REFUNDED", resource: { id: "REF-1", links: [], supplementary_data: { related_ids: { capture_id: "CAP-1" } } } };
  assert.equal((await fixture.service.processWebhook({ headers: validWebhookHeaders, event })).processed, true);
  assert.equal((await fixture.service.processWebhook({ headers: validWebhookHeaders, event })).duplicate, true);
  assert.equal((await fixture.repository.getOrderByPaypalCaptureId("CAP-1")).paymentStatus, "refunded");
});
```

Keep `validCustomer` once at the top of the test file. Add this Capture mismatch case:

```js
test("does not clear cart or release stock after a mismatched completed Capture", async () => {
  const repository = seededRepository();
  const paypalClient = { publicConfig: () => ({ enabled: true }), async createOrder() { return { paypalOrderId: "PP-MISMATCH" }; }, async captureOrder() { return { status: "COMPLETED", captureId: "CAP-X", invoiceId: "SH-MISMATCH", currencyCode: "USD", value: "31.00" }; } };
  const service = new PaymentService({ repository, paypalClient, tokenFactory: () => "token", now: () => 1000, orderNumberFactory: () => "SH-MISMATCH" });
  await service.createPaypalOrder({ visitorToken: "visitor", customer: validCustomer });
  await assert.rejects(() => service.capturePaypalOrder({ paypalOrderId: "PP-MISMATCH", checkoutToken: "token", visitorToken: "visitor" }), /金额/);
  const order = await repository.getOrderByPaypalOrderId("PP-MISMATCH");
  assert.equal(order.paymentStatus, "failed");
  assert.equal(repository.getProductById("p1").stockQuantity, 1);
  assert.equal((await repository.getCart("visitor")).items.length, 1);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run `node --test tests/payment-service.test.js`. Expected: FAIL because `PaymentService` does not exist.

- [ ] **Step 3: Implement `PaymentService`**

Implement the class with explicit dependencies and token validation:

```js
import { timingSafeEqual } from "node:crypto";
import { createToken, hashToken } from "../auth.js";
import { calculateOrderLines } from "../domain/orders.js";
import { formatUsdAmount, validateCapture, validateCheckoutCustomer } from "../domain/payments.js";

const tokenMatches = (token, expectedHash) => {
  const actual = Buffer.from(hashToken(String(token || "")));
  const expected = Buffer.from(String(expectedHash || ""));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

const paymentResult = (order) => ({ orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus, subtotalCents: order.subtotalCents, subtotal: "$" + formatUsdAmount(order.subtotalCents) });

export class PaymentService {
  constructor({ repository, paypalClient, tokenFactory = createToken, now = Date.now, orderNumberFactory = () => "SH-" + Date.now().toString(36).toUpperCase() + "-" + createToken().slice(0, 6).toUpperCase() }) {
    this.repository = repository;
    this.paypalClient = paypalClient;
    this.tokenFactory = tokenFactory;
    this.now = now;
    this.orderNumberFactory = orderNumberFactory;
  }

  publicConfig() { return this.paypalClient.publicConfig(); }

  async createPaypalOrder({ visitorToken, userId = null, customer: input }) {
    const customer = validateCheckoutCustomer(input);
    const cart = await this.repository.getCart(visitorToken);
    if (!cart?.items?.length) throw new Error("购物车为空。");
    const products = (await Promise.all(cart.items.map((item) => this.repository.getProductById(item.productId)))).filter(Boolean);
    const lines = calculateOrderLines(cart.items, products);
    const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
    const orderNumber = this.orderNumberFactory();
    const checkoutToken = this.tokenFactory();
    const order = await this.repository.createOrder({ orderNumber, cartId: cart.id, userId, status: "pending_payment", customer: { ...customer, name: `${customer.firstName} ${customer.lastName}` }, lines, subtotalCents, payment: { method: "paypal", status: "pending", currencyCode: "USD", confirmationTokenHash: hashToken(checkoutToken) } });
    try {
      const remote = await this.paypalClient.createOrder({ orderNumber, amount: formatUsdAmount(subtotalCents), requestId: `create-${orderNumber}` });
      await this.repository.attachPaypalOrder(order.id, remote.paypalOrderId);
      return { orderNumber, paypalOrderId: remote.paypalOrderId, checkoutToken };
    } catch (error) {
      await this.repository.cancelPendingOrder(order.id, this.now());
      throw error;
    }
  }

  async capturePaypalOrder({ paypalOrderId, checkoutToken, visitorToken }) {
    const order = await this.repository.getOrderByPaypalOrderId(paypalOrderId);
    if (!order || !tokenMatches(checkoutToken, order.confirmationTokenHash)) throw new Error("支付确认信息无效。");
    if (order.paymentStatus === "paid") return paymentResult(order);
    const capture = await this.paypalClient.captureOrder(paypalOrderId, `capture-${order.orderNumber}`);
    try { validateCapture(capture, order); }
    catch (error) { await this.repository.markOrderPaymentFailed(order.id, this.now()); throw error; }
    const paid = await this.repository.markOrderPaid(order.id, { paypalCaptureId: capture.captureId, paidAt: this.now() });
    if (visitorToken) await this.repository.clearCart(visitorToken);
    else await this.repository.clearCartById(order.cartId);
    return paymentResult(paid);
  }

  async getConfirmation({ orderNumber, checkoutToken }) {
    const order = await this.repository.getOrderByNumber(orderNumber);
    if (!order || !tokenMatches(checkoutToken, order.confirmationTokenHash)) throw new Error("订单确认信息无效。");
    return { ...paymentResult(order), transactionReference: order.paypalCaptureId ? "••••" + order.paypalCaptureId.slice(-6) : null, createdAt: order.createdAt };
  }

  async processWebhook({ headers, event }) {
    if (!await this.paypalClient.verifyWebhook({ headers, event })) throw new Error("PayPal Webhook 签名无效。");
    const inserted = await this.repository.recordPaypalWebhookEvent({ eventId: event.id, eventType: event.event_type, resourceId: event.resource?.id || null });
    if (!inserted) return { duplicate: true };
    try {
      const resource = event.resource || {};
      const related = resource.supplementary_data?.related_ids || {};
      if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
        const order = await this.repository.getOrderByPaypalOrderId(related.order_id);
        if (!order || resource.status !== "COMPLETED" || resource.amount?.currency_code !== "USD" || resource.amount?.value !== formatUsdAmount(order.subtotalCents)) throw new Error("PayPal Webhook 金额或订单不一致。");
        await this.repository.markOrderPaid(order.id, { paypalCaptureId: resource.id, paidAt: this.now() });
        await this.repository.clearCartById(order.cartId);
      } else if (event.event_type === "PAYMENT.CAPTURE.DENIED") {
        const order = await this.repository.getOrderByPaypalOrderId(related.order_id);
        if (order) await this.repository.cancelPendingOrder(order.id, this.now());
      } else if (event.event_type === "PAYMENT.CAPTURE.REFUNDED") {
        const order = await this.repository.getOrderByPaypalCaptureId(related.capture_id);
        if (order) await this.repository.markOrderRefunded(order.id, this.now());
      }
      await this.repository.completePaypalWebhookEvent(event.id, "processed");
      return { processed: true };
    } catch (error) {
      await this.repository.completePaypalWebhookEvent(event.id, "failed", error.code || "PAYPAL_WEBHOOK_PROCESSING_FAILED");
      throw error;
    }
  }

  async cancelExpiredPendingPayments() {
    const cutoff = this.now() - 24 * 3600000;
    const orders = await this.repository.listExpiredPendingPaymentOrders(cutoff);
    for (const order of orders) await this.repository.cancelPendingOrder(order.id, this.now());
    return orders.length;
  }
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run `node --test tests/payment-service.test.js`. Expected: all service tests PASS.

- [ ] **Step 5: Run adjacent domain and repository tests**

Run:

```bash
node --test tests/payments-domain.test.js tests/paypal-client.test.js tests/repository.test.js tests/payment-service.test.js
```

Expected: all selected tests PASS.

- [ ] **Step 6: Review diff checkpoint**

Run `git diff --check -- server/services/payment-service.js tests/payment-service.test.js`.

### Task 5: Fastify Payment Routes and Application Wiring

**Files:**

- Create: `server/routes/payments.js`
- Create: `tests/payment-routes.test.js`
- Modify: `server/app.js`
- Modify: `server/routes/public.js`
- Modify: `server/retention.js`

- [ ] **Step 1: Write failing route contract tests**

Register `registerPaymentRoutes` on a small Fastify instance with a fake payment service. Assert:

```js
test("PayPal config exposes no secret", async () => {
  const response = await app.inject({ method: "GET", url: "/api/v1/payments/paypal/config" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.currency, "USD");
  assert.equal(JSON.stringify(response.json()).includes("client-secret"), false);
});

test("creates and captures a PayPal order", async () => {
  const created = await app.inject({ method: "POST", url: "/api/v1/payments/paypal/orders", payload: validCustomer });
  assert.equal(created.statusCode, 201);
  const captured = await app.inject({ method: "POST", url: "/api/v1/payments/paypal/orders/PP-1/capture", payload: { checkoutToken: "token" } });
  assert.equal(captured.json().data.paymentStatus, "paid");
});

test("rejects an invalid PayPal webhook signature", async () => {
  const response = await app.inject({ method: "POST", url: "/api/v1/webhooks/paypal", payload: { id: "EV-1", event_type: "PAYMENT.CAPTURE.COMPLETED" } });
  assert.equal(response.statusCode, 400);
});
```

- [ ] **Step 2: Run route tests and verify RED**

Run `node --test tests/payment-routes.test.js`. Expected: FAIL because route registration does not exist.

- [ ] **Step 3: Implement thin payment routes**

Create `registerPaymentRoutes(app, { paymentService, auth })` with:

```js
app.get("/api/v1/payments/paypal/config", async () => ({ data: paymentService.publicConfig() }));
app.post("/api/v1/payments/paypal/orders", async (request, reply) => {
  const visitorToken = auth.ensureVisitorToken(reply, request);
  const data = await paymentService.createPaypalOrder({ visitorToken, userId: request.user?.id || null, customer: request.body || {} });
  return reply.code(201).send({ data });
});
app.post("/api/v1/payments/paypal/orders/:paypalOrderId/capture", async (request) => ({
  data: await paymentService.capturePaypalOrder({ paypalOrderId: request.params.paypalOrderId, checkoutToken: request.body?.checkoutToken, visitorToken: request.visitorToken }),
}));
app.get("/api/v1/orders/:orderNumber/confirmation", async (request) => ({ data: await paymentService.getConfirmation({ orderNumber: request.params.orderNumber, checkoutToken: request.query?.token }) }));
app.post("/api/v1/webhooks/paypal", async (request) => ({ data: await paymentService.processWebhook({ headers: request.headers, event: request.body || {} }) }));
```

Map validation, token, provider, and signature errors to stable 400/401/409/502 codes without returning PayPal raw messages.

- [ ] **Step 4: Wire dependencies in `buildApp`**

Extend `buildApp` dependency injection and wire the payment units explicitly:

```js
const paypalClient = injectedPaypalClient || createPaypalClient(config);
const paymentService = injectedPaymentService || new PaymentService({ repository, paypalClient });
registerPaymentRoutes(app, { paymentService, auth });

const retentionTimer = setInterval(() => Promise.all([
  cleanupExpiredData(repository),
  paymentService.cancelExpiredPendingPayments(),
]).catch((error) => app.log.error(error, "retention cleanup failed")), 86400000);
retentionTimer.unref?.();
```

Keep the timer `unref()` behavior. In tests, inject the fake service so no PayPal network call is possible.

- [ ] **Step 5: Make manual orders explicit and compatible**

In `server/routes/public.js`, call `validateCheckoutCustomer`, include city/postal/country in `customer`, and pass:

```js
const customer = validateCheckoutCustomer(request.body || {});
const order = await repository.createOrder({
  orderNumber,
  cartId: cart.id,
  userId: request.user?.id || null,
status: "pending_contact",
payment: { method: "manual", status: "unpaid", currencyCode: "USD" },
  customer: { ...customer, name: `${customer.firstName} ${customer.lastName}` },
  lines,
  subtotalCents,
});
```

Keep current cart clearing only after manual order creation succeeds.

- [ ] **Step 6: Run tests and verify GREEN**

Run:

```bash
node --test tests/payment-routes.test.js tests/payment-service.test.js tests/domain.test.js
```

Expected: all selected tests PASS.

- [ ] **Step 7: Review diff checkpoint**

Run `git diff --check` and verify no route returns `paypalClientSecret`, access tokens, or raw PayPal payloads.

### Task 6: Checkout UI and PayPal JS SDK Flow

**Files:**

- Modify: `checkout.html`
- Modify: `frontend-api.js`
- Modify: `styles.css`
- Create: `tests/paypal-checkout-ui.test.js`

- [ ] **Step 1: Write failing static UI tests**

Assert the checkout contains named `countryCode`, `city`, and `postalCode` fields; stacked PayPal/manual sections; a PayPal mount node; loading/error status; and no hard-coded PayPal Client ID:

```js
test("checkout exposes stacked PayPal and manual order paths", async () => {
  const html = await read("checkout.html");
  const script = await read("frontend-api.js");
  assert.match(html, /name="countryCode"/);
  assert.match(html, /id="paypalButtons"/);
  assert.match(html, /data-payment-method="manual"/);
  assert.match(script, /payments\/paypal\/config/);
  assert.match(script, /payments\/paypal\/orders/);
  assert.doesNotMatch(html, /PAYPAL_CLIENT_SECRET|client-secret/);
});
```

- [ ] **Step 2: Run UI test and verify RED**

Run `node --test tests/paypal-checkout-ui.test.js`. Expected: FAIL on missing payment UI and script calls.

- [ ] **Step 3: Update checkout markup**

Give every shipping field a `name`, use ISO country values (`US`, `GB`, `CA`, `AU`), and keep one form. Replace the current single submit button with:

```html
<section class="checkout-payment" aria-labelledby="paymentHeading">
  <div><span class="eyebrow">Complete order</span><h2 id="paymentHeading">完成订单</h2></div>
  <article class="checkout-payment__card checkout-payment__card--paypal">
    <div class="checkout-payment__heading"><strong>推荐 · PayPal 在线支付</strong><span id="paypalAmount">$0.00 USD</span></div>
    <p>在 PayPal 安全页面付款；符合条件时可使用银行卡。</p>
    <div id="paypalButtons" aria-live="polite"></div>
    <button type="button" class="button" id="paypalRetry" hidden>重新加载 PayPal</button>
  </article>
  <div class="checkout-payment__or"><span>或</span></div>
  <article class="checkout-payment__card" data-payment-method="manual">
    <strong>先提交订单，稍后联系确认</strong>
    <p>暂不在线付款，我们会联系你确认付款与配送。</p>
    <button class="button button--primary" type="submit">提交人工联系订单</button>
  </article>
  <p id="checkoutMessage" role="status" aria-live="polite"></p>
</section>
```

- [ ] **Step 4: Split checkout behavior into named functions**

Inside `frontend-api.js`, keep the IIFE and add complete focused functions. `showCheckoutMessage` updates `#checkoutMessage` and its `data-state`:

```js
var paypalSdkPromise;
var paypalActions;
var activeCheckout;

function checkoutCustomer(form) {
  return Object.fromEntries(new FormData(form));
}

function validateCheckoutForm(form) {
  return form.reportValidity();
}

function showCheckoutMessage(message, isError) {
  var target = document.querySelector("#checkoutMessage");
  if (!target) return;
  target.textContent = message;
  target.dataset.state = isError ? "error" : "success";
}

function setCheckoutBusy(form, busy) {
  form.querySelectorAll("button").forEach(function (button) { button.disabled = busy; });
  if (paypalActions) {
    if (busy || !form.checkValidity()) paypalActions.disable();
    else paypalActions.enable();
  }
  form.setAttribute("aria-busy", String(busy));
}

function loadPaypalSdk(clientId, currency) {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (paypalSdkPromise) return paypalSdkPromise;
  paypalSdkPromise = new Promise(function (resolve, reject) {
    var script = document.createElement("script");
    script.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(clientId) + "&currency=" + encodeURIComponent(currency) + "&intent=capture&components=buttons&enable-funding=card";
    script.onload = function () { resolve(window.paypal); };
    script.onerror = function () { paypalSdkPromise = null; reject(new Error("PAYPAL_SDK_FAILED")); };
    document.head.appendChild(script);
  });
  return paypalSdkPromise;
}

async function submitManualOrder(form) {
  if (!validateCheckoutForm(form)) return;
  setCheckoutBusy(form, true);
  try {
    var customer = checkoutCustomer(form);
    var order = await request("/orders", { method: "POST", body: JSON.stringify(customer) });
    showCheckoutMessage("订单 " + order.orderNumber + " 已提交，我们会联系你确认付款与配送。");
    form.reset();
  } catch (error) {
    showCheckoutMessage(error.message, true);
  } finally { setCheckoutBusy(form, false); }
}

function renderPaypalButtons(form) {
  return window.paypal.Buttons({
    style: { layout: "vertical", shape: "rect", label: "paypal" },
    onInit: function (_, actions) {
      paypalActions = actions;
      actions.disable();
      ["input", "change"].forEach(function (eventName) {
        form.addEventListener(eventName, function () { if (form.checkValidity()) actions.enable(); else actions.disable(); });
      });
    },
    createOrder: async function () {
      if (!validateCheckoutForm(form)) throw new Error("请先填写完整配送信息。");
      setCheckoutBusy(form, true);
      activeCheckout = await request("/payments/paypal/orders", { method: "POST", body: JSON.stringify(checkoutCustomer(form)) });
      setCheckoutBusy(form, false);
      return activeCheckout.paypalOrderId;
    },
    onApprove: async function (data) {
      setCheckoutBusy(form, true);
      try {
        var paid = await request("/payments/paypal/orders/" + encodeURIComponent(data.orderID) + "/capture", { method: "POST", body: JSON.stringify({ checkoutToken: activeCheckout.checkoutToken }) });
        window.location.assign("./order-confirmation.html?order=" + encodeURIComponent(paid.orderNumber) + "&token=" + encodeURIComponent(activeCheckout.checkoutToken));
      } catch (error) {
        showCheckoutMessage(error.message, true);
        setCheckoutBusy(form, false);
      }
    },
    onCancel: function () { setCheckoutBusy(form, false); showCheckoutMessage("你已取消 PayPal 支付，购物车仍为你保留。"); },
    onError: function () { setCheckoutBusy(form, false); showCheckoutMessage("PayPal 暂时无法完成付款，请重试或选择人工联系。", true); },
  }).render("#paypalButtons");
}
```

Use `actions.disable()` in `onInit`, listen to form `input`/`change`, and call `actions.enable()` only when all required fields pass `checkValidity()`. Do not store shipping data or tokens in `localStorage`.

- [ ] **Step 5: Add payment styling**

Add focused styles; the official SDK renders PayPal branding:

```css
.checkout-payment { display: grid; gap: 16px; padding-top: 8px; }
.checkout-payment__card { display: grid; gap: 12px; padding: 18px; border: 1px solid rgba(33, 49, 38, .12); border-radius: 18px; background: #fffdfa; }
.checkout-payment__card--paypal { border: 2px solid var(--heading); background: rgba(255, 250, 244, .98); }
.checkout-payment__heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.checkout-payment__heading span { color: var(--heading); font-weight: 800; white-space: nowrap; }
.checkout-payment__or { display: flex; align-items: center; gap: 12px; color: var(--muted); font-size: .78rem; }
.checkout-payment__or::before, .checkout-payment__or::after { flex: 1; height: 1px; background: rgba(33, 49, 38, .12); content: ""; }
#paypalButtons { min-height: 45px; }
#checkoutMessage[data-state="error"] { color: #9b3f36; }
#checkoutMessage[data-state="success"] { color: var(--heading); }
.checkout-form[aria-busy="true"] { opacity: .78; }
@media (max-width: 640px) {
  .checkout-payment__heading { align-items: flex-start; flex-direction: column; }
  .checkout-payment__card { padding: 15px; }
}
```

Do not draw or imitate a PayPal logo in local CSS or HTML.

- [ ] **Step 6: Run UI test and verify GREEN**

Run `node --test tests/paypal-checkout-ui.test.js`. Expected: PASS.

- [ ] **Step 7: Run existing checkout-adjacent tests**

Run `node --test tests/repository.test.js tests/payment-routes.test.js tests/paypal-checkout-ui.test.js`. Expected: PASS.

- [ ] **Step 8: Browser validation checkpoint**

Use the Browser plugin against the local app. Test the flow:

`checkout.html -> invalid form keeps PayPal disabled -> valid form enables PayPal -> mocked/Sandbox approval -> success redirect`.

At 1440×900 and 390×844 verify no clipping, no console errors, the PayPal card is primary, the manual path remains visible, and cancel/error messages preserve the cart.

### Task 7: Confirmation Page and Admin Payment Visibility

**Files:**

- Create: `order-confirmation.html`
- Modify: `frontend-api.js`
- Modify: `styles.css`
- Modify: `server/routes/admin.js`
- Modify: `admin/admin.js`
- Modify: `admin/admin.css`
- Modify: `tests/paypal-checkout-ui.test.js`
- Modify: `tests/admin-workspace.test.js`

- [ ] **Step 1: Extend failing UI/admin tests**

Add exact assertions:

```js
const confirmation = await read("order-confirmation.html");
const frontend = await read("frontend-api.js");
const admin = await read("admin/admin.js");
assert.match(confirmation, /id="orderConfirmation"/);
assert.match(frontend, /\/orders\/.*\/confirmation\?token=/);
assert.match(admin, /paymentMethodLabel/);
assert.match(admin, /paymentStatusLabel/);
assert.doesNotMatch(admin, /data-paypal-refund|发起退款/);
```

- [ ] **Step 2: Run tests and verify RED**

Run `node --test tests/paypal-checkout-ui.test.js tests/admin-workspace.test.js`. Expected: FAIL on missing confirmation and admin payment presentation.

- [ ] **Step 3: Build the limited confirmation page**

Use the existing site header and design language. Add a single `#orderConfirmation` panel with loading text. In `frontend-api.js`, implement:

```js
async function syncOrderConfirmation() {
  var target = document.querySelector("#orderConfirmation");
  if (!target) return;
  var params = new URLSearchParams(window.location.search);
  var orderNumber = params.get("order") || "";
  var token = params.get("token") || "";
  try {
    var order = await request("/orders/" + encodeURIComponent(orderNumber) + "/confirmation?token=" + encodeURIComponent(token));
    target.innerHTML = "<span class=\"eyebrow\">Payment complete</span><h1>付款已确认</h1><p>订单 " + escapeText(order.orderNumber) + " · " + escapeText(order.subtotal) + " USD</p><p>交易参考号 " + escapeText(order.transactionReference || "—") + "</p><a class=\"button button--primary\" href=\"./products.html\">继续浏览</a>";
  } catch {
    target.innerHTML = "<h1>无法读取订单详情</h1><p>请检查链接，或联系 SinoHerb 支持。</p>";
  }
}
```

Call `syncOrderConfirmation()` from the existing startup sequence.

Render only escaped order number, localized payment status, `$xx.xx USD`, masked transaction reference, and next-step text. Invalid/expired tokens show a neutral “无法读取订单详情，请联系支持” message without confirming whether the order exists.

- [ ] **Step 4: Add admin payment columns and labels**

Return payment fields from admin order list/detail routes. Add label helpers:

```js
const paymentMethodLabel = (value) => ({ paypal: "PayPal", manual: "人工联系" }[value] || "未知");
const paymentStatusLabel = (value) => ({ pending: "待支付", paid: "已付款", unpaid: "未付款", failed: "失败", refunded: "已退款" }[value] || "未知");
```

Show both in the order table/detail. Do not add refund, Capture, or retry controls.

- [ ] **Step 5: Run tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 6: Browser validation checkpoint**

Verify a paid confirmation page, an invalid-token state, and admin rows for manual unpaid, PayPal pending, PayPal paid, and refunded orders.

### Task 8: Setup Documentation, Deployment Safety, and Full Verification

**Files:**

- Create: `docs/paypal-setup.md`
- Modify: `README.md`
- Modify: `tests/deployment.test.js`
- Modify: `docs/superpowers/specs/2026-08-22-paypal-checkout-design.md` only if implementation uncovers a confirmed contradiction.

- [ ] **Step 1: Write failing documentation assertions**

Add exact documentation assertions:

```js
const paypalDocs = read("docs/paypal-setup.md");
assert.match(paypalDocs, /Sandbox Business/);
assert.match(paypalDocs, /Sandbox Personal/);
assert.match(paypalDocs, /PAYMENT\.CAPTURE\.COMPLETED/);
assert.match(paypalDocs, /PAYMENT\.CAPTURE\.REFUNDED/);
assert.match(paypalDocs, /PAYPAL_ENV=live/);
assert.match(paypalDocs, /HTTPS/);
assert.match(paypalDocs, /最小金额真实交易/);
assert.match(paypalDocs, /PayPal 后台退款/);
```

- [ ] **Step 2: Run deployment test and verify RED**

Run `node --test tests/deployment.test.js`. Expected: FAIL because setup documentation does not exist.

- [ ] **Step 3: Write PayPal setup documentation**

Document exact dashboard navigation at a durable conceptual level:

1. Create a PayPal Developer account and Sandbox Business/Personal accounts.
2. Create a Sandbox app and copy Client ID/Secret into `.env`.
3. Configure the HTTPS Webhook endpoint `/api/v1/webhooks/paypal`.
4. Subscribe to `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, and `PAYMENT.CAPTURE.REFUNDED`.
5. Copy the Webhook ID to `PAYPAL_WEBHOOK_ID`.
6. Run approve, cancel, duplicate Capture, replay, and refund tests.
7. Create a Live app and Live Webhook only after Sandbox passes.
8. Set `PAYPAL_ENV=live`, Live Client ID/Secret/Webhook ID, deploy over HTTPS, and execute one minimal real transaction plus dashboard refund.

State explicitly that secrets never belong in Git, browser code, screenshots, or support messages.

- [ ] **Step 4: Link setup docs and verify deployment config**

Link `docs/paypal-setup.md` from `README.md`. Confirm `.env.example` contains blanks only and Docker startup applies migration 006.

- [ ] **Step 5: Run the full automated suite**

Run:

```bash
node --check server/paypal/client.js
node --check server/services/payment-service.js
node --check server/routes/payments.js
node --check frontend-api.js
node --test
```

Expected: syntax checks exit 0 and the entire Node test suite reports 0 failures.

- [ ] **Step 6: Run final rendered QA**

With PayPal disabled, verify manual checkout still works. With Sandbox credentials, verify PayPal approve, cancel, SDK failure, Capture timeout/recovery, confirmation page, admin payment labels, and Webhook refund synchronization. Check 1440×900 and 390×844, page identity, meaningful DOM, no framework overlay, console health, screenshots, and target interactions.

- [ ] **Step 7: Security and privacy review**

Run:

```bash
rg -n "PAYPAL_CLIENT_SECRET|access_token|client-secret" checkout.html frontend-api.js order-confirmation.html admin
rg -n "console\.(log|error).*paypalClientSecret|console\.(log|error).*access_token" server
git diff --check
git status --short
```

Expected: both secret/log searches return no matches; no whitespace errors; only intended files changed. Review all payment logs to ensure they contain event/request/reference IDs but no credentials or full payer payloads.

- [ ] **Step 8: Final diff checkpoint**

Summarize automated and Sandbox evidence, list any untested Live behavior, and ask for explicit authorization before creating commits or publishing changes.
