import { randomBytes } from "node:crypto";
import { calculateOrderLines } from "../domain/orders.js";
import { validateCheckoutCustomer } from "../domain/payments.js";
import { badRequest, notFound } from "../http-errors.js";
import { createToken, hashToken } from "../auth.js";
import { publicMediaUrl } from "../media-storage.js";
import { createUserSession, normalizeIdentifier, publicUser, validateRegistration } from "../user-auth.js";

const publicProduct = (product) => ({
  ...product,
  price: "$" + (product.priceCents / 100).toFixed(2),
  compareAtPrice: "$" + (product.compareAtPriceCents / 100).toFixed(2),
});

const publicMedia = (asset) => ({
  slotKey: asset.slotKey,
  pageGroup: asset.pageGroup,
  label: asset.label,
  url: publicMediaUrl(asset.filePath) || asset.defaultPath || null,
  altText: asset.altText || asset.label,
});

function cartPayload(cart, repository) {
  if (!cart) return { items: [], subtotalCents: 0, subtotal: "$0.00" };
  const items = cart.items.map((item) => {
    const product = repository.getProductById(item.productId);
    if (!product) return null;
    return {
      id: item.id,
      quantity: item.quantity,
      product: publicProduct(product),
      lineTotalCents: product.priceCents * item.quantity,
      lineTotal: "$" + ((product.priceCents * item.quantity) / 100).toFixed(2),
    };
  }).filter(Boolean);
  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  return { items, subtotalCents, subtotal: "$" + (subtotalCents / 100).toFixed(2) };
}

function setCustomerSession(reply, token, config) {
  reply.setCookie("sinoherb_user_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.nodeEnv === "production",
    path: "/",
    maxAge: config.customerSessionRetentionDays * 86400,
  });
}

