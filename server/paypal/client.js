export class PaypalClientError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "PaypalClientError";
    this.code = code;
  }
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
    } finally {
      clearTimeout(timeout);
    }
  }

  async function accessToken() {
    if (cachedToken && Date.now() < tokenExpiresAt - 60000) return cachedToken;
    const basic = Buffer.from(`${config.paypalClientId}:${config.paypalClientSecret}`).toString("base64");
    const payload = await fetchJson(baseUrl + "/v1/oauth2/token", {
      method: "POST",
      headers: {
        authorization: "Basic " + basic,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    cachedToken = payload.access_token;
    tokenExpiresAt = Date.now() + Number(payload.expires_in || 0) * 1000;
    return cachedToken;
  }

  async function paypalRequest(path, { body, requestId } = {}) {
    const token = await accessToken();
    return fetchJson(baseUrl + path, {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
        ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
      },
      body: JSON.stringify(body || {}),
    });
  }

  const isConfigured = () => Boolean(config.paypalClientId && config.paypalClientSecret);
  return {
    isConfigured,
    publicConfig: () => ({
      enabled: isConfigured(),
      clientId: config.paypalClientId,
      currency: "USD",
      environment: config.paypalEnv,
    }),
    async createOrder({ orderNumber, amount, requestId }) {
      const payload = await paypalRequest("/v2/checkout/orders", {
        requestId,
        body: {
          intent: "CAPTURE",
          purchase_units: [{ invoice_id: orderNumber, amount: { currency_code: "USD", value: amount } }],
        },
      });
      return { paypalOrderId: payload.id, status: payload.status };
    },
    async captureOrder(paypalOrderId, requestId) {
      const payload = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, { requestId });
      const unit = payload.purchase_units?.[0] || {};
      const capture = unit.payments?.captures?.[0] || {};
      return {
        status: capture.status || payload.status,
        captureId: capture.id,
        invoiceId: unit.invoice_id,
        currencyCode: capture.amount?.currency_code,
        value: capture.amount?.value,
      };
    },
    async verifyWebhook({ headers, event }) {
      const payload = await paypalRequest("/v1/notifications/verify-webhook-signature", {
        body: {
          auth_algo: headers["paypal-auth-algo"],
          cert_url: headers["paypal-cert-url"],
          transmission_id: headers["paypal-transmission-id"],
          transmission_sig: headers["paypal-transmission-sig"],
          transmission_time: headers["paypal-transmission-time"],
          webhook_id: config.paypalWebhookId,
          webhook_event: event,
        },
      });
      return payload.verification_status === "SUCCESS";
    },
  };
}
