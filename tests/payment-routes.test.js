import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { buildApp } from "../server/app.js";
import { loadConfig } from "../server/config.js";
import { MemoryRepository } from "../server/repositories/memory-repository.js";
import { registerPaymentRoutes } from "../server/routes/payments.js";

const validCustomer = {
  firstName: "Alex",
  lastName: "Wong",
  phone: "+1",
  email: "alex@example.com",
  address: "1 Main St",
  city: "Toronto",
  postalCode: "M5V 2T6",
  countryCode: "CA",
};

function buildPaymentApp() {
  const app = Fastify();
  const paymentService = {
    publicConfig: () => ({ enabled: true, clientId: "client-id", currency: "USD", environment: "sandbox" }),
    async createPaypalOrder() { return { orderNumber: "SH-1", paypalOrderId: "PP-1", checkoutToken: "token" }; },
    async capturePaypalOrder() { return { orderNumber: "SH-1", status: "pending_contact", paymentStatus: "paid" }; },
    async getConfirmation() { return { orderNumber: "SH-1", paymentStatus: "paid" }; },
    async processWebhook() { throw new Error("PayPal Webhook 签名无效。"); },
  };
  registerPaymentRoutes(app, {
    paymentService,
    auth: { ensureVisitorToken() { return "visitor"; } },
  });
  return app;
}

const injectedPaymentService = {
  publicConfig: () => ({ enabled: false, clientId: "", currency: "USD", environment: "sandbox" }),
  async cancelExpiredPendingPayments() { return 0; },
};

test("PayPal config exposes no secret", async () => {
  const app = buildPaymentApp();
  const response = await app.inject({ method: "GET", url: "/api/v1/payments/paypal/config" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.currency, "USD");
  assert.equal(JSON.stringify(response.json()).includes("client-secret"), false);
  await app.close();
});

test("creates and captures a PayPal order", async () => {
  const app = buildPaymentApp();
  const created = await app.inject({ method: "POST", url: "/api/v1/payments/paypal/orders", payload: validCustomer });
  assert.equal(created.statusCode, 201);
  const captured = await app.inject({
    method: "POST",
    url: "/api/v1/payments/paypal/orders/PP-1/capture",
    payload: { checkoutToken: "token" },
  });
  assert.equal(captured.json().data.paymentStatus, "paid");
  await app.close();
});

test("rejects an invalid PayPal webhook signature", async () => {
  const app = buildPaymentApp();
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/webhooks/paypal",
    payload: { id: "EV-1", event_type: "PAYMENT.CAPTURE.COMPLETED" },
  });
  assert.equal(response.statusCode, 400);
  await app.close();
});

test("buildApp registers the injected payment service", async () => {
  const app = buildApp({ config: loadConfig({ NODE_ENV: "test" }), paymentService: injectedPaymentService });
  const response = await app.inject({ method: "GET", url: "/api/v1/payments/paypal/config" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.enabled, false);
  await app.close();
});

test("manual checkout stores full address and unpaid metadata", async () => {
  const repository = new MemoryRepository({
    products: [{ id: "p1", slug: "tea", name: "Tea", priceCents: 3200, stockQuantity: 2, status: "active", sortOrder: 1 }],
  });
  const app = buildApp({ config: loadConfig({ NODE_ENV: "test" }), repository, paymentService: injectedPaymentService });
  const cartResponse = await app.inject({ method: "POST", url: "/api/v1/cart/items", payload: { productId: "p1", quantity: 1 } });
  const visitorCookie = cartResponse.headers["set-cookie"];
  const response = await app.inject({ method: "POST", url: "/api/v1/orders", headers: { cookie: visitorCookie }, payload: validCustomer });

  assert.equal(response.statusCode, 201);
  const order = await repository.getOrderByNumber(response.json().data.orderNumber);
  assert.equal(order.paymentMethod, "manual");
  assert.equal(order.paymentStatus, "unpaid");
  assert.equal(order.city, "Toronto");
  await app.close();
});
