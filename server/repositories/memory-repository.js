import { createHash, randomUUID } from "node:crypto";

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

export class MemoryRepository {
  constructor({ products = [], mediaAssets = [] } = {}) {
    this.products = products.map((product) => ({ ...product }));
    this.mediaAssets = mediaAssets.map((asset) => ({ backupPaths: [], status: "active", ...asset, backupPaths: [...(asset.backupPaths || [])] }));
    this.carts = new Map();
    this.cartItems = new Map();
    this.chatSessions = new Map();
    this.chatMessages = new Map();
    this.constitutionResults = [];
    this.orders = new Map();
    this.orderItems = new Map();
    this.paypalWebhookEvents = new Map();
    this.adminUsers = new Map();
    this.adminSessions = new Map();
    this.modelConfig = null;
    this.customerUsers = new Map();
    this.customerSessions = new Map();
    this.modelUsage = [];
  }

  listProducts({ includeInactive = false, constitution, category } = {}) {
    return this.products
      .filter((product) => includeInactive || product.status === "active")
      .filter((product) => !constitution || product.constitutionType === constitution)
      .filter((product) => !category || product.category === category)
      .sort((first, second) => first.sortOrder - second.sortOrder)
      .map((product) => ({ ...product }));
  }

  listMediaAssets({ includeInactive = false, pageGroup } = {}) {
    return this.mediaAssets
      .filter((asset) => includeInactive || asset.status === "active")
      .filter((asset) => !pageGroup || asset.pageGroup === pageGroup)
      .sort((first, second) => first.slotKey.localeCompare(second.slotKey))
      .map((asset) => ({ ...asset, backupPaths: [...(asset.backupPaths || [])] }));
  }

  getMediaAssetBySlot(slotKey) {
    const asset = this.mediaAssets.find((item) => item.slotKey === slotKey);
    return asset ? { ...asset, backupPaths: [...(asset.backupPaths || [])] } : null;
  }

  updateMediaAsset(slotKey, patch) {
    const asset = this.mediaAssets.find((item) => item.slotKey === slotKey);
    if (!asset) return null;
    Object.assign(asset, patch);
    return this.getMediaAssetBySlot(slotKey);
  }

  restoreMediaAsset(slotKey) {
    const asset = this.mediaAssets.find((item) => item.slotKey === slotKey);
    if (!asset || !asset.backupPaths?.length) return this.getMediaAssetBySlot(slotKey);
    asset.filePath = asset.backupPaths.pop();
    asset.mimeType = null;
    asset.fileSize = null;
    return this.getMediaAssetBySlot(slotKey);
  }

  getProductBySlug(slug) {
    const product = this.products.find((item) => item.slug === slug);
    return product ? { ...product } : null;
  }

  getProductById(id) {
    const product = this.products.find((item) => item.id === id);
    return product ? { ...product } : null;
  }

  updateProduct(id, patch) {
    const product = this.products.find((item) => item.id === id);
    if (!product) return null;
    Object.assign(product, patch, { updatedAt: Date.now() });
    return { ...product };
  }

  getAdminSession(tokenHash) {
    const session = [...this.adminSessions.values()].find((item) => item.tokenHash === tokenHash && item.expiresAt > Date.now());
    if (!session) return null;
    return this.adminUsers.get(session.adminUserId) || null;
  }

  getAdminByUsername(username) {
    return [...this.adminUsers.values()].find((user) => user.username === username && user.status === "active") || null;
  }

  saveAdminUser(user) {
    this.adminUsers.set(user.id, { ...user });
    return { ...user };
  }

  saveAdminSession(session) {
    this.adminSessions.set(session.id, { ...session });
    return { ...session };
  }

  ensureModelConfigSchema() {}

  getModelConfig() {
    return this.modelConfig ? { ...this.modelConfig, apiKey: this.modelConfig.apiKey ? { ...this.modelConfig.apiKey } : null } : null;
  }

  saveModelConfig(config) {
    this.modelConfig = { id: 1, ...config, updatedAt: Date.now(), createdAt: this.modelConfig?.createdAt || Date.now() };
    return this.getModelConfig();
  }

  ensureCustomerUserSchema() {}

  createUser({ email, phone, name = "", passwordHash }) {
    if (email && [...this.customerUsers.values()].some((user) => user.email === email)) {
      const error = new Error("email already exists");
      error.code = "23505";
      throw error;
    }
    if (phone && [...this.customerUsers.values()].some((user) => user.phone === phone)) {
      const error = new Error("phone already exists");
      error.code = "23505";
      throw error;
    }
    const user = { id: randomUUID(), email: email || null, phone: phone || null, name, passwordHash, status: "active", lastLoginAt: null, createdAt: Date.now(), updatedAt: Date.now() };
    this.customerUsers.set(user.id, user);
    return { ...user };
  }

  getUserByIdentifier(identifier) {
    const user = [...this.customerUsers.values()].find((item) => item.email === identifier || item.phone === identifier);
    return user ? { ...user } : null;
  }

