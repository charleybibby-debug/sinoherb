import { createLlmProvider } from "./provider.js";

export function createBailianProvider(config, fetchImpl = fetch) {
  return createLlmProvider({ ...config, llmBaseUrl: config.llmBaseUrl || "https://dashscope.aliyuncs.com/compatible-mode/v1" }, fetchImpl);
}
