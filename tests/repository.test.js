import assert from "node:assert/strict";
import test from "node:test";
import { MemoryRepository } from "../server/repositories/memory-repository.js";

test("memory repository persists an anonymous cart and updates quantities", () => {
  const repository = new MemoryRepository({
    products: [{ id: "p1", slug: "tea", name: "Tea", priceCents: 3200, stockQuantity: 5, status: "active", sortOrder: 1 }],
  });
  repository.saveCartItem("visitor-token", "p1", 2);
  const cart = repository.saveCartItem("visitor-token", "p1", 3);
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].quantity, 3);
});

test("memory repository creates a pending contact order", () => {
  const repository = new MemoryRepository({
    products: [{ id: "p1", slug: "tea", name: "Tea", priceCents: 3200, stockQuantity: 2, status: "active", sortOrder: 1 }],
  });
  const order = repository.createOrder({
    orderNumber: "SH-TEST",
    cartId: "cart-1",
    customer: { name: "Test", phone: "13800000000", address: "Shanghai" },
    lines: [{ productId: "p1", productName: "Tea", unitPriceCents: 3200, quantity: 1, lineTotalCents: 3200 }],
    subtotalCents: 3200,
  });
  assert.equal(order.status, "pending_contact");
  assert.equal(order.items[0].lineTotalCents, 3200);
});

test("memory repository persists PayPal payment metadata idempotently", async () => {
  const repository = new MemoryRepository({
    products: [{ id: "p1", slug: "tea", name: "Tea", priceCents: 3200, stockQuantity: 2, status: "active", sortOrder: 1 }],
  });
  const order = await repository.createOrder({
    orderNumber: "SH-PAY",
    cartId: "cart-1",
    customer: { name: "Alex Wong", phone: "1", address: "1 Main St", city: "Toronto", postalCode: "M5V", countryCode: "CA" },
    lines: [{ productId: "p1", productSlug: "tea", productName: "Tea", unitPriceCents: 3200, quantity: 1, lineTotalCents: 3200 }],
    subtotalCents: 3200,
    payment: { method: "paypal", status: "pending", currencyCode: "USD", confirmationTokenHash: "hash" },
    status: "pending_payment",
  });

  await repository.attachPaypalOrder(order.id, "PP-1");
  const paid = await repository.markOrderPaid(order.id, { paypalCaptureId: "CAP-1", paidAt: 1000 });

  assert.equal(paid.paymentStatus, "paid");
  assert.equal(repository.listOrders()[0].paymentStatus, "paid");
  assert.equal((await repository.getOrderByPaypalOrderId("PP-1")).id, order.id);
  assert.equal(await repository.recordPaypalWebhookEvent({ eventId: "EV-1", eventType: "PAYMENT.CAPTURE.COMPLETED", resourceId: "CAP-1" }), true);
  assert.equal(await repository.recordPaypalWebhookEvent({ eventId: "EV-1", eventType: "PAYMENT.CAPTURE.COMPLETED", resourceId: "CAP-1" }), false);
});

test("releases reserved inventory only once", async () => {
  const repository = new MemoryRepository({
    products: [{ id: "p1", slug: "tea", name: "Tea", priceCents: 3200, stockQuantity: 2, status: "active", sortOrder: 1 }],
  });
  const order = await repository.createOrder({
    orderNumber: "SH-RESERVE",
    cartId: "cart-1",
    customer: { name: "Alex Wong", phone: "1", address: "1 Main St", city: "Toronto", postalCode: "M5V", countryCode: "CA" },
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

test("memory repository supports media replacement and restore", () => {
  const repository = new MemoryRepository({
    mediaAssets: [{ slotKey: "home.hero", pageGroup: "首页", label: "首页主视觉", defaultPath: "/default.svg", altText: "默认" }],
  });
  repository.updateMediaAsset("home.hero", { filePath: "media/first.png", backupPaths: [] });
  repository.updateMediaAsset("home.hero", { filePath: "media/second.png", backupPaths: ["media/first.png"] });
  assert.equal(repository.getMediaAssetBySlot("home.hero").filePath, "media/second.png");
  repository.restoreMediaAsset("home.hero");
  assert.equal(repository.getMediaAssetBySlot("home.hero").filePath, "media/first.png");
});