export function registerPublicRoutes(app, { repository, chatService, auth, config, verifyPassword, hashPassword }) {
  app.post("/api/v1/auth/register", async (request, reply) => {
    let registration;
    try {
      registration = validateRegistration(request.body || {});
    } catch (error) {
      throw badRequest("INVALID_REGISTRATION", error.message);
    }
    try {
      const user = await repository.createUser({
        ...registration,
        passwordHash: await hashPassword(request.body.password),
      });
      const token = createToken();
      const session = createUserSession(user.id, token, config.customerSessionRetentionDays);
      await repository.saveCustomerSession({ id: session.id, userId: session.userId, tokenHash: hashToken(token), expiresAt: session.expiresAt, createdAt: session.createdAt });
      setCustomerSession(reply, token, config);
      return reply.code(201).send({ data: { user: publicUser(user) } });
    } catch (error) {
      if (error.code === "23505") return reply.code(409).send({ error: { code: "USER_EXISTS", message: "邮箱或手机号已注册。" } });
      throw error;
    }
  });

  app.post("/api/v1/auth/login", async (request, reply) => {
    let identifier;
    try {
      identifier = normalizeIdentifier(request.body?.identifier || request.body?.email || request.body?.phone);
    } catch (error) {
      throw badRequest("INVALID_LOGIN", error.message);
    }
    const password = request.body?.password;
    if (typeof password !== "string" || !password) throw badRequest("INVALID_LOGIN", "请输入密码。");
    const user = await repository.getUserByIdentifier(identifier);
    const valid = user && user.status === "active" && await verifyPassword(password, user.passwordHash);
    if (!valid) return reply.code(401).send({ error: { code: "INVALID_LOGIN", message: "邮箱/手机号或密码错误。" } });
    const updatedUser = await repository.updateUserLastLogin(user.id) || user;
    const token = createToken();
    const session = createUserSession(updatedUser.id, token, config.customerSessionRetentionDays);
    await repository.saveCustomerSession({ id: session.id, userId: session.userId, tokenHash: hashToken(token), expiresAt: session.expiresAt, createdAt: session.createdAt });
    setCustomerSession(reply, token, config);
    return { data: { user: publicUser(updatedUser) } };
  });

  app.get("/api/v1/auth/session", async (request) => ({ data: { user: publicUser(request.user) } }));

  app.post("/api/v1/auth/logout", async (request, reply) => {
    reply.clearCookie("sinoherb_user_session", { path: "/" });
    return { data: { ok: true } };
  });

  app.get("/api/v1/media", async (request) => ({
    data: (await repository.listMediaAssets({ pageGroup: request.query?.pageGroup })).map(publicMedia),
  }));

  app.get("/api/v1/products", async (request) => ({
    data: (await repository.listProducts(request.query || {})).map(publicProduct),
  }));

  app.get("/api/v1/products/:slug", async (request, reply) => {
    const product = await repository.getProductBySlug(request.params.slug);
    if (!product || product.status !== "active") return reply.code(404).send({ error: { code: "PRODUCT_NOT_FOUND", message: "产品不存在。" } });
    return { data: publicProduct(product) };
  });

  app.get("/api/v1/cart", async (request, reply) => {
    const token = auth.ensureVisitorToken(reply, request);
    return { data: cartPayload(await repository.getCart(token), repository) };
  });

  app.post("/api/v1/cart/items", async (request, reply) => {
    const { productId, quantity } = request.body || {};
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw badRequest("INVALID_CART_ITEM", "购物车数量无效。");
    const product = await repository.getProductById(productId);
    if (!product || product.status !== "active") throw notFound("产品不存在或已下架。");
    if (product.stockQuantity < quantity) throw badRequest("OUT_OF_STOCK", "该产品库存不足。");
    const token = auth.ensureVisitorToken(reply, request);
    return { data: cartPayload(await repository.saveCartItem(token, productId, quantity, config.cartRetentionDays), repository) };
  });

  app.patch("/api/v1/cart/items/:itemId", async (request, reply) => {
    const quantity = request.body?.quantity;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw badRequest("INVALID_CART_ITEM", "购物车数量无效。");
    const token = auth.ensureVisitorToken(reply, request);
    const cart = await repository.getCart(token);
    const item = cart?.items.find((entry) => entry.id === request.params.itemId);
    const product = item ? await repository.getProductById(item.productId) : null;
    if (!item || !product) throw notFound("购物车商品不存在。");
    if (product.stockQuantity < quantity) throw badRequest("OUT_OF_STOCK", "该产品库存不足。");
    return { data: cartPayload(await repository.saveCartItem(token, item.productId, quantity, config.cartRetentionDays), repository) };
  });

  app.delete("/api/v1/cart/items/:itemId", async (request, reply) => {
    const token = auth.ensureVisitorToken(reply, request);
    return { data: cartPayload(await repository.removeCartItem(token, request.params.itemId), repository) };
  });

  app.post("/api/v1/chat/sessions", async (request, reply) => {
    const token = auth.ensureVisitorToken(reply, request);
    const session = await chatService.createSession(hashToken(token));
    return { data: { id: session.id, status: session.status } };
  });

  app.post("/api/v1/chat/sessions/:sessionId/messages", async (request, reply) => {
    const content = request.body?.content;
    if (typeof content !== "string" || content.length < 1 || content.length > 2000) throw badRequest("INVALID_MESSAGE", "消息长度无效。");
    const result = await chatService.completeMessage(request.params.sessionId, content);
    reply.raw.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    reply.raw.write("event: message\\ndata: " + JSON.stringify({ text: result.text, degraded: result.degraded }) + "\\n\\n");
    reply.raw.write("event: result\\ndata: " + JSON.stringify(result.result) + "\\n\\n");
    reply.raw.end();
    return reply;
  });

  app.post("/api/v1/orders", async (request, reply) => {
    let customer;
    try {
      customer = validateCheckoutCustomer(request.body || {});
    } catch (error) {
      throw badRequest("INVALID_CUSTOMER", error.message);
    }
    const token = auth.ensureVisitorToken(reply, request);
    const cart = await repository.getCart(token);
    if (!cart?.items.length) throw badRequest("EMPTY_CART", "购物车为空。");
    const products = await Promise.all(cart.items.map((item) => repository.getProductById(item.productId)));
    const lines = calculateOrderLines(cart.items, products.filter(Boolean));
    const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
    const orderNumber = "SH-" + Date.now().toString(36).toUpperCase() + "-" + randomBytes(3).toString("hex").toUpperCase();
    const order = await repository.createOrder({
      orderNumber,
      cartId: cart.id,
      userId: request.user?.id || null,
      status: "pending_contact",
      payment: { method: "manual", status: "unpaid", currencyCode: "USD" },
      customer: { ...customer, name: `${customer.firstName} ${customer.lastName}` },
      lines,
      subtotalCents,
    });
    await repository.clearCart(token);
    return reply.code(201).send({ data: { orderNumber: order.orderNumber, status: order.status, subtotalCents, subtotal: "$" + (subtotalCents / 100).toFixed(2) } });
  });
}
