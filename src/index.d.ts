/**
 * emergentintegrations - TypeScript definitions
 */

export interface LlmChatOptions {
  /** Your API key (EMERGENT_LLM_KEY or provider key) */
  apiKey: string;
  /** Model name e.g. "claude-sonnet-4-6", "gpt-4o", "gemini-1.5-pro" */
  model: string;
  /** Optional system prompt */
  systemMessage?: string;
  /** Optional custom base URL override (e.g. Emergent proxy) */
  baseUrl?: string;
  /** Default params applied to every request: temperature, max_tokens, etc. */
  defaultParams?: Record<string, unknown>;
  /** Optional seed history */
  history?: Array<UserMessage | AssistantMessage>;
}

export interface MessageLike {
  role: "user" | "assistant" | "system";
  content: string;
}

export declare class UserMessage implements MessageLike {
  role: "user";
  content: string;
  constructor(content: string);
}

export declare class AssistantMessage implements MessageLike {
  role: "assistant";
  content: string;
  constructor(content: string);
}

export declare class SystemMessage implements MessageLike {
  role: "system";
  content: string;
  constructor(content: string);
}

export declare class LlmChat {
  readonly model: string;
  readonly provider: "anthropic" | "openai" | "google";
  readonly history: Array<UserMessage | AssistantMessage>;

  constructor(options: LlmChatOptions);

  /**
   * Send a message and receive the full response string.
   * Conversation history is maintained automatically.
   */
  chat(
    input: string | UserMessage | Array<UserMessage | AssistantMessage>,
    params?: Record<string, unknown>
  ): Promise<string>;

  /**
   * Alias for chat(). Mirrors the Python package's .send() method.
   */
  send(
    input: string | UserMessage | Array<UserMessage | AssistantMessage>,
    params?: Record<string, unknown>
  ): Promise<string>;

  /**
   * Stream a response. Yields string chunks as they arrive.
   */
  stream(
    input: string | UserMessage | Array<UserMessage | AssistantMessage>,
    params?: Record<string, unknown>
  ): AsyncGenerator<string>;

  /**
   * Clear conversation history.
   */
  clearHistory(): void;

  /**
   * Get current conversation history as plain objects.
   */
  getHistory(): Array<{ role: string; content: string }>;
}
