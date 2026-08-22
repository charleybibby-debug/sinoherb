import assert from "node:assert/strict";
import test from "node:test";
import { MemoryRepository } from "../server/repositories/memory-repository.js";
import { PaymentService } from "../server/services/payment-service.js";

const validCustomer = {
  firstName: "Alex",
  lastName: "Wong",
  phone: "+1",
  email: "alex@example.com",
  address: "1 Main St",
  city: "Toronto",
  postalCode: "M5V 2T6",
  countryCode: "CA",
  notes: "",
};

const validWebhookHeaders = {
  "paypal-transmission-id": "TX-1",
  "paypal-transmission-time": "TIME",
  "paypal-transmission-sig": "SIG",
  "paypal-cert-url": "CERT",
  "paypal-auth-algo": "SHA256withRSA",
};

function seededRepository() {
  const repository = new MemoryRepository({
    products: [{ id: "p1", slug: "tea", name: "Tea", priceCents: 3200, stockQuantity: 2, status: "active", sortOrder: 1 }],
  });
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
  const service = new PaymentService({
    repository,
    paypalClient,
    tokenFactory: () => "token",
    now: () => 1000,
    orderNumberFactory: () => "SH-PAID",
  });
  await service.createPaypalOrder({ visitorToken: "visitor", customer: validCustomer });
  await service.capturePaypalOrder({ paypalOrderId: "PP-PAID", checkoutToken: "token", visitorToken: "visitor" });
  return { repository, service };
}

test("creates and captures a PayPal order from server prices", async () => {
  const repository = seededRepository();
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

  const created = await service.createPaypalOrder({ visitorToken: "visitor", userId: null, customer: validCustomer });
  assert.equal(created.paypalOrderId, "PP-1");
  assert.equal(created.checkoutToken, "checkout-token");
  assert.equal(paypalClient.created.amount, "32.00");

  const captured = await service.capturePaypalOrder({ paypalOrderId: "PP-1", checkoutToken: "checkout-token", visitorToken: "visitor" });
  assert.equal(captured.paymentStatus, "paid");
  assert.equal((await repository.getCart("visitor")).items.length, 0);
});

test("compensates stock when PayPal Create fails", async () => {
  const repository = seededRepository();
  const service = new PaymentService({
    repository,
    paypalClient: {
      publicConfig: () => ({ enabled: true }),
      async createOrder() { throw new Error("provider failed"); },
    },
    tokenFactory: () => "token",
    now: () => 1000,
    orderNumberFactory: () => "SH-FAIL",
  });

  await assert.rejects(() => service.createPaypalOrder({ visitorToken: "visitor", customer: validCustomer }));
  const order = await repository.getOrderByNumber("SH-FAIL");
  assert.equal(order.status, "cancelled");
  assert.equal(order.paymentStatus, "failed");
  assert.equal(repository.getProductById("p1").stockQuantity, 2);
  assert.equal((await repository.getCart("visitor")).items.length, 1);
});

test("processes a refund Webhook only once", async () => {
  const fixture = await paidOrderFixture();
  const event = {
    id: "EV-REFUND",
    event_type: "PAYMENT.CAPTURE.REFUNDED",
    resource: { id: "REF-1", links: [], supplementary_data: { related_ids: { capture_id: "CAP-1" } } },
  };

  assert.equal((await fixture.service.processWebhook({ headers: validWebhookHeaders, event })).processed, true);
  assert.equal((await fixture.service.processWebhook({ headers: validWebhookHeaders, event })).duplicate, true);
  assert.equal((await fixture.repository.getOrderByPaypalCaptureId("CAP-1")).paymentStatus, "refunded");
});

test("does not clear cart or release stock after a mismatched completed Capture", async () => {
  const repository = seededRepository();
  const paypalClient = {
    publicConfig: () => ({ enabled: true }),
    async createOrder() { return { paypalOrderId: "PP-MISMATCH" }; },
    async captureOrder() { return { status: "COMPLETED", captureId: "CAP-X", invoiceId: "SH-MISMATCH", currencyCode: "USD", value: "31.00" }; },
  };
  const service = new PaymentService({
    repository,
    paypalClient,
    tokenFactory: () => "token",
    now: () => 1000,
    orderNumberFactory: () => "SH-MISMATCH",
  });

  await service.createPaypalOrder({ visitorToken: "visitor", customer: validCustomer });
  await assert.rejects(
    () => service.capturePaypalOrder({ paypalOrderId: "PP-MISMATCH", checkoutToken: "token", visitorToken: "visitor" }),
    /金额/,
  );
  const order = await repository.getOrderByPaypalOrderId("PP-MISMATCH");
  assert.equal(order.paymentStatus, "failed");
  assert.equal(repository.getProductById("p1").stockQuantity, 1);
  assert.equal((await repository.getCart("visitor")).items.length, 1);
});

test("releases failed pending-payment inventory after 24 hours", async () => {
  const repository = seededRepository();
  const service = new PaymentService({
    repository,
    paypalClient: {
      publicConfig: () => ({ enabled: true }),
      async createOrder() { return { paypalOrderId: "PP-EXPIRED" }; },
      async captureOrder() { return { status: "COMPLETED", captureId: "CAP-X", invoiceId: "SH-EXPIRED", currencyCode: "USD", value: "31.00" }; },
    },
    tokenFactory: () => "token",
    now: () => Date.now() + 25 * 3600000,
    orderNumberFactory: () => "SH-EXPIRED",
  });

  await service.createPaypalOrder({ visitorToken: "visitor", customer: validCustomer });
  await assert.rejects(() => service.capturePaypalOrder({ paypalOrderId: "PP-EXPIRED", checkoutToken: "token" }), /金额/);
  assert.equal(await service.cancelExpiredPendingPayments(), 1);
  assert.equal(repository.getProductById("p1").stockQuantity, 2);
});

test("does not expose a confirmation result before payment completes", async () => {
  const repository = seededRepository();
  const service = new PaymentService({
    repository,
    paypalClient: {
      publicConfig: () => ({ enabled: true }),
      async createOrder() { return { paypalOrderId: "PP-PENDING" }; },
    },
    tokenFactory: () => "token",
    orderNumberFactory: () => "SH-PENDING",
  });

  await service.createPaypalOrder({ visitorToken: "visitor", customer: validCustomer });
  await assert.rejects(() => service.getConfirmation({ orderNumber: "SH-PENDING", checkoutToken: "token" }), /尚未完成/);
});
