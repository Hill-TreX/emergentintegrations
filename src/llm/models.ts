/**
 * List available models from OpenAI, Anthropic, or via the Emergent proxy.
 * Mirrors the spirit of the Python package — unified interface, one function.
 */

import OpenAI from "openai";
import { getIntegrationProxyUrl } from "./utils";

export interface ModelInfo {
  id: string;
  provider: string;
  created?: number;
  owned_by?: string;
}

export interface ListModelsOptions {
  /** Your API key — provider key or sk-emergent-* for proxy */
  apiKey: string;
  /**
   * Which provider to list models for.
   * "openai" | "anthropic" | "gemini" | "all"
   * Default: "openai"
   */
  provider?: "openai" | "anthropic" | "gemini" | "all";
}

/**
 * List available models from one or all providers.
 *
 * @example
 * // OpenAI models
 * const models = await listModels({ apiKey: process.env.OPENAI_API_KEY });
 *
 * // Anthropic models
 * const models = await listModels({ apiKey: process.env.ANTHROPIC_API_KEY, provider: "anthropic" });
 *
 * // All providers via Emergent proxy
 * const models = await listModels({ apiKey: process.env.EMERGENT_LLM_KEY, provider: "all" });
 */
export async function listModels({
  apiKey,
  provider = "openai",
}: ListModelsOptions): Promise<ModelInfo[]> {
  const isEmergentKey = apiKey.startsWith("sk-emergent-");
  const proxyBase = getIntegrationProxyUrl() + "/llm";

  if (provider === "all") {
    // Fetch from all three providers in parallel via proxy or direct
    const [openaiModels, anthropicModels, geminiModels] = await Promise.allSettled([
      _fetchOpenAIModels(apiKey, isEmergentKey ? proxyBase : null),
      _fetchAnthropicModels(apiKey, isEmergentKey ? proxyBase : null),
      _fetchGeminiModels(apiKey, isEmergentKey ? proxyBase : null),
    ]);

    const results: ModelInfo[] = [];
    if (openaiModels.status === "fulfilled") results.push(...openaiModels.value);
    if (anthropicModels.status === "fulfilled") results.push(...anthropicModels.value);
    if (geminiModels.status === "fulfilled") results.push(...geminiModels.value);
    return results;
  }

  if (provider === "anthropic") {
    return _fetchAnthropicModels(apiKey, isEmergentKey ? proxyBase : null);
  }

  if (provider === "gemini") {
    return _fetchGeminiModels(apiKey, isEmergentKey ? proxyBase : null);
  }

  // Default: openai
  return _fetchOpenAIModels(apiKey, isEmergentKey ? proxyBase : null);
}

async function _fetchOpenAIModels(apiKey: string, baseURL: string | null): Promise<ModelInfo[]> {
  try {
    const client = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });
    const response = await client.models.list();
    return response.data.map((m: any) => ({
      id: m.id,
      provider: "openai",
      created: m.created,
      owned_by: m.owned_by,
    }));
  } catch (e: any) {
    throw new Error(`Failed to list OpenAI models: ${e.message}`);
  }
}

async function _fetchAnthropicModels(apiKey: string, baseURL: string | null): Promise<ModelInfo[]> {
  try {
    // Anthropic exposes a models endpoint compatible with the OpenAI SDK when using proxy
    // For direct Anthropic API, use their REST endpoint
    if (baseURL) {
      const client = new OpenAI({ apiKey, baseURL });
      try {
        const response = await client.models.list();
        return response.data.map((m: any) => ({
          id: m.id,
          provider: "anthropic",
          created: m.created,
          owned_by: m.owned_by ?? "anthropic",
        }));
      } catch {
        // Proxy may not expose anthropic model list — fall through to hardcoded
      }
    }

    // Anthropic REST API direct
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: any = await res.json();

    return (data.data || []).map((m: any) => ({
      id: m.id,
      provider: "anthropic",
      created: m.created_at ? Math.floor(new Date(m.created_at).getTime() / 1000) : undefined,
      owned_by: "anthropic",
    }));
  } catch (e: any) {
    throw new Error(`Failed to list Anthropic models: ${e.message}`);
  }
}

async function _fetchGeminiModels(apiKey: string, baseURL: string | null): Promise<ModelInfo[]> {
  try {
    if (baseURL) {
      // Try via proxy using OpenAI-compatible endpoint
      const client = new OpenAI({ apiKey, baseURL });
      try {
        const response = await client.models.list();
        return response.data
          .filter((m: any) => m.id.includes("gemini"))
          .map((m: any) => ({
            id: m.id,
            provider: "gemini",
            created: m.created,
            owned_by: "google",
          }));
      } catch {
        // fall through to Google REST API
      }
    }

    // Google REST API direct
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: any = await res.json();

    return (data.models || []).map((m: any) => ({
      id: m.name.replace("models/", ""),
      provider: "gemini",
      owned_by: "google",
    }));
  } catch (e: any) {
    throw new Error(`Failed to list Gemini models: ${e.message}`);
  }
}
