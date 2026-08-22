import { HttpError, badRequest } from "../http-errors.js";

function paymentHttpError(error) {
  if (error instanceof HttpError) return error;
  if (["PAYPAL_TIMEOUT", "PAYPAL_PROVIDER_ERROR", "PAYPAL_UNAVAILABLE"].includes(error.code)) {
    return new HttpError(502, error.code, "PayPal 暂时不可用，请稍后重试或选择人工联系。");
  }
  if (/Webhook 签名/.test(error.message || "")) return badRequest("INVALID_PAYPAL_WEBHOOK", "PayPal Webhook 签名无效。");
  if (/确认信息无效/.test(error.message || "")) return new HttpError(401, "INVALID_CHECKOUT_TOKEN", "支付确认信息无效。");
  if (/金额|订单编号|capture conflict/i.test(error.message || "")) return new HttpError(409, "PAYPAL_PAYMENT_MISMATCH", "PayPal 支付信息与订单不一致。");
  return badRequest("INVALID_PAYMENT_REQUEST", error.message || "支付请求无效。");
}

async function translatePaymentError(action) {
  try {
    return await action();
  } catch (error) {
    throw paymentHttpError(error);
  }
}

export function registerPaymentRoutes(app, { paymentService, auth }) {
  app.get("/api/v1/payments/paypal/config", async () => ({ data: paymentService.publicConfig() }));

  app.post("/api/v1/payments/paypal/orders", async (request, reply) => translatePaymentError(async () => {
    const visitorToken = auth.ensureVisitorToken(reply, request);
    const data = await paymentService.createPaypalOrder({
      visitorToken,
      userId: request.user?.id || null,
      customer: request.body || {},
    });
    return reply.code(201).send({ data });
  }));

  app.post("/api/v1/payments/paypal/orders/:paypalOrderId/capture", async (request) => translatePaymentError(async () => ({
    data: await paymentService.capturePaypalOrder({
      paypalOrderId: request.params.paypalOrderId,
      checkoutToken: request.body?.checkoutToken,
    }),
  })));

  app.get("/api/v1/orders/:orderNumber/confirmation", async (request) => translatePaymentError(async () => ({
    data: await paymentService.getConfirmation({
      orderNumber: request.params.orderNumber,
      checkoutToken: request.query?.token,
    }),
  })));

  app.post("/api/v1/webhooks/paypal", async (request) => translatePaymentError(async () => {
    if (!request.body?.id || !request.body?.event_type) throw badRequest("INVALID_PAYPAL_WEBHOOK", "PayPal Webhook 内容无效。");
    return { data: await paymentService.processWebhook({ headers: request.headers, event: request.body }) };
  }));
}
