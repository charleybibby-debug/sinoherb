const request = async (path, options = {}) => {
  const isMultipart = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = isMultipart ? { ...(options.headers || {}) } : { "content-type": "application/json", ...(options.headers || {}) };
  const response = await fetch("../api/v1" + path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || "请求失败");
  return payload.data;
};

const escapeText = (value) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
const statusLabel = (status) => ({ active: "已上架", archived: "已下架", draft: "草稿" }[status] || "未知状态");
const orderStatusLabel = (status) => ({ pending_payment: "待支付", pending_contact: "待联系", contacted: "已联系", confirmed: "已确认", completed: "已完成", cancelled: "已取消" }[status] || status || "未知");
const paymentMethodLabel = (value) => ({ paypal: "PayPal", manual: "人工联系" }[value] || "未知");
const paymentStatusLabel = (value) => ({ pending: "待支付", paid: "已付款", unpaid: "未付款", failed: "失败", refunded: "已退款" }[value] || "未知");
const dateLabel = (value) => value ? new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";
const moneyLabel = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((Number(cents) || 0) / 100);

const loginPanel = document.querySelector("#adminLoginPanel");
const appPanel = document.querySelector("#adminAppPanel");
const loginMessage = document.querySelector("#adminLoginMessage");
const notice = document.querySelector("#adminNotice");
const viewTitles = { overview: "概览", orders: "订单", products: "产品与库存", media: "全站图片", users: "注册用户", model: "模型状态" };
let products = [];
let orders = [];
let mediaAssets = [];
let users = [];
let productFilter = "all";
let activeView = "overview";

function showNotice(message, isError = false) {
  if (!notice) return;
  notice.textContent = message;
  notice.dataset.state = isError ? "error" : "success";
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => { notice.textContent = ""; }, 4200);
}

function setView(view) {
  if (!viewTitles[view]) return;
  activeView = view;
  document.querySelectorAll(".admin-view").forEach((panel) => {
    const isCurrent = panel.dataset.view === view;
    panel.hidden = !isCurrent;
    panel.classList.toggle("is-active", isCurrent);
  });
  document.querySelectorAll(".admin-nav-item").forEach((button) => button.classList.toggle("is-active", button.dataset.adminView === view));
  document.querySelector("#adminViewTitle").textContent = viewTitles[view];
  document.querySelector("#adminBreadcrumb").textContent = viewTitles[view];
}

function renderStats() {
  const activeProducts = products.filter((product) => product.status === "active");
  const archivedProducts = products.filter((product) => product.status !== "active");
  const pendingOrders = orders.filter((order) => order.status === "pending_contact");
  document.querySelector("#adminActiveProductCount").textContent = activeProducts.length;
  document.querySelector("#adminArchivedProductCount").textContent = archivedProducts.length;
  document.querySelector("#adminPendingOrderCount").textContent = pendingOrders.length;
  document.querySelector("#adminMediaCount").textContent = mediaAssets.length;
  document.querySelector("#adminAllProductCount").textContent = products.length;
  document.querySelector("#adminActiveFilterCount").textContent = activeProducts.length;
  document.querySelector("#adminArchivedFilterCount").textContent = archivedProducts.length;
  const badge = document.querySelector("#adminOrderBadge");
  badge.hidden = pendingOrders.length === 0;
  badge.textContent = pendingOrders.length;
  document.querySelector("#adminOrderMeta").textContent = `${orders.length} 笔订单`;
  document.querySelector("#adminMediaMeta").textContent = `${mediaAssets.length} 个图片位`;
  document.querySelector("#adminUsersMeta").textContent = `${users.length} 位用户`;
}