  updateUserLastLogin(id) {
    const user = this.customerUsers.get(id);
    if (!user) return null;
    user.lastLoginAt = Date.now();
    user.updatedAt = Date.now();
    return { ...user };
  }

  saveCustomerSession(session) {
    this.customerSessions.set(session.id, { ...session });
    return { ...session };
  }

  getCustomerSession(tokenHash) {
    const session = [...this.customerSessions.values()].find((item) => item.tokenHash === tokenHash && item.expiresAt > Date.now());
    if (!session) return null;
    const user = this.customerUsers.get(session.userId);
    return user && user.status === "active" ? { ...user } : null;
  }

  listUsers() {
    return [...this.customerUsers.values()].sort((first, second) => second.createdAt - first.createdAt).map((user) => ({ ...user }));
  }

  upsertCart(token, retentionDays = 30) {
    const tokenHash = hashToken(token);
    let cart = this.carts.get(tokenHash);
    if (!cart) {
      cart = { id: randomUUID(), tokenHash, expiresAt: Date.now() + retentionDays * 86400000, updatedAt: Date.now() };
      this.carts.set(tokenHash, cart);
      this.cartItems.set(cart.id, []);
    }
    cart.updatedAt = Date.now();
    return { ...cart };
  }

  getCart(token) {
    const cart = this.carts.get(hashToken(token));
    if (!cart || cart.expiresAt < Date.now()) return null;
    const items = (this.cartItems.get(cart.id) || []).map((item) => ({ ...item }));
    return { ...cart, items };
  }

  saveCartItem(token, productId, quantity, retentionDays = 30) {
    const cart = this.upsertCart(token, retentionDays);
    const items = this.cartItems.get(cart.id);
    const existing = items.find((item) => item.productId === productId);
    if (existing) existing.quantity = quantity;
    else items.push({ id: randomUUID(), cartId: cart.id, productId, quantity });
    return this.getCart(token);
  }

  removeCartItem(token, itemId) {
    const cart = this.getCart(token);
    if (!cart) return null;
    this.cartItems.set(cart.id, (this.cartItems.get(cart.id) || []).filter((item) => item.id !== itemId));
    return this.getCart(token);
  }

  clearCart(token) {
    const cart = this.getCart(token);
    if (cart) this.cartItems.set(cart.id, []);
  }

  createChatSession(visitorTokenHash, provider = "local", model = "fallback", retentionDays = 7) {
    const session = {
      id: randomUUID(),
      visitorTokenHash,
      provider,
      model,
      status: "active",
      expiresAt: Date.now() + retentionDays * 86400000,
      createdAt: Date.now(),
    };
    this.chatSessions.set(session.id, session);
    this.chatMessages.set(session.id, []);
    return { ...session };
  }

  addChatMessage(sessionId, role, content) {
    const message = { id: randomUUID(), sessionId, role, content, createdAt: Date.now() };
    const messages = this.chatMessages.get(sessionId);
    if (!messages) throw new Error("chat session not found");
    messages.push(message);
    return { ...message };
  }

  getChatMessages(sessionId) {
    return (this.chatMessages.get(sessionId) || []).map((message) => ({ ...message }));
  }

  saveConstitutionResult(result) {
    const saved = { id: randomUUID(), ...result, createdAt: Date.now() };
    this.constitutionResults.push(saved);
    return { ...saved };
  }

