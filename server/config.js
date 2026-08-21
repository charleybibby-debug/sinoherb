const numberFromEnv = (env, key, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const value = env[key] === undefined || env[key] === "" ? fallback : Number(env[key]);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(key + " must be an integer between " + min + " and " + max);
  }
  return value;
};

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || "development";
  const sessionSecret = env.SESSION_SECRET || "";
  if (nodeEnv === "production" && sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters in production");
  }

  return {
    nodeEnv,
    port: numberFromEnv(env, "PORT", 3000, { min: 1, max: 65535 }),
    host: env.HOST || "0.0.0.0",
    databaseUrl: env.DATABASE_URL || "postgres://sinoherb:sinoherb@localhost:5432/sinoherb",
    sessionSecret: sessionSecret || "development-only-session-secret",
    llmBaseUrl: env.LLM_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
    llmApiKey: env.LLM_API_KEY || "",
    llmModel: env.LLM_MODEL || "qwen-plus",
    configEncryptionKey: env.CONFIG_ENCRYPTION_KEY || "",
    llmTimeoutMs: numberFromEnv(env, "LLM_TIMEOUT_MS", 30000, { min: 1000, max: 120000 }),
    llmMaxOutputTokens: numberFromEnv(env, "LLM_MAX_OUTPUT_TOKENS", 900, { min: 100, max: 4000 }),
    chatRetentionDays: numberFromEnv(env, "CHAT_RETENTION_DAYS", 7, { min: 1, max: 90 }),
    cartRetentionDays: numberFromEnv(env, "CART_RETENTION_DAYS", 30, { min: 1, max: 365 }),
    customerSessionRetentionDays: numberFromEnv(env, "CUSTOMER_SESSION_RETENTION_DAYS", 30, { min: 1, max: 365 }),
    backupRetentionDays: numberFromEnv(env, "BACKUP_RETENTION_DAYS", 14, { min: 1, max: 90 }),
    mediaUploadDir: env.MEDIA_UPLOAD_DIR || "/app/uploads",
    mediaMaxBytes: numberFromEnv(env, "MEDIA_MAX_BYTES", 5 * 1024 * 1024, { min: 1024, max: 25 * 1024 * 1024 }),
    mediaBackupLimit: numberFromEnv(env, "MEDIA_BACKUP_LIMIT", 10, { min: 1, max: 50 }),
    useMemoryRepository: env.USE_MEMORY_REPOSITORY === "true",
  };
}