function renderRecentOrders() {
  const target = document.querySelector("#adminRecentOrders");
  target.innerHTML = orders.length ? orders.slice(0, 5).map((order) => `<div class="admin-list-row"><div><strong>${escapeText(order.orderNumber)}</strong><span>${escapeText(order.customerName || "未填写姓名")}</span></div><div class="admin-list-row__end"><span>${moneyLabel(order.subtotalCents)}</span><span class="admin-order-status admin-order-status--${escapeText(order.status)}">${orderStatusLabel(order.status)}</span></div></div>`).join("") : "<p class=\"admin-empty\">暂时没有订单。</p>";
}

function renderProductPulse() {
  const target = document.querySelector("#adminProductPulse");
  const attentionProducts = products.filter((product) => product.status !== "active" || Number(product.stockQuantity) <= 5).slice(0, 5);
  target.innerHTML = attentionProducts.length ? attentionProducts.map((product) => `<div class="admin-list-row"><div><strong>${escapeText(product.name)}</strong><span>${escapeText(product.constitutionType || product.category || "未分类")}</span></div><div class="admin-list-row__end"><span class="admin-stock ${Number(product.stockQuantity) <= 5 ? "is-low" : ""}">${Number(product.stockQuantity) || 0} 件</span><span class="admin-status admin-status--${escapeText(product.status)}">${statusLabel(product.status)}</span></div></div>`).join("") : "<p class=\"admin-empty\">所有产品状态良好。</p>";
}

function renderOrders() {
  const target = document.querySelector("#adminOrdersTable");
  if (!orders.length) {
    target.innerHTML = `<tr><td colspan="7"><p class="admin-empty">暂时没有订单。</p></td></tr>`;
    return;
  }
  target.innerHTML = orders.map((order) => `<tr>
    <td><strong>${escapeText(order.orderNumber)}</strong></td>
    <td><span class="admin-table-primary">${escapeText(order.customerName || "未填写姓名")}</span><span class="admin-table-secondary">${escapeText(order.phone || order.email || "未填写联系方式")}</span></td>
    <td>${moneyLabel(order.subtotalCents)}</td>
    <td><span class="admin-table-primary">${paymentMethodLabel(order.paymentMethod)}</span><span class="admin-table-secondary">${paymentStatusLabel(order.paymentStatus)}</span></td>
    <td>${dateLabel(order.createdAt)}</td>
    <td><span class="admin-order-status admin-order-status--${escapeText(order.status)}">${orderStatusLabel(order.status)}</span></td>
    <td>${order.status === "pending_contact" ? `<button class="admin-table-action" type="button" data-order-contact="${escapeText(order.id)}">标记已联系</button>` : "<span class=\"admin-table-muted\">—</span>"}</td>
  </tr>`).join("");
  target.querySelectorAll("[data-order-contact]").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await request(`/admin/orders/${encodeURIComponent(button.dataset.orderContact)}/status`, { method: "PATCH", body: JSON.stringify({ status: "contacted" }) });
      orders = await request("/admin/orders");
      renderAll();
      showNotice("订单已标记为已联系。");
    } catch (error) { button.disabled = false; showNotice(error.message, true); }
  }));
}

