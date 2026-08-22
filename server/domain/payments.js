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
