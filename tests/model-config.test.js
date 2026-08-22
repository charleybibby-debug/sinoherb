import assert from "node:assert/strict";
import test from "node:test";
import { decryptApiKey, encryptApiKey, maskApiKey } from "../server/model-config.js";
import { createLlmProvider } from "../server/llm/provider.js";
import { MemoryRepository } from "../server/repositories/memory-repository.js";

const encryptionKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

test("model API keys are encrypted, decryptable, and masked for the admin UI", () => {
  const encrypted = encryptApiKey("sk-sensitive-key", encryptionKey);
  assert.notEqual(encrypted.ciphertext, "sk-sensitive-key");
  assert.equal(decryptApiKey(encrypted, encryptionKey), "sk-sensitive-key");
  assert.equal(maskApiKey("sk-sensitive-key"), "sk-•••••••••-key");
});

test("memory repository stores one replaceable model configuration", async () => {
  const repository = new MemoryRepository();
  assert.equal(await repository.getModelConfig(), null);
  const saved = await repository.saveModelConfig({
    provider: "bailian",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    apiKey: { ciphertext: "ciphertext-1", iv: "iv-1", authTag: "tag-1" },
  });
  assert.equal(saved.model, "qwen-plus");
  const replaced = await repository.saveModelConfig({ ...saved, model: "qwen-max", apiKey: { ciphertext: "ciphertext-2", iv: "iv-1", authTag: "tag-1" } });
  assert.equal(replaced.model, "qwen-max");
  assert.equal((await repository.getModelConfig()).apiKey.ciphertext, "ciphertext-2");
});

test("llm provider tests connectivity with a minimal completion", async () => {
  let request;
  const provider = createLlmProvider({ llmApiKey: "test-key", llmBaseUrl: "https://example.com/v1", llmModel: "qwen-plus", llmTimeoutMs: 1000, llmMaxOutputTokens: 20 }, async (url, options) => {
    request = { url, options };
    return { ok: true, async json() { return { model: "qwen-plus", choices: [{ message: { content: '{"ok":true}' } }] }; } };
  });

  const result = await provider.testConnection();
  assert.equal(result.model, "qwen-plus");
  assert.equal(request.url, "https://example.com/v1/chat/completions");
  assert.match(request.options.body, /连接测试/);
});
