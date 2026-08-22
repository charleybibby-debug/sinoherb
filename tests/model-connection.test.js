import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { MemoryRepository } from "../server/repositories/memory-repository.js";
import { registerAdminRoutes } from "../server/routes/admin.js";

test("admin can test the configured model connection", async () => {
  const repository = new MemoryRepository();
  const app = Fastify();
  registerAdminRoutes(app, {
    repository,
    config: { nodeEnv: "test" },
    modelConfig: { async testConnection() { return { model: "qwen-plus", latencyMs: 42 }; } },
    verifyPassword: async () => true,
    hashPassword: async () => "hash",
  });

  const response = await app.inject({ method: "POST", url: "/api/v1/admin/model-config/test", payload: {} });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data, { ok: true, model: "qwen-plus", latencyMs: 42 });
  await app.close();
});
