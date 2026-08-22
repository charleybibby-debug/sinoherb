import assert from "node:assert/strict";
import test from "node:test";
import { buildFallbackResult, validateConstitutionResult } from "../server/domain/constitution.js";
import { calculateOrderLines, transitionOrderStatus } from "../server/domain/orders.js";

test("validates structured constitution results and rejects unknown types", () => {
  const result = buildFallbackResult([{ content: "最近总是睡不好，压力很大" }]);
  assert.equal(result.primaryType, "qiStagnation");
  assert.throws(() => validateConstitutionResult({ ...result, primaryType: "unknown" }));
});

test("calculates order lines from server product prices", () => {
  const lines = calculateOrderLines(
    [{ productId: "p1", quantity: 2 }],
    [{ id: "p1", slug: "tea", name: "Tea", priceCents: 3200, stockQuantity: 3, status: "active" }],
  );
  assert.equal(lines[0].lineTotalCents, 6400);
});

test("allows only valid forward order transitions", () => {
  assert.equal(transitionOrderStatus("pending_contact", "contacted"), "contacted");
  assert.equal(transitionOrderStatus("pending_payment", "pending_contact"), "pending_contact");
  assert.equal(transitionOrderStatus("pending_payment", "cancelled"), "cancelled");
  assert.throws(() => transitionOrderStatus("pending_payment", "completed"));
  assert.throws(() => transitionOrderStatus("completed", "pending_contact"));
});
