import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";
const keyPattern = /^[0-9a-f]{64}$/i;

function encryptionKeyBytes(encryptionKey) {
  if (typeof encryptionKey !== "string" || !keyPattern.test(encryptionKey)) {
    throw new Error("CONFIG_ENCRYPTION_KEY must be a 64-character hexadecimal string");
  }
  return Buffer.from(encryptionKey, "hex");
}

export function encryptApiKey(apiKey, encryptionKey) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, encryptionKeyBytes(encryptionKey), iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
}

export function decryptApiKey(encrypted, encryptionKey) {
  if (!encrypted?.ciphertext) return "";
  const decipher = createDecipheriv(algorithm, encryptionKeyBytes(encryptionKey), Buffer.from(encrypted.iv, "base64"));
  decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

export function maskApiKey(apiKey) {
  if (!apiKey) return "";
  if (apiKey.length <= 7) return "••••••";
  return apiKey.slice(0, 3) + "•••••••••" + apiKey.slice(-4);
}

function normalizedBaseUrl(baseUrl) {
  if (typeof baseUrl !== "string" || !baseUrl.trim()) throw new Error("模型服务地址不能为空。");
  let parsed;
  try { parsed = new URL(baseUrl.trim()); } catch { throw new Error("模型服务地址格式无效。"); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("模型服务地址必须使用 HTTP 或 HTTPS。");
  return parsed.toString().replace(/\/$/, "");
}

function normalizedModel(model) {
  if (typeof model !== "string" || !model.trim() || model.trim().length > 200) throw new Error("模型名称不能为空且不能超过 200 个字符。");
  return model.trim();
}

export function validateModelConfigPatch(patch = {}) {
  const normalized = {};
  if (patch.baseUrl !== undefined) normalized.baseUrl = normalizedBaseUrl(patch.baseUrl);
  if (patch.model !== undefined) normalized.model = normalizedModel(patch.model);
  if (patch.apiKey !== undefined) {
    if (typeof patch.apiKey !== "string" || patch.apiKey.length > 500) throw new Error("API Key 不能超过 500 个字符。");
    normalized.apiKey = patch.apiKey.trim();
  }
  if (!Object.keys(normalized).length) throw new Error("请至少填写一项模型配置。");
  return normalized;
}

export function createModelConfigService({ repository, envConfig }) {
  let runtime = {
    provider: "bailian",
    llmBaseUrl: envConfig.llmBaseUrl,
    llmModel: envConfig.llmModel,
    llmApiKey: envConfig.llmApiKey || "",
    llmTimeoutMs: envConfig.llmTimeoutMs,
    llmMaxOutputTokens: envConfig.llmMaxOutputTokens,
    source: "env",
    updatedAt: null,
  };

  const applyPersisted = (stored) => {
    if (!stored) return;
    if (stored.apiKey && !envConfig.configEncryptionKey) throw new Error("CONFIG_ENCRYPTION_KEY is required to load the saved model configuration");
    const apiKey = stored.apiKey ? decryptApiKey(stored.apiKey, envConfig.configEncryptionKey) : "";
    runtime = { provider: stored.provider || "bailian", llmBaseUrl: stored.baseUrl, llmModel: stored.model, llmApiKey: apiKey, llmTimeoutMs: envConfig.llmTimeoutMs, llmMaxOutputTokens: envConfig.llmMaxOutputTokens, source: "database", updatedAt: stored.updatedAt || null };
  };

  return {
    async load() {
      applyPersisted(await repository.getModelConfig?.());
      return this.publicState();
    },
    getRuntimeConfig() { return { ...runtime }; },
    publicState() {
      return { configured: Boolean(runtime.llmApiKey), provider: runtime.provider, baseUrl: runtime.llmBaseUrl, model: runtime.llmModel, hasApiKey: Boolean(runtime.llmApiKey), maskedApiKey: maskApiKey(runtime.llmApiKey), source: runtime.source, updatedAt: runtime.updatedAt, canPersist: Boolean(envConfig.configEncryptionKey) };
    },
    async update(patch, updatedBy) {
      const normalized = validateModelConfigPatch(patch);
      if (!envConfig.configEncryptionKey) throw new Error("请先在服务器 .env 配置 CONFIG_ENCRYPTION_KEY。");
      const nextBaseUrl = normalized.baseUrl || runtime.llmBaseUrl;
      const nextModel = normalized.model || runtime.llmModel;
      const nextApiKey = normalized.apiKey || runtime.llmApiKey;
      const encrypted = nextApiKey ? encryptApiKey(nextApiKey, envConfig.configEncryptionKey) : null;
      const saved = await repository.saveModelConfig({ provider: "bailian", baseUrl: nextBaseUrl, model: nextModel, apiKey: encrypted, updatedBy: updatedBy || null });
      applyPersisted(saved);
      return this.publicState();
    },
  };
}
