import assert from "node:assert/strict";
import test from "node:test";
import { formatUsdAmount, validateCapture, validateCheckoutCustomer } from "../server/domain/payments.js";

test("formats integer cents as PayPal USD amounts", () => {
  assert.equal(formatUsdAmount(6800), "68.00");
  assert.throws(() => formatUsdAmount(68.5), /integer cents/);
});

test("validates complete checkout customer data", () => {
  assert.deepEqual(validateCheckoutCustomer({
    firstName: "Alex",
    lastName: "Wong",
    email: "alex@example.com",
    phone: "+1 555 000 0000",
    address: "1 Main St",
    city: "Toronto",
    postalCode: "M5V 2T6",
    countryCode: "CA",
    notes: "",
  }).countryCode, "CA");
  assert.throws(() => validateCheckoutCustomer({ firstName: "Alex" }), /配送信息/);
});

test("rejects a Capture whose amount or invoice does not match", () => {
  const completed = {
    status: "COMPLETED",
    invoiceId: "SH-1",
    currencyCode: "USD",
    value: "68.00",
    captureId: "CAP-1",
  };
  assert.equal(validateCapture(completed, { orderNumber: "SH-1", subtotalCents: 6800 }).captureId, "CAP-1");
  assert.throws(() => validateCapture({ ...completed, value: "67.00" }, { orderNumber: "SH-1", subtotalCents: 6800 }), /金额/);
});
