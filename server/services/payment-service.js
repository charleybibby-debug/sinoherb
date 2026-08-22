import { timingSafeEqual } from "node:crypto";
import { createToken, hashToken } from "../auth.js";
import { calculateOrderLines } from "../domain/orders.js";
import { formatUsdAmount, validateCapture, validateCheckoutCustomer } from "../domain/payments.js";

const tokenMatches = (token, expectedHash) => {
  const actual = Buffer.from(hashToken(String(token || "")));
  const expected = Buffer.from(String(expectedHash || ""));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

const paymentResult = (order) => ({
  orderNumber: order.orderNumber,
  status: order.status,
  paymentStatus: order.paymentStatus,
  subtotalCents: order.subtotalCents,
  subtotal: "$" + formatUsdAmount(order.subtotalCents),
});

export class PaymentService {
  constructor({
    repository,
    paypalClient,
    tokenFactory = createToken,
    now = Date.now,
    orderNumberFactory = () => "SH-" + Date.now().toString(36).toUpperCase() + "-" + createToken().slice(0, 6).toUpperCase(),
  }) {
    this.repository = repository;
    this.paypalClient = paypalClient;
    this.tokenFactory = tokenFactory;
    this.now = now;
    this.orderNumberFactory = orderNumberFactory;
  }

  publicConfig() {
    return this.paypalClient.publicConfig();
  }

  async createPaypalOrder({ visitorToken, userId = null, customer: input }) {
    const customer = validateCheckoutCustomer(input);
    const cart = await this.repository.getCart(visitorToken);
    if (!cart?.items?.length) throw new Error("购物车为空。");
    const products = (await Promise.all(cart.items.map((item) => this.repository.getProductById(item.productId)))).filter(Boolean);
    const lines = calculateOrderLines(cart.items, products);
    const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
    const orderNumber = this.orderNumberFactory();
    const checkoutToken = this.tokenFactory();
    const order = await this.repository.createOrder({
      orderNumber,
      cartId: cart.id,
      userId,
      status: "pending_payment",
      customer: { ...customer, name: `${customer.firstName} ${customer.lastName}` },
      lines,
      subtotalCents,
      payment: {
        method: "paypal",
        status: "pending",
        currencyCode: "USD",
        confirmationTokenHash: hashToken(checkoutToken),
      },
    });
    try {
      const remote = await this.paypalClient.createOrder({
        orderNumber,
        amount: formatUsdAmount(subtotalCents),
        requestId: `create-${orderNumber}`,
      });
      await this.repository.attachPaypalOrder(order.id, remote.paypalOrderId);
      return { orderNumber, paypalOrderId: remote.paypalOrderId, checkoutToken };
    } catch (error) {
      await this.repository.cancelPendingOrder(order.id, this.now());
      throw error;
    }
  }

  async capturePaypalOrder({ paypalOrderId, checkoutToken }) {
    const order = await this.repository.getOrderByPaypalOrderId(paypalOrderId);
    if (!order || !tokenMatches(checkoutToken, order.confirmationTokenHash)) throw new Error("支付确认信息无效。");
    if (order.paymentStatus === "paid") return paymentResult(order);
    const capture = await this.paypalClient.captureOrder(paypalOrderId, `capture-${order.orderNumber}`);
    try {
      validateCapture(capture, order);
    } catch (error) {
      await this.repository.markOrderPaymentFailed(order.id, this.now());
      throw error;
    }
    const paid = await this.repository.markOrderPaid(order.id, { paypalCaptureId: capture.captureId, paidAt: this.now() });
    await this.repository.clearCartById(order.cartId);
    return paymentResult(paid);
  }

  async getConfirmation({ orderNumber, checkoutToken }) {
    const order = await this.repository.getOrderByNumber(orderNumber);
    if (!order || !tokenMatches(checkoutToken, order.confirmationTokenHash)) throw new Error("订单确认信息无效。");
    if (!["paid", "refunded"].includes(order.paymentStatus)) throw new Error("订单付款尚未完成。");
    return {
      ...paymentResult(order),
      transactionReference: order.paypalCaptureId ? "••••" + order.paypalCaptureId.slice(-6) : null,
      createdAt: order.createdAt,
    };
  }

  async processWebhook({ headers, event }) {
    if (!await this.paypalClient.verifyWebhook({ headers, event })) throw new Error("PayPal Webhook 签名无效。");
    const inserted = await this.repository.recordPaypalWebhookEvent({
      eventId: event.id,
      eventType: event.event_type,
      resourceId: event.resource?.id || null,
    });
    if (!inserted) return { duplicate: true };
    try {
      const resource = event.resource || {};
      const related = resource.supplementary_data?.related_ids || {};
      if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
        const order = await this.repository.getOrderByPaypalOrderId(related.order_id);
        if (!order || resource.status !== "COMPLETED" || resource.amount?.currency_code !== "USD" || resource.amount?.value !== formatUsdAmount(order.subtotalCents)) {
          throw new Error("PayPal Webhook 金额或订单不一致。");
        }
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
