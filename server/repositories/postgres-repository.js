import { createHash } from "node:crypto";

const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
const orderColumns = `id, order_number AS "orderNumber", cart_id AS "cartId", user_id AS "userId", status,
  customer_name AS "customerName", phone, email, address, city, postal_code AS "postalCode", country_code AS "countryCode", notes,
  subtotal_cents AS "subtotalCents", payment_method AS "paymentMethod", payment_status AS "paymentStatus", currency_code AS "currencyCode",
  paypal_order_id AS "paypalOrderId", paypal_capture_id AS "paypalCaptureId", paid_at AS "paidAt", refunded_at AS "refundedAt",
  stock_released_at AS "stockReleasedAt", confirmation_token_hash AS "confirmationTokenHash", created_at AS "createdAt", updated_at AS "updatedAt"`;

async function loadOrder(queryable, id) {
  const orderResult = await queryable.query(`SELECT ${orderColumns} FROM orders WHERE id = $1 LIMIT 1`, [id]);
  const order = orderResult.rows[0];
  if (!order) return null;
  const items = await queryable.query("SELECT id, product_id AS \"productId\", product_slug AS \"productSlug\", product_name AS \"productName\", unit_price_cents AS \"unitPriceCents\", quantity, line_total_cents AS \"lineTotalCents\" FROM order_items WHERE order_id = $1", [id]);
  return { ...order, items: items.rows };
}

