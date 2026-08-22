import Fastify from "fastify";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { loadConfig } from "./config.js";
import { MemoryRepository } from "./repositories/memory-repository.js";
import { ChatService } from "./services/chat-service.js";
import { registerAuth } from "./auth.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { createLlmProvider } from "./llm/provider.js";
import { PostgresRepository } from "./repositories/postgres-repository.js";
import pg from "pg";
import { cleanupExpiredData } from "./retention.js";
import { createModelConfigService } from "./model-config.js";
import { createPaypalClient } from "./paypal/client.js";
import { registerPaymentRoutes } from "./routes/payments.js";
import { PaymentService } from "./services/payment-service.js";
import argon2 from "argon2";

function createRepository(config) {
  if (config.nodeEnv === "test" || config.useMemoryRepository) return new MemoryRepository();
  return new PostgresRepository(new pg.Pool({ connectionString: config.databaseUrl, max: 5, idleTimeoutMillis: 10000 }));
}

export function buildApp({
  config = loadConfig(),
  logger = false,
  repository = createRepository(config),
  provider,
  paypalClient: injectedPaypalClient,
  paymentService: injectedPaymentService,
} = {}) {
  const app = Fastify({ logger });
  const modelConfig = createModelConfigService({ repository, envConfig: config, providerFactory: provider ? () => provider : createLlmProvider });
  const llmProvider = provider || createLlmProvider(modelConfig);
  app.register(cookie);
  app.register(formbody);
  app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  app.register(multipart, { limits: { files: 1, fileSize: config.mediaMaxBytes, fields: 2 } });
  app.get("/api/health", async () => ({ data: { status: "ok" } }));
  const auth = registerAuth(app, { repository, config });
  const chatService = new ChatService({ repository, provider: llmProvider, config });
  const paypalClient = injectedPaypalClient || createPaypalClient(config);
  const paymentService = injectedPaymentService || new PaymentService({ repository, paypalClient });
  const verifyPassword = (password, hash) => argon2.verify(hash, password);
  const hashPassword = (password) => argon2.hash(password);
  registerPublicRoutes(app, { repository, chatService, auth, config, verifyPassword, hashPassword });
  registerPaymentRoutes(app, { paymentService, auth });
  registerAdminRoutes(app, {
    repository,
    config,
    modelConfig,
    llmProvider,
    verifyPassword,
    hashPassword,
  });
  app.addHook("onReady", async () => {
    await repository.ensureModelConfigSchema?.();
    await repository.ensureCustomerUserSchema?.();
    await modelConfig.load();
  });
  const retentionTimer = setInterval(() => Promise.all([
    cleanupExpiredData(repository),
    paymentService.cancelExpiredPendingPayments(),
  ]).catch((error) => app.log.error(error, "retention cleanup failed")), 86400000);
  retentionTimer.unref?.();
  app.addHook("onClose", async () => clearInterval(retentionTimer));
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;
    request.log.error({ requestId: request.id, code: error.code }, statusCode >= 500 ? "request failed" : "request rejected");
    reply.code(statusCode).send({ error: { code: error.code || "INTERNAL_ERROR", message: statusCode >= 500 ? "服务暂时不可用，请稍后重试。" : error.message, requestId: request.id } });
  });
  return app;
}

if (process.argv[1] && process.argv[1].endsWith("/server/app.js")) {
  const config = loadConfig();
  const app = buildApp({ config, logger: true });
  app.listen({ host: config.host, port: config.port }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
}
