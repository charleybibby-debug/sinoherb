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
  const repository = new MemoryRepository();
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