export class PostgresRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async listProducts({ includeInactive = false, constitution, category } = {}) {
    const values = [];
    const where = [];
    if (!includeInactive) where.push("status = 'active'");
    if (constitution) {
      values.push(constitution);
      where.push("constitution_type = $" + values.length);
    }
    if (category) {
      values.push(category);
      where.push("category = $" + values.length);
    }
    const result = await this.pool.query(
      "SELECT id, slug, name, subtitle, description, category, constitution_type AS \"constitutionType\", price_cents AS \"priceCents\", compare_at_price_cents AS \"compareAtPriceCents\", stock_quantity AS \"stockQuantity\", status, sort_order AS \"sortOrder\", badge, visual_variant AS \"visualVariant\" FROM products " +
        (where.length ? "WHERE " + where.join(" AND ") : "") +
        " ORDER BY sort_order ASC, name ASC",
      values,
    );
    return result.rows;
  }

  async listMediaAssets({ includeInactive = false, pageGroup } = {}) {
    const values = [];
    const where = [];
    if (!includeInactive) where.push("status = 'active'");
    if (pageGroup) {
      values.push(pageGroup);
      where.push("page_group = $" + values.length);
    }
    const result = await this.pool.query(
      "SELECT id, slot_key AS \"slotKey\", page_group AS \"pageGroup\", label, default_path AS \"defaultPath\", file_path AS \"filePath\", alt_text AS \"altText\", mime_type AS \"mimeType\", file_size AS \"fileSize\", backup_paths AS \"backupPaths\", status, created_at AS \"createdAt\", updated_at AS \"updatedAt\" FROM media_assets " +
        (where.length ? "WHERE " + where.join(" AND ") : "") +
        " ORDER BY page_group ASC, slot_key ASC",
      values,
    );
    return result.rows;
  }

  async getMediaAssetBySlot(slotKey) {
    const assets = await this.listMediaAssets({ includeInactive: true });
    return assets.find((asset) => asset.slotKey === slotKey) || null;
  }

  async updateMediaAsset(slotKey, patch) {
    const allowed = { filePath: "file_path", altText: "alt_text", mimeType: "mime_type", fileSize: "file_size", backupPaths: "backup_paths", status: "status" };
    const entries = Object.entries(patch).filter(([key, value]) => allowed[key] && value !== undefined);
    if (!entries.length) return this.getMediaAssetBySlot(slotKey);
    const values = entries.map(([key, value]) => key === "backupPaths" ? JSON.stringify(value) : value);
    const assignments = entries.map(([key], index) => allowed[key] + " = $" + (index + 1));
    values.push(slotKey);
    const result = await this.pool.query(
      "UPDATE media_assets SET " + assignments.join(", ") + ", updated_at = NOW() WHERE slot_key = $" + values.length + " RETURNING id, slot_key AS \"slotKey\", page_group AS \"pageGroup\", label, default_path AS \"defaultPath\", file_path AS \"filePath\", alt_text AS \"altText\", mime_type AS \"mimeType\", file_size AS \"fileSize\", backup_paths AS \"backupPaths\", status, created_at AS \"createdAt\", updated_at AS \"updatedAt\"",
      values,
    );
    return result.rows[0] || null;
  }

  async restoreMediaAsset(slotKey) {
    const asset = await this.getMediaAssetBySlot(slotKey);
    const backupPaths = Array.isArray(asset?.backupPaths) ? asset.backupPaths : [];
    if (!asset || !backupPaths.length) return asset;
    return this.updateMediaAsset(slotKey, {
      filePath: backupPaths[backupPaths.length - 1],
      backupPaths: backupPaths.slice(0, -1),
      mimeType: null,
      fileSize: null,
    });
  }

  async getProductBySlug(slug) {
    const result = await this.pool.query(
      "SELECT id, slug, name, subtitle, description, category, constitution_type AS \"constitutionType\", price_cents AS \"priceCents\", compare_at_price_cents AS \"compareAtPriceCents\", stock_quantity AS \"stockQuantity\", status, sort_order AS \"sortOrder\", badge, visual_variant AS \"visualVariant\" FROM products WHERE slug = $1 LIMIT 1",
      [slug],
    );
    return result.rows[0] || null;
  }

  async getProductById(id) {
    const result = await this.pool.query(
      "SELECT id, slug, name, subtitle, description, category, constitution_type AS \"constitutionType\", price_cents AS \"priceCents\", compare_at_price_cents AS \"compareAtPriceCents\", stock_quantity AS \"stockQuantity\", status, sort_order AS \"sortOrder\", badge, visual_variant AS \"visualVariant\" FROM products WHERE id = $1 LIMIT 1",
      [id],
    );
    return result.rows[0] || null;
  }

  async upsertCart(token, retentionDays = 30) {
    const result = await this.pool.query(
      "INSERT INTO carts (cart_token_hash, expires_at) VALUES ($1, NOW() + ($2 * INTERVAL '1 day')) ON CONFLICT (cart_token_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at, updated_at = NOW() RETURNING id, cart_token_hash AS \"tokenHash\", expires_at AS \"expiresAt\"",
      [tokenHash(token), retentionDays],
    );
    return result.rows[0];
  }

  async getCart(token) {
    const cartResult = await this.pool.query("SELECT id, expires_at AS \"expiresAt\" FROM carts WHERE cart_token_hash = $1 AND expires_at > NOW() LIMIT 1", [tokenHash(token)]);
    const cart = cartResult.rows[0];
    if (!cart) return null;
    const items = await this.pool.query("SELECT id, product_id AS \"productId\", quantity FROM cart_items WHERE cart_id = $1 ORDER BY created_at ASC", [cart.id]);
    return { ...cart, items: items.rows };
  }

  async saveCartItem(token, productId, quantity, retentionDays = 30) {
    const cart = await this.upsertCart(token, retentionDays);
    await this.pool.query(
      "INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1,$2,$3) ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()",
      [cart.id, productId, quantity],
    );
    return this.getCart(token);
  }

  async removeCartItem(token, itemId) {
    const cart = await this.getCart(token);
    if (!cart) return null;
    await this.pool.query("DELETE FROM cart_items WHERE id = $1 AND cart_id = $2", [itemId, cart.id]);
    return this.getCart(token);
  }

  async clearCart(token) {
    const cart = await this.getCart(token);
    if (cart) await this.pool.query("DELETE FROM cart_items WHERE cart_id = $1", [cart.id]);
  }

  async createChatSession(visitorTokenHash, provider = "local", model = "fallback", retentionDays = 7) {
    const result = await this.pool.query(
      "INSERT INTO constitution_chat_sessions (visitor_token_hash, provider, model, expires_at) VALUES ($1,$2,$3,NOW() + ($4 * INTERVAL '1 day')) RETURNING id, status, provider, model, expires_at AS \"expiresAt\"",
      [visitorTokenHash, provider, model, retentionDays],
    );
    return result.rows[0];
  }

  async addChatMessage(sessionId, role, content) {
    const result = await this.pool.query("INSERT INTO constitution_chat_messages (session_id, role, content) VALUES ($1,$2,$3) RETURNING id, session_id AS \"sessionId\", role, content, created_at AS \"createdAt\"", [sessionId, role, content]);
    return result.rows[0];
  }

  async getChatMessages(sessionId) {
    const result = await this.pool.query("SELECT id, session_id AS \"sessionId\", role, content, created_at AS \"createdAt\" FROM constitution_chat_messages WHERE session_id = $1 ORDER BY created_at ASC", [sessionId]);
    return result.rows;
  }

  async saveConstitutionResult(result) {
    const saved = await this.pool.query(
      "INSERT INTO constitution_results (visitor_token_hash, chat_session_id, primary_type, secondary_type, confidence_level, evidence_json, guidance_json, product_categories_json, safety_notice) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, primary_type AS \"primaryType\", secondary_type AS \"secondaryType\", confidence_level AS \"confidenceLevel\", evidence_json AS evidence, guidance_json AS guidance, product_categories_json AS \"productCategories\", safety_notice AS \"safetyNotice\", created_at AS \"createdAt\"",
      [result.visitorTokenHash, result.chatSessionId || null, result.primaryType, result.secondaryType, result.confidenceLevel, JSON.stringify(result.evidence), JSON.stringify(result.guidance), JSON.stringify(result.productCategories), result.safetyNotice],
    );
    return saved.rows[0];
  }

  async recordModelUsage(event) {
    await this.pool.query(
      "INSERT INTO model_usage_events (chat_session_id, provider, model, latency_ms, input_tokens, output_tokens, status, error_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [event.chatSessionId || null, event.provider, event.model || "unknown", event.latencyMs || null, event.inputTokens || null, event.outputTokens || null, event.status, event.errorCode || null],
    );
  }

  async getAdminSession(sessionTokenHash) {
    const result = await this.pool.query(
      "SELECT u.id, u.username, u.status FROM admin_sessions s JOIN admin_users u ON u.id = s.admin_user_id WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.status = 'active' LIMIT 1",
      [sessionTokenHash],
    );
    return result.rows[0] || null;
  }

  async getAdminByUsername(username) {
    const result = await this.pool.query("SELECT id, username, password_hash AS \"passwordHash\", status FROM admin_users WHERE username = $1 LIMIT 1", [username]);
    return result.rows[0] || null;
  }

  async saveAdminSession(session) {
    await this.pool.query("INSERT INTO admin_sessions (id, admin_user_id, token_hash, expires_at) VALUES ($1,$2,$3,TO_TIMESTAMP($4 / 1000.0))", [session.id, session.adminUserId, session.tokenHash, session.expiresAt]);
    return session;
  }

  async ensureModelConfigSchema() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS model_configs (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      provider TEXT NOT NULL DEFAULT 'bailian',
      base_url TEXT NOT NULL,
      model TEXT NOT NULL,
      api_key_ciphertext TEXT,
      api_key_iv TEXT,
      api_key_auth_tag TEXT,
      updated_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  }

  async getModelConfig() {
    const result = await this.pool.query("SELECT id, provider, base_url AS \"baseUrl\", model, CASE WHEN api_key_ciphertext IS NULL THEN NULL ELSE jsonb_build_object('ciphertext', api_key_ciphertext, 'iv', api_key_iv, 'authTag', api_key_auth_tag) END AS \"apiKey\", updated_by AS \"updatedBy\", created_at AS \"createdAt\", updated_at AS \"updatedAt\" FROM model_configs WHERE id = 1 LIMIT 1");
    return result.rows[0] || null;
  }

  async saveModelConfig(config) {
    const result = await this.pool.query(
      "INSERT INTO model_configs (id, provider, base_url, model, api_key_ciphertext, api_key_iv, api_key_auth_tag, updated_by) VALUES (1,$1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET provider = EXCLUDED.provider, base_url = EXCLUDED.base_url, model = EXCLUDED.model, api_key_ciphertext = EXCLUDED.api_key_ciphertext, api_key_iv = EXCLUDED.api_key_iv, api_key_auth_tag = EXCLUDED.api_key_auth_tag, updated_by = EXCLUDED.updated_by, updated_at = NOW() RETURNING id, provider, base_url AS \"baseUrl\", model, CASE WHEN api_key_ciphertext IS NULL THEN NULL ELSE jsonb_build_object('ciphertext', api_key_ciphertext, 'iv', api_key_iv, 'authTag', api_key_auth_tag) END AS \"apiKey\", updated_by AS \"updatedBy\", created_at AS \"createdAt\", updated_at AS \"updatedAt\"",
      [config.provider, config.baseUrl, config.model, config.apiKey?.ciphertext || null, config.apiKey?.iv || null, config.apiKey?.authTag || null, config.updatedBy || null],
    );
    return result.rows[0];
  }

  async ensureCustomerUserSchema() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS customer_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT,
      phone TEXT,
      name TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (email IS NOT NULL OR phone IS NOT NULL)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS customer_users_email_unique_idx ON customer_users (email) WHERE email IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS customer_users_phone_unique_idx ON customer_users (phone) WHERE phone IS NOT NULL;
    CREATE INDEX IF NOT EXISTS customer_users_created_idx ON customer_users (created_at DESC);
    CREATE TABLE IF NOT EXISTS customer_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_user_id UUID NOT NULL REFERENCES customer_users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES customer_users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS orders_user_created_idx ON orders (user_id, created_at DESC);`);
  }

  async createUser({ email, phone, name = "", passwordHash }) {
    const result = await this.pool.query(
      "INSERT INTO customer_users (email, phone, name, password_hash) VALUES ($1,$2,$3,$4) RETURNING id, email, phone, name, password_hash AS \"passwordHash\", status, last_login_at AS \"lastLoginAt\", created_at AS \"createdAt\", updated_at AS \"updatedAt\"",
      [email || null, phone || null, name, passwordHash],
    );
    return result.rows[0];
  }

  async getUserByIdentifier(identifier) {
    const result = await this.pool.query("SELECT id, email, phone, name, password_hash AS \"passwordHash\", status, last_login_at AS \"lastLoginAt\", created_at AS \"createdAt\", updated_at AS \"updatedAt\" FROM customer_users WHERE status = 'active' AND (email = $1 OR phone = $1) LIMIT 1", [identifier]);
    return result.rows[0] || null;
  }

  async updateUserLastLogin(id) {
    const result = await this.pool.query("UPDATE customer_users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING id, email, phone, name, password_hash AS \"passwordHash\", status, last_login_at AS \"lastLoginAt\", created_at AS \"createdAt\", updated_at AS \"updatedAt\"", [id]);
    return result.rows[0] || null;
  }

  async saveCustomerSession(session) {
    await this.pool.query("INSERT INTO customer_sessions (id, customer_user_id, token_hash, expires_at) VALUES ($1,$2,$3,TO_TIMESTAMP($4 / 1000.0))", [session.id, session.userId, session.tokenHash, session.expiresAt]);
    return session;
  }

  async getCustomerSession(tokenHash) {
    const result = await this.pool.query("SELECT u.id, u.email, u.phone, u.name, u.status, u.last_login_at AS \"lastLoginAt\", u.created_at AS \"createdAt\", u.updated_at AS \"updatedAt\" FROM customer_sessions s JOIN customer_users u ON u.id = s.customer_user_id WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.status = 'active' LIMIT 1", [tokenHash]);
    return result.rows[0] || null;
  }

  async listUsers() {
    const result = await this.pool.query("SELECT id, email, phone, name, status, last_login_at AS \"lastLoginAt\", created_at AS \"createdAt\", updated_at AS \"updatedAt\" FROM customer_users ORDER BY created_at DESC LIMIT 500");
    return result.rows;
  }

  async updateProduct(id, patch) {
    const allowed = { name: "name", subtitle: "subtitle", description: "description", category: "category", constitutionType: "constitution_type", priceCents: "price_cents", compareAtPriceCents: "compare_at_price_cents", stockQuantity: "stock_quantity", status: "status", sortOrder: "sort_order", badge: "badge", visualVariant: "visual_variant" };
    const entries = Object.entries(patch).filter(([key]) => allowed[key]);
    if (!entries.length) return this.getProductById(id);
    const values = entries.map(([, value]) => value);
    const assignments = entries.map(([key], index) => allowed[key] + " = $" + (index + 1));
    values.push(id);
    const result = await this.pool.query("UPDATE products SET " + assignments.join(", ") + ", updated_at = NOW() WHERE id = $" + values.length + " RETURNING id, slug, name, subtitle, description, category, constitution_type AS \"constitutionType\", price_cents AS \"priceCents\", compare_at_price_cents AS \"compareAtPriceCents\", stock_quantity AS \"stockQuantity\", status, sort_order AS \"sortOrder\", badge, visual_variant AS \"visualVariant\"", values);
    return result.rows[0] || null;
  }

  async listOrders() {
    const result = await this.pool.query(`SELECT ${orderColumns} FROM orders ORDER BY created_at DESC LIMIT 200`);
    return result.rows;
  }

  async getOrder(id) {
    return loadOrder(this.pool, id);
  }

  async getOrderByNumber(orderNumber) {
    const result = await this.pool.query("SELECT id FROM orders WHERE order_number = $1 LIMIT 1", [orderNumber]);
    return result.rows[0] ? this.getOrder(result.rows[0].id) : null;
  }

  async getOrderByPaypalOrderId(paypalOrderId) {
    const result = await this.pool.query("SELECT id FROM orders WHERE paypal_order_id = $1 LIMIT 1", [paypalOrderId]);
    return result.rows[0] ? this.getOrder(result.rows[0].id) : null;
  }

  async getOrderByPaypalCaptureId(paypalCaptureId) {
    const result = await this.pool.query("SELECT id FROM orders WHERE paypal_capture_id = $1 LIMIT 1", [paypalCaptureId]);
    return result.rows[0] ? this.getOrder(result.rows[0].id) : null;
  }

  async attachPaypalOrder(id, paypalOrderId) {
    const result = await this.pool.query(
      `UPDATE orders SET paypal_order_id = $2, updated_at = NOW()
       WHERE id = $1 AND (paypal_order_id IS NULL OR paypal_order_id = $2)
       RETURNING ${orderColumns}`,
      [id, paypalOrderId],
    );
    if (result.rows[0]) return result.rows[0];
    const order = await this.getOrder(id);
    if (!order) return null;
    throw new Error("PayPal order already attached");
  }

  async markOrderPaid(id, { paypalCaptureId, paidAt }) {
    const result = await this.pool.query(
      `UPDATE orders
       SET paypal_capture_id = $2, payment_status = 'paid', status = 'pending_contact', paid_at = $3, updated_at = $3
       WHERE id = $1 AND payment_status = 'pending'
       RETURNING ${orderColumns}`,
      [id, paypalCaptureId, paidAt],
    );
    if (result.rows[0]) return result.rows[0];
    const order = await this.getOrder(id);
    if (!order) return null;
    if (order.paymentStatus === "paid" && order.paypalCaptureId === paypalCaptureId) return order;
    throw new Error("PayPal capture conflict");
  }

  async markOrderRefunded(id, refundedAt) {
    const result = await this.pool.query(
      `UPDATE orders SET payment_status = 'refunded', refunded_at = COALESCE(refunded_at, $2), updated_at = $2
       WHERE id = $1 AND payment_status IN ('paid', 'refunded') RETURNING ${orderColumns}`,
      [id, refundedAt],
    );
    return result.rows[0] || null;
  }

  async markOrderPaymentFailed(id, timestamp) {
    const result = await this.pool.query(
      `UPDATE orders SET payment_status = 'failed', updated_at = $2
       WHERE id = $1 AND payment_status NOT IN ('paid', 'refunded') RETURNING ${orderColumns}`,
      [id, timestamp],
    );
    return result.rows[0] || this.getOrder(id);
  }

  async clearCartById(cartId) {
    if (cartId) await this.pool.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId]);
  }

  async recordPaypalWebhookEvent({ eventId, eventType, resourceId = null }) {
    const result = await this.pool.query(
      "INSERT INTO paypal_webhook_events (event_id, event_type, resource_id, processing_status) VALUES ($1, $2, $3, 'processing') ON CONFLICT (event_id) DO NOTHING RETURNING event_id",
      [eventId, eventType, resourceId],
    );
    return result.rowCount === 1;
  }

  async completePaypalWebhookEvent(eventId, processingStatus, errorCode = null) {
    const result = await this.pool.query(
      "UPDATE paypal_webhook_events SET processing_status = $2, error_code = $3, processed_at = NOW() WHERE event_id = $1 RETURNING event_id AS \"eventId\", event_type AS \"eventType\", resource_id AS \"resourceId\", processing_status AS \"processingStatus\", error_code AS \"errorCode\", processed_at AS \"processedAt\"",
      [eventId, processingStatus, errorCode],
    );
    return result.rows[0] || null;
  }

  async cancelPendingOrder(id, timestamp) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const lockedResult = await client.query("SELECT payment_status AS \"paymentStatus\", stock_released_at AS \"stockReleasedAt\" FROM orders WHERE id = $1 FOR UPDATE", [id]);
      const lockedOrder = lockedResult.rows[0];
      if (!lockedOrder || lockedOrder.paymentStatus === "paid" || lockedOrder.paymentStatus === "refunded" || lockedOrder.stockReleasedAt) {
        await client.query("COMMIT");
        return lockedOrder ? loadOrder(client, id) : null;
      }
      await client.query(
        "UPDATE products p SET stock_quantity = p.stock_quantity + oi.quantity, updated_at = NOW() FROM order_items oi WHERE oi.order_id = $1 AND oi.product_id = p.id",
        [id],
      );
      await client.query(
        "UPDATE orders SET status = 'cancelled', payment_status = 'failed', stock_released_at = $2, updated_at = $2 WHERE id = $1 AND stock_released_at IS NULL",
        [id, timestamp],
      );
      await client.query("COMMIT");
      return loadOrder(client, id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listExpiredPendingPaymentOrders(cutoff) {
    const result = await this.pool.query(
      `SELECT ${orderColumns} FROM orders WHERE status = 'pending_payment' AND payment_status IN ('pending', 'failed') AND created_at < $1 ORDER BY created_at ASC`,
      [cutoff],
    );
    return result.rows;
  }

  async updateOrderStatus(id, status) {
    const result = await this.pool.query("UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, order_number AS \"orderNumber\", status, subtotal_cents AS \"subtotalCents\", updated_at AS \"updatedAt\"", [status, id]);
    return result.rows[0] || null;
  }

  async cleanupExpiredData() {
    const sessions = await this.pool.query("DELETE FROM constitution_chat_sessions WHERE expires_at <= NOW()");
    const carts = await this.pool.query("DELETE FROM carts WHERE expires_at <= NOW()");
    return { sessions: sessions.rowCount, carts: carts.rowCount };
  }

  async createOrder({ orderNumber, customer, lines, subtotalCents, cartId, userId = null, status = "pending_contact", payment = {} }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const line of lines) {
        const result = await client.query(
          "UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2 AND status = 'active' AND stock_quantity >= $1",
          [line.quantity, line.productId],
        );
        if (result.rowCount !== 1) throw new Error("product out of stock");
      }
      const orderResult = await client.query(
        `INSERT INTO orders (
          order_number, cart_id, user_id, status, customer_name, phone, email, address, city, postal_code, country_code, notes,
          subtotal_cents, payment_method, payment_status, currency_code, confirmation_token_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING ${orderColumns}`,
        [
          orderNumber,
          cartId,
          userId,
          status,
          customer.name,
          customer.phone,
          customer.email || null,
          customer.address,
          customer.city || "",
          customer.postalCode || "",
          customer.countryCode || "US",
          customer.notes || null,
          subtotalCents,
          payment.method || "manual",
          payment.status || "unpaid",
          payment.currencyCode || "USD",
          payment.confirmationTokenHash || null,
        ],
      );
      const order = orderResult.rows[0];
      for (const line of lines) {
        await client.query(
          "INSERT INTO order_items (order_id, product_id, product_slug, product_name, unit_price_cents, quantity, line_total_cents) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [order.id, line.productId, line.productSlug, line.productName, line.unitPriceCents, line.quantity, line.lineTotalCents],
        );
      }
      await client.query("COMMIT");
      return { ...order, items: lines };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
