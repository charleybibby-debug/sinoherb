import assert from "node:assert/strict";
import test from "node:test";
import { ChatService } from "../server/services/chat-service.js";
import { MemoryRepository } from "../server/repositories/memory-repository.js";

test("chat service uses local fallback when no model key is configured", async () => {
  const repository = new MemoryRepository();
  const service = new ChatService({ repository, config: { chatRetentionDays: 7 } });
  const session = await service.createSession("visitor-hash");
  const response = await service.completeMessage(session.id, "最近睡不好，压力很大");
  assert.equal(response.degraded, true);
  assert.equal(response.result.primaryType, "qiStagnation");
});

test("chat service repairs one invalid model response", async () => {
  const repository = new MemoryRepository();
  let calls = 0;
  const provider = {
    async complete() {
      calls += 1;
      if (calls === 1) return { content: "not json", model: "qwen-plus" };
      return {
        content: JSON.stringify({
          primaryType: "qiStagnation",
          secondaryType: null,
          confidenceLevel: "medium",
          evidence: ["近期压力和睡眠变化"],
          guidance: ["先安排固定的放松时间"],
          productCategories: ["pressure"],
          safetyNotice: "这只是健康生活参考，不是医疗诊断。",
        }),
        model: "qwen-plus",
      };
    },
  };
  const service = new ChatService({ repository, provider, config: { llmModel: "qwen-plus", chatRetentionDays: 7 } });
  const session = await service.createSession("visitor-hash");
  const response = await service.completeMessage(session.id, "最近压力很大");
  assert.equal(response.degraded, false);
  assert.equal(calls, 2);
});