  createOrder({ orderNumber, customer, lines, subtotalCents, cartId, userId = null, status = "pending_contact", payment = {} }) {
    const products = lines.map((line) => {
      const product = this.products.find((item) => item.id === line.productId);
      if (!product || product.status !== "active" || product.stockQuantity < line.quantity) throw new Error("product out of stock");
      return { product, quantity: line.quantity };
    });
    for (const reserved of products) reserved.product.stockQuantity -= reserved.quantity;
    const timestamp = Date.now();
    const order = {
      id: randomUUID(),
      orderNumber,
      cartId,
      userId,
      status,
      customerName: customer.name,
      phone: customer.phone,
      email: customer.email || null,
      address: customer.address,
      city: customer.city || "",
      postalCode: customer.postalCode || "",
      countryCode: customer.countryCode || "US",
      notes: customer.notes || null,
      subtotalCents,
      paymentMethod: payment.method || "manual",
      paymentStatus: payment.status || "unpaid",
      currencyCode: payment.currencyCode || "USD",
      paypalOrderId: null,
      paypalCaptureId: null,
      paidAt: null,
      refundedAt: null,
      stockReleasedAt: null,
      confirmationTokenHash: payment.confirmationTokenHash || null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.orders.set(order.id, order);
    this.orderItems.set(order.id, lines.map((line) => ({ id: randomUUID(), orderId: order.id, ...line })));
    return this.getOrder(order.id);
  }

  getOrder(id) {
    const order = this.orders.get(id);
    if (!order) return null;
    return { ...order, items: (this.orderItems.get(id) || []).map((item) => ({ ...item })) };
  }

  listOrders() {
    return [...this.orders.values()]
      .sort((first, second) => second.createdAt - first.createdAt)
      .map((order) => this.getOrder(order.id));
  }

  getOrderByNumber(orderNumber) {
    const order = [...this.orders.values()].find((item) => item.orderNumber === orderNumber);
    return order ? this.getOrder(order.id) : null;
  }

  getOrderByPaypalOrderId(paypalOrderId) {
    const order = [...this.orders.values()].find((item) => item.paypalOrderId === paypalOrderId);
    return order ? this.getOrder(order.id) : null;
  }

  getOrderByPaypalCaptureId(paypalCaptureId) {
    const order = [...this.orders.values()].find((item) => item.paypalCaptureId === paypalCaptureId);
    return order ? this.getOrder(order.id) : null;
  }

  attachPaypalOrder(id, paypalOrderId) {
    const order = this.orders.get(id);
    if (!order) return null;
    if (order.paypalOrderId && order.paypalOrderId !== paypalOrderId) throw new Error("PayPal order already attached");
    order.paypalOrderId = paypalOrderId;
    order.updatedAt = Date.now();
    return this.getOrder(id);
  }

  markOrderPaid(id, { paypalCaptureId, paidAt }) {
    const order = this.orders.get(id);
    if (!order) return null;
    if (order.paymentStatus === "paid") {
      if (order.paypalCaptureId !== paypalCaptureId) throw new Error("PayPal capture conflict");
      return this.getOrder(id);
    }
    order.paypalCaptureId = paypalCaptureId;
    order.paymentStatus = "paid";
    order.status = "pending_contact";
    order.paidAt = paidAt;
    order.updatedAt = paidAt;
    return this.getOrder(id);
  }

  markOrderRefunded(id, refundedAt) {
    const order = this.orders.get(id);
    if (!order) return null;
    order.paymentStatus = "refunded";
    order.refundedAt ||= refundedAt;
    order.updatedAt = refundedAt;
    return this.getOrder(id);
  }

  markOrderPaymentFailed(id, timestamp) {
    const order = this.orders.get(id);
    if (!order || order.paymentStatus === "paid" || order.paymentStatus === "refunded") return order ? this.getOrder(id) : null;
    order.paymentStatus = "failed";
    order.updatedAt = timestamp;
    return this.getOrder(id);
  }

  clearCartById(cartId) {
    if (cartId) this.cartItems.set(cartId, []);
  }

  recordPaypalWebhookEvent(event) {
    if (this.paypalWebhookEvents.has(event.eventId)) return false;
    this.paypalWebhookEvents.set(event.eventId, { ...event, processingStatus: "processing", processedAt: null, errorCode: null });
    return true;
  }

  completePaypalWebhookEvent(eventId, processingStatus, errorCode = null) {
    const event = this.paypalWebhookEvents.get(eventId);
    if (!event) return null;
    Object.assign(event, { processingStatus, errorCode, processedAt: Date.now() });
    return { ...event };
  }

  cancelPendingOrder(id, timestamp) {
    const order = this.orders.get(id);
    if (!order || order.paymentStatus === "paid" || order.paymentStatus === "refunded") return order ? this.getOrder(id) : null;
    if (!order.stockReleasedAt) {
      for (const line of this.orderItems.get(id) || []) {
        const product = this.products.find((item) => item.id === line.productId);
        if (product) product.stockQuantity += line.quantity;
      }
      order.stockReleasedAt = timestamp;
    }
    order.status = "cancelled";
    order.paymentStatus = "failed";
    order.updatedAt = timestamp;
    return this.getOrder(id);
  }

  listExpiredPendingPaymentOrders(cutoff) {
    return [...this.orders.values()]
      .filter((order) => order.status === "pending_payment" && ["pending", "failed"].includes(order.paymentStatus) && order.createdAt < cutoff)
      .map((order) => this.getOrder(order.id));
  }

  updateOrderStatus(id, status) {
    const order = this.orders.get(id);
    if (!order) return null;
    order.status = status;
    order.updatedAt = Date.now();
    return this.getOrder(id);
  }

  recordModelUsage(event) {
    this.modelUsage.push({ id: randomUUID(), ...event, createdAt: Date.now() });
  }

  cleanupExpiredData() {
    let sessions = 0;
    for (const [id, session] of this.chatSessions) {
      if (session.expiresAt <= Date.now()) {
        this.chatSessions.delete(id);
        this.chatMessages.delete(id);
        sessions += 1;
      }
    }
    let carts = 0;
    for (const [hash, cart] of this.carts) {
      if (cart.expiresAt <= Date.now()) {
        this.carts.delete(hash);
        this.cartItems.delete(cart.id);
        carts += 1;
      }
    }
    return { sessions, carts };
  }
}
