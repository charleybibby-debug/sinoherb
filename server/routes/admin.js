import { randomUUID } from "node:crypto";
import { createToken, hashToken } from "../auth.js";
import { transitionOrderStatus } from "../domain/orders.js";
import { badRequest, notFound } from "../http-errors.js";
import { publicMediaUrl, removeStoredMedia, saveMediaUpload, storedMediaExists } from "../media-storage.js";
import { publicUser } from "../user-auth.js";

const adminMedia = (asset) => ({
  ...asset,
  url: publicMediaUrl(asset.filePath) || asset.defaultPath || null,
  canRestore: Boolean(asset.backupPaths?.length),
});

export function registerAdminRoutes(app, { repository, config, modelConfig, verifyPassword, hashPassword }) {
  app.post("/api/v1/admin/auth/login", async (request, reply) => {
    const { username, password } = request.body || {};
    const user = await repository.getAdminByUsername?.(username || "");
    const valid = user && await verifyPassword(password || "", user.passwordHash);
    if (!valid) return reply.code(401).send({ error: { code: "INVALID_LOGIN", message: "用户名或密码错误。" } });
    const token = createToken();
    await repository.saveAdminSession({
      id: randomUUID(),
      adminUserId: user.id,
      tokenHash: hashToken(token),
      expiresAt: Date.now() + 8 * 3600000,
    });
    reply.setCookie("sinoherb_admin_session", token, { httpOnly: true, sameSite: "strict", secure: config.nodeEnv === "production", path: "/", maxAge: 8 * 3600 });
    return { data: { username: user.username } };
  });

  app.post("/api/v1/admin/auth/logout", async (request, reply) => {
    reply.clearCookie("sinoherb_admin_session", { path: "/" });
    return { data: { ok: true } };
  });

  app.get("/api/v1/admin/auth/session", async (request) => ({ data: { username: request.adminUser.username } }));

  app.get("/api/v1/admin/products", async () => ({ data: await repository.listProducts({ includeInactive: true }) }));

  app.get("/api/v1/admin/media", async (request) => ({
    data: (await repository.listMediaAssets({ includeInactive: true, pageGroup: request.query?.pageGroup })).map(adminMedia),
  }));

  app.post("/api/v1/admin/media/:slotKey", async (request, reply) => {
    const asset = await repository.getMediaAssetBySlot(request.params.slotKey);
    if (!asset) throw notFound("图片位不存在。");
    let upload = null;
    let altText;
    for await (const part of request.parts({ limits: { files: 1, fields: 2, fileSize: config.mediaMaxBytes } })) {
      if (part.type === "file") {
        if (upload) {
          part.file.resume();
          await removeStoredMedia(config, upload.filePath);
          throw badRequest("TOO_MANY_MEDIA_FILES", "每次只能上传一张图片。");
        }
        upload = await saveMediaUpload(part, config);
      } else if (part.fieldname === "altText") {
        altText = String(part.value || "").trim().slice(0, 500);
      }
    }
    if (!upload) throw badRequest("MEDIA_FILE_REQUIRED", "请选择要上传的图片。");
    const backupPaths = [...(asset.backupPaths || [])];
    if (asset.filePath) backupPaths.push(asset.filePath);
    const nextBackups = backupPaths.slice(-config.mediaBackupLimit);
    try {
      const updated = await repository.updateMediaAsset(request.params.slotKey, {
        filePath: upload.filePath,
        mimeType: upload.mimeType,
        fileSize: upload.fileSize,
        backupPaths: nextBackups,
        ...(altText === undefined ? {} : { altText }),
        status: "active",
      });
      return reply.code(201).send({ data: adminMedia(updated) });
    } catch (error) {
      await removeStoredMedia(config, upload.filePath);
      throw error;
    }
  });

  app.patch("/api/v1/admin/media/:slotKey", async (request) => {
    const patch = {};
    if (request.body?.altText !== undefined) {
      if (typeof request.body.altText !== "string" || request.body.altText.length > 500) throw badRequest("INVALID_ALT_TEXT", "替代文本不能超过 500 个字符。");
      patch.altText = request.body.altText.trim();
    }
    if (request.body?.status !== undefined) {
      if (!["active", "inactive"].includes(request.body.status)) throw badRequest("INVALID_MEDIA_STATUS", "图片状态无效。");
      patch.status = request.body.status;
    }
    const updated = await repository.updateMediaAsset(request.params.slotKey, patch);
    if (!updated) throw notFound("图片位不存在。");
    return { data: adminMedia(updated) };
  });

  app.post("/api/v1/admin/media/:slotKey/restore", async (request) => {
    const asset = await repository.getMediaAssetBySlot(request.params.slotKey);
    if (!asset) throw notFound("图片位不存在。");
    const previousPath = asset.backupPaths?.at(-1);
    if (!previousPath || !(await storedMediaExists(config, previousPath))) throw badRequest("MEDIA_BACKUP_NOT_FOUND", "没有可恢复的上一版图片。");
    return { data: adminMedia(await repository.restoreMediaAsset(request.params.slotKey)) };
  });

  app.patch("/api/v1/admin/products/:productId", async (request, reply) => {
    if (!repository.updateProduct) throw new Error("repository does not support product updates");
    const product = await repository.updateProduct(request.params.productId, request.body || {});
    if (!product) throw notFound("产品不存在。");
    return { data: product };
  });

  app.get("/api/v1/admin/orders", async () => ({ data: await repository.listOrders?.() || [] }));

  app.get("/api/v1/admin/users", async () => ({ data: (await repository.listUsers?.() || []).map(publicUser) }));

  app.get("/api/v1/admin/orders/:orderId", async (request) => {
    const order = await repository.getOrder(request.params.orderId);
    if (!order) throw notFound("订单不存在。");
    return { data: order };
  });

  app.patch("/api/v1/admin/orders/:orderId/status", async (request) => {
    const order = await repository.getOrder(request.params.orderId);
    if (!order) throw notFound("订单不存在。");
    const status = request.body?.status;
    transitionOrderStatus(order.status, status);
    return { data: await repository.updateOrderStatus(order.id, status) };
  });

  app.get("/api/v1/admin/model-health", async () => ({ data: modelConfig?.publicState() || { configured: Boolean(config.llmApiKey), provider: config.llmApiKey ? "bailian" : "local-fallback", baseUrl: config.llmBaseUrl, model: config.llmModel, hasApiKey: Boolean(config.llmApiKey), maskedApiKey: "", canPersist: Boolean(config.configEncryptionKey) } }));

  app.patch("/api/v1/admin/model-config", async (request) => {
    if (!modelConfig) throw badRequest("MODEL_CONFIG_UNAVAILABLE", "模型配置服务不可用。");
    try {
      return { data: await modelConfig.update(request.body || {}, request.adminUser?.id) };
    } catch (error) {
      throw badRequest("INVALID_MODEL_CONFIG", error.message);
    }
  });

  app.post("/api/v1/admin/products", async (request) => {
    if (!repository.createProduct) throw badRequest("NOT_SUPPORTED", "当前仓储不支持新增产品。");
    return { data: await repository.createProduct(request.body || {}) };
  });
}