function renderProducts() {
  const filteredProducts = products.filter((product) => productFilter === "all" || (productFilter === "active" ? product.status === "active" : product.status !== "active"));
  const target = document.querySelector("#adminProducts");
  if (!filteredProducts.length) {
    target.innerHTML = `<tr><td colspan="6"><p class="admin-empty">这个状态下暂时没有产品。</p></td></tr>`;
    return;
  }
  target.innerHTML = filteredProducts.map((product) => `<tr>
    <td><span class="admin-table-primary">${escapeText(product.name)}</span><span class="admin-table-secondary">${escapeText(product.subtitle || "未填写副标题")}</span></td>
    <td><span class="admin-table-primary">${escapeText(product.constitutionType || "未设置体质")}</span><span class="admin-table-secondary">${escapeText(product.category || "未分类")}</span></td>
    <td><span class="admin-stock ${Number(product.stockQuantity) <= 5 ? "is-low" : ""}">${Number(product.stockQuantity) || 0} 件</span></td>
    <td><span class="admin-status admin-status--${escapeText(product.status)}">${statusLabel(product.status)}</span></td>
    <td>${dateLabel(product.updatedAt)}</td>
    <td><button class="admin-table-action" type="button" data-product-id="${escapeText(product.id)}" data-product-status="${escapeText(product.status)}">${product.status === "active" ? "下架" : "上架"}</button></td>
  </tr>`).join("");
  target.querySelectorAll("[data-product-id]").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const nextStatus = button.dataset.productStatus === "active" ? "archived" : "active";
      await request(`/admin/products/${encodeURIComponent(button.dataset.productId)}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      products = await request("/admin/products");
      renderAll();
      showNotice(nextStatus === "active" ? "产品已上架。" : "产品已下架。");
    } catch (error) { button.disabled = false; showNotice(error.message, true); }
  }));
}

function mediaCard(asset) {
  const preview = asset.url ? `<img src="${escapeText(asset.url)}" alt="${escapeText(asset.altText || asset.label)}" loading="lazy" />` : `<div class="admin-media-card__placeholder"><span>✳</span><p>暂无自定义图片</p></div>`;
  const restoreButton = asset.canRestore ? `<button type="button" class="admin-button admin-button--quiet" data-media-restore="${escapeText(asset.slotKey)}">恢复上一版</button>` : "";
  return `<article class="admin-media-card">
    <div class="admin-media-card__preview">${preview}</div>
    <div class="admin-media-card__body">
      <div class="admin-media-card__title"><div><strong>${escapeText(asset.label)}</strong><span>${escapeText(asset.slotKey)}</span></div><span class="admin-status admin-status--${escapeText(asset.status)}">${asset.status === "active" ? "启用" : "停用"}</span></div>
      <form class="admin-media-card__form" data-media-upload="${escapeText(asset.slotKey)}">
        <label>替代文本<input name="altText" value="${escapeText(asset.altText || "")}" maxlength="500" /></label>
        <label>选择图片<input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" /></label>
        <div class="admin-media-card__actions"><button class="admin-button admin-button--primary" type="submit">替换图片</button><button class="admin-button admin-button--quiet" type="button" data-media-save-alt="${escapeText(asset.slotKey)}">保存文字</button>${restoreButton}</div>
        <p class="admin-media-card__message" data-media-message="${escapeText(asset.slotKey)}"></p>
      </form>
    </div>
  </article>`;
}

function renderMedia() {
  const groups = mediaAssets.reduce((result, asset) => {
    (result[asset.pageGroup] ||= []).push(asset);
    return result;
  }, {});
  const target = document.querySelector("#adminMedia");
  target.innerHTML = Object.entries(groups).map(([group, assets]) => `<section class="admin-media-group"><div class="admin-media-group__heading"><h3>${escapeText(group)}</h3><span>${assets.length} 个图片位</span></div><div class="admin-media-grid">${assets.map(mediaCard).join("")}</div></section>`).join("") || "<p class=\"admin-empty\">暂时没有图片位。</p>";

  target.querySelectorAll("[data-media-upload]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = form.querySelector("[data-media-message]");
    const file = form.elements.file.files[0];
    if (!file) { message.textContent = "请先选择图片文件。"; return; }
    const body = new FormData();
    body.append("file", file);
    body.append("altText", form.elements.altText.value);
    try {
      message.textContent = "上传中…";
      await request(`/admin/media/${encodeURIComponent(form.dataset.mediaUpload)}`, { method: "POST", body });
      mediaAssets = await request("/admin/media");
      renderAll();
      showNotice("图片已更新。");
    } catch (error) { message.textContent = error.message; }
  }));
  target.querySelectorAll("[data-media-save-alt]").forEach((button) => button.addEventListener("click", async () => {
    const form = [...target.querySelectorAll("[data-media-upload]")].find((item) => item.dataset.mediaUpload === button.dataset.mediaSaveAlt);
    const message = form.querySelector("[data-media-message]");
    try {
      await request(`/admin/media/${encodeURIComponent(button.dataset.mediaSaveAlt)}`, { method: "PATCH", body: JSON.stringify({ altText: form.elements.altText.value }) });
      message.textContent = "替代文本已保存。";
      showNotice("替代文本已保存。");
    } catch (error) { message.textContent = error.message; }
  }));
  target.querySelectorAll("[data-media-restore]").forEach((button) => button.addEventListener("click", async () => {
    try {
      await request(`/admin/media/${encodeURIComponent(button.dataset.mediaRestore)}/restore`, { method: "POST" });
      mediaAssets = await request("/admin/media");
      renderAll();
      showNotice("图片已恢复上一版。");
    } catch (error) { showNotice(error.message, true); }
  }));
}

function renderUsers() {
  const target = document.querySelector("#adminUsersTable");
  if (!users.length) {
    target.innerHTML = `<tr><td colspan="5"><p class="admin-empty">暂时没有注册用户。</p></td></tr>`;
    return;
  }
  target.innerHTML = users.map((user) => `<tr>
    <td><span class="admin-table-primary">${escapeText(user.name || "未设置昵称")}</span><span class="admin-table-secondary">${escapeText(user.id)}</span></td>
    <td><span class="admin-table-primary">${escapeText(user.email || "未填写邮箱")}</span><span class="admin-table-secondary">${escapeText(user.phone || "未填写手机号")}</span></td>
    <td><span class="admin-status admin-status--${escapeText(user.status)}">${user.status === "active" ? "正常" : "已停用"}</span></td>
    <td>${dateLabel(user.createdAt)}</td>
    <td>${dateLabel(user.lastLoginAt)}</td>
  </tr>`).join("");
}

function renderModel(model) {
  const configured = Boolean(model?.configured);
  document.querySelector("#adminModelHealth").innerHTML = `<div class="admin-model-grid">
    <article class="admin-model-card admin-model-card--primary"><div class="admin-model-card__icon">✦</div><div><p class="admin-overline">Provider</p><h3>${configured ? "阿里云百炼" : "本地降级规则"}</h3><p>${configured ? "大模型服务已连接，可用于体质对话。" : "未配置大模型密钥，当前由本地规则保障基础体验。"}</p></div><span class="admin-model-state ${configured ? "is-ready" : "is-fallback"}"><i></i>${configured ? "已连接" : "降级中"}</span></article>
    <article class="admin-model-card"><p class="admin-overline">Current route</p><h3>${configured ? escapeText(model?.model || "云端模型") : "Local Constitution Rules"}</h3><dl><div><dt>对话服务</dt><dd>${configured ? "云端模型" : "本地规则"}</dd></div><div><dt>状态检查</dt><dd>${configured ? "正常" : "可用"}</dd></div><div><dt>切换策略</dt><dd>自动降级</dd></div></dl></article>
    <article class="admin-model-card admin-model-config"><div class="admin-model-config__heading"><div><p class="admin-overline">Runtime settings</p><h3>模型接入配置</h3><p>保存后立即应用到下一次体质对话。API Key 只保存加密密文。</p></div><span class="admin-model-config__updated">${model?.updatedAt ? `最近更新 ${dateLabel(model.updatedAt)}` : "当前使用环境变量"}</span></div>${model?.canPersist === false ? "<p class=\"admin-model-config__warning\">服务器尚未配置 CONFIG_ENCRYPTION_KEY，暂时不能保存数据库配置。</p>" : ""}<form id="adminModelConfigForm" class="admin-model-form"><div class="admin-model-form__grid"><label><span class="admin-model-form__label">服务地址</span><input name="baseUrl" value="${escapeText(model?.baseUrl || "")}" autocomplete="url" required /></label><label><span class="admin-model-form__label">模型名称</span><input name="model" value="${escapeText(model?.model || "")}" autocomplete="off" required /></label><label class="admin-model-form__key"><span class="admin-model-form__label">API Key</span><input name="apiKey" type="password" autocomplete="new-password" placeholder="${model?.hasApiKey ? `当前：${escapeText(model.maskedApiKey)}` : "请输入新的 API Key"}" /><span class="admin-model-form__hint">${model?.hasApiKey ? "留空表示保留当前密钥" : "保存后将加密写入数据库"}</span></label></div><div class="admin-model-form__actions"><button class="admin-button admin-button--primary" type="button" data-model-test>测试模型联通性</button><button class="admin-button admin-button--primary" type="submit"${model?.canPersist === false ? " disabled" : ""}>保存配置</button><p class="admin-model-config__message" data-model-config-message></p></div></form></article>
  </div>`;
  const form = document.querySelector("#adminModelConfigForm");
  const message = form.querySelector("[data-model-config-message]");
  form.querySelector("[data-model-test]").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const patch = Object.fromEntries(new FormData(form));
    if (!patch.apiKey) delete patch.apiKey;
    button.disabled = true;
    message.textContent = "测试中…";
    try {
      const result = await request("/admin/model-config/test", { method: "POST", body: JSON.stringify(patch) });
      message.textContent = `连接成功 · ${result.model || "未知模型"} · ${result.latencyMs}ms`;
    } catch (error) { message.textContent = error.message; }
    finally { button.disabled = false; }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector("button[type=submit]");
    const patch = Object.fromEntries(new FormData(form));
    if (!patch.apiKey) delete patch.apiKey;
    submitButton.disabled = true;
    message.textContent = "保存中…";
    try {
      const updated = await request("/admin/model-config", { method: "PATCH", body: JSON.stringify(patch) });
      renderModel(updated);
      showNotice("模型配置已保存，后续对话将使用新配置。");
    } catch (error) { message.textContent = error.message; } finally { submitButton.disabled = false; }
  });
}

function renderAll(model) {
  renderStats();
  renderRecentOrders();
  renderProductPulse();
  renderOrders();
  renderProducts();
  renderMedia();
  renderUsers();
  if (model) renderModel(model);
}

async function renderDashboard() {
  const [nextOrders, nextProducts, nextMedia, nextUsers, model] = await Promise.all([request("/admin/orders"), request("/admin/products"), request("/admin/media"), request("/admin/users"), request("/admin/model-health")]);
  orders = nextOrders;
  products = nextProducts;
  mediaAssets = nextMedia;
  users = nextUsers;
  renderAll(model);
  setView(activeView);
}

document.querySelectorAll("[data-admin-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.adminView)));
document.querySelectorAll("[data-product-filter]").forEach((button) => button.addEventListener("click", () => {
  productFilter = button.dataset.productFilter;
  document.querySelectorAll("[data-product-filter]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  renderProducts();
}));

document.querySelector("#adminLoginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const submitButton = event.currentTarget.querySelector("button[type=submit]");
  submitButton.disabled = true;
  loginMessage.textContent = "";
  try {
    const session = await request("/admin/auth/login", { method: "POST", body: JSON.stringify(Object.fromEntries(form)) });
    document.querySelector("#adminUsername").textContent = session.username || "管理员";
    loginPanel.hidden = true;
    appPanel.hidden = false;
    await renderDashboard();
  } catch (error) { loginMessage.textContent = error.message; } finally { submitButton.disabled = false; }
});

document.querySelector("#adminLogout")?.addEventListener("click", async () => {
  try { await request("/admin/auth/logout", { method: "POST" }); } catch {}
  appPanel.hidden = true;
  loginPanel.hidden = false;
  loginMessage.textContent = "";
});

request("/admin/auth/session").then(async (session) => {
  document.querySelector("#adminUsername").textContent = session.username || "管理员";
  loginPanel.hidden = true;
  appPanel.hidden = false;
  await renderDashboard();
}).catch(() => {});
