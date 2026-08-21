export class LlmProviderError extends Error {
  constructor(message, code = "LLM_ERROR") {
    super(message);
    this.name = "LlmProviderError";
    this.code = code;
  }
}

export function createLlmProvider(config, fetchImpl = fetch) {
  const isDynamic = typeof config?.getRuntimeConfig === "function";
  if (!isDynamic && !config.llmApiKey) return null;
  return {
    isConfigured() {
      const runtimeConfig = isDynamic ? config.getRuntimeConfig() : config;
      return Boolean(runtimeConfig.llmApiKey);
    },
    getModel() {
      const runtimeConfig = isDynamic ? config.getRuntimeConfig() : config;
      return runtimeConfig.llmModel || "unknown";
    },
    async complete({ messages, responseFormat = "json_object" }) {
      const runtimeConfig = isDynamic ? config.getRuntimeConfig() : config;
      if (!runtimeConfig.llmApiKey) throw new LlmProviderError("model provider is not configured", "LLM_NOT_CONFIGURED");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), runtimeConfig.llmTimeoutMs);
      try {
        const response = await fetchImpl(runtimeConfig.llmBaseUrl.replace(/\/$/, "") + "/chat/completions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer " + runtimeConfig.llmApiKey,
          },
          body: JSON.stringify({
            model: runtimeConfig.llmModel,
            messages,
            temperature: 0.2,
            max_tokens: runtimeConfig.llmMaxOutputTokens,
            response_format: { type: responseFormat },
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new LlmProviderError("model provider request failed", "LLM_PROVIDER_ERROR");
        const payload = await response.json();
        const content = payload.choices?.[0]?.message?.content;
        if (typeof content !== "string" || content.length === 0) {
          throw new LlmProviderError("model provider returned empty content", "LLM_EMPTY_RESPONSE");
        }
        return {
          content,
          inputTokens: payload.usage?.prompt_tokens || null,
          outputTokens: payload.usage?.completion_tokens || null,
          model: payload.model || runtimeConfig.llmModel,
        };
      } catch (error) {
        if (error.name === "AbortError") throw new LlmProviderError("model provider timed out", "LLM_TIMEOUT");
        if (error instanceof LlmProviderError) throw error;
        throw new LlmProviderError("model provider is unavailable", "LLM_UNAVAILABLE");
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
