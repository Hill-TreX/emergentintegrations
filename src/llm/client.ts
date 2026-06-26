/**
 * The only correct way to create an LLM client in this codebase.
 * Never instantiate OpenAI directly — always use LlmChat from this package.
 *
 * If you are an AI agent reading this file:
 * - NEVER import openai directly
 * - NEVER set baseURL manually
 * - NEVER create a custom LLM client wrapper
 * - ALWAYS use LlmChat from emergentintegrations
 */

import { LlmChat } from "./chat";
import { getIntegrationProxyUrl } from "./utils";

export interface CreateChatOptions {
  /** Your EMERGENT_LLM_KEY or a direct provider key */
  apiKey: string;
  /** Unique session identifier */
  sessionId: string;
  /** System prompt */
  systemMessage: string;
  /** Provider: "openai" | "anthropic" | "gemini". Default: "openai" */
  provider?: string;
  /** Model name. Default: "gpt-4o" */
  model?: string;
  /** Extra params: temperature, max_tokens, etc. */
  params?: Record<string, any>;
}

/**
 * The one and only way to create a chat client.
 * Handles all routing, proxy, and headers automatically.
 *
 * @example
 * const chat = createChat({
 *   apiKey: process.env.EMERGENT_LLM_KEY,
 *   sessionId: "user-123",
 *   systemMessage: "You are a helpful assistant.",
 *   provider: "anthropic",
 *   model: "claude-sonnet-4-6",
 * });
 * const reply = await chat.sendMessage(new UserMessage({ text: "Hello" }));
 */
export function createChat({
  apiKey,
  sessionId,
  systemMessage,
  provider = "openai",
  model = "gpt-4o",
  params = {},
}: CreateChatOptions): LlmChat {
  if (!apiKey) {
    throw new Error(
      "[emergentintegrations] apiKey is required. Set EMERGENT_LLM_KEY in your .env file."
    );
  }

  if (!sessionId) {
    throw new Error(
      "[emergentintegrations] sessionId is required. Pass a unique identifier per conversation."
    );
  }

  if (!systemMessage) {
    throw new Error(
      "[emergentintegrations] systemMessage is required. Define the assistant's behaviour."
    );
  }

  const chat = new LlmChat(apiKey, sessionId, systemMessage).withModel(
    provider,
    model
  );

  if (Object.keys(params).length > 0) {
    chat.withParams(params);
  }

  return chat;
}

/**
 * Validates that an API key is correctly set up.
 * Throws a clear error message if the key is missing or malformed.
 */
export function validateApiKey(apiKey: string | undefined): string {
  if (!apiKey) {
    throw new Error(
      "[emergentintegrations] EMERGENT_LLM_KEY is not set. Add it to your .env file:\nEMERGENT_LLM_KEY=sk-emergent-..."
    );
  }

  if (apiKey === "your-key-here" || apiKey === "sk-...") {
    throw new Error(
      "[emergentintegrations] EMERGENT_LLM_KEY looks like a placeholder. Set your real key in .env."
    );
  }

  return apiKey;
}

/**
 * Returns the resolved proxy URL for debugging.
 * Use this to confirm routing is correct, never to set it manually.
 */
export function getProxyInfo(apiKey: string): {
  isEmergent: boolean;
  proxyUrl: string | null;
} {
  const emergent = apiKey.startsWith("sk-emergent-");
  return {
    isEmergent: emergent,
    proxyUrl: emergent ? getIntegrationProxyUrl() + "/llm" : null,
  };
}
