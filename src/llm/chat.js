/**
 * emergentintegrations - Node.js replica of the Python emergentintegrations package
 * LlmChat: Unified LLM client supporting OpenAI, Anthropic, and Google via a single key
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Message Types ────────────────────────────────────────────────────────────

export class UserMessage {
  constructor(content) {
    this.role = "user";
    this.content = content;
  }
}

export class AssistantMessage {
  constructor(content) {
    this.role = "assistant";
    this.content = content;
  }
}

export class SystemMessage {
  constructor(content) {
    this.role = "system";
    this.content = content;
  }
}

// ─── Provider Detection ───────────────────────────────────────────────────────

const ANTHROPIC_MODELS = [
  "claude",
];

const OPENAI_MODELS = [
  "gpt",
  "o1",
  "o3",
  "o4",
  "chatgpt",
  "text-embedding",
  "dall-e",
];

const GOOGLE_MODELS = [
  "gemini",
  "palm",
  "bison",
];

function detectProvider(model) {
  const m = model.toLowerCase();

  if (ANTHROPIC_MODELS.some((prefix) => m.startsWith(prefix))) {
    return "anthropic";
  }
  if (OPENAI_MODELS.some((prefix) => m.startsWith(prefix))) {
    return "openai";
  }
  if (GOOGLE_MODELS.some((prefix) => m.startsWith(prefix))) {
    return "google";
  }

  // fallback: if using emergent proxy base URL, treat as openai-compatible
  return "openai";
}

// ─── LlmChat ─────────────────────────────────────────────────────────────────

/**
 * Unified LLM chat client. Mirrors the Python emergentintegrations LlmChat class.
 *
 * @example
 * import { LlmChat, UserMessage } from "emergentintegrations/llm";
 *
 * const chat = new LlmChat({
 *   apiKey: process.env.EMERGENT_LLM_KEY,
 *   model: "claude-sonnet-4-6",
 *   systemMessage: "You are a helpful assistant",
 * });
 *
 * const response = await chat.chat("Hello!");
 * console.log(response); // string
 */
export class LlmChat {
  /**
   * @param {object} options
   * @param {string} options.apiKey           - Your API key (EMERGENT_LLM_KEY or provider key)
   * @param {string} options.model            - Model name e.g. "claude-sonnet-4-6", "gpt-4o", "gemini-1.5-pro"
   * @param {string} [options.systemMessage]  - Optional system prompt
   * @param {string} [options.baseUrl]        - Optional custom base URL (e.g. Emergent proxy)
   * @param {object} [options.defaultParams]  - Optional default params: { temperature, max_tokens, ... }
   * @param {Array}  [options.history]        - Optional initial conversation history
   */
  constructor({
    apiKey,
    model,
    systemMessage = null,
    baseUrl = null,
    defaultParams = {},
    history = [],
  }) {
    if (!apiKey) throw new Error("[LlmChat] apiKey is required");
    if (!model) throw new Error("[LlmChat] model is required");

    this.apiKey = apiKey;
    this.model = model;
    this.systemMessage = systemMessage;
    this.baseUrl = baseUrl;
    this.defaultParams = defaultParams;
    this.history = [...history];
    this.provider = detectProvider(model);

    this._initClient();
  }

  _initClient() {
    const opts = { apiKey: this.apiKey };

    if (this.baseUrl) {
      // Emergent proxy or any custom endpoint
      opts.baseURL = this.baseUrl;
    }

    switch (this.provider) {
      case "anthropic":
        this._client = new Anthropic(opts);
        break;

      case "openai":
        this._client = new OpenAI(opts);
        break;

      case "google":
        // Google SDK doesn't use baseURL in the same way
        this._client = new GoogleGenerativeAI(this.apiKey);
        break;

      default:
        throw new Error(`[LlmChat] Unknown provider for model: ${this.model}`);
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Send a message and get a response string back.
   * Maintains conversation history automatically.
   *
   * @param {string|UserMessage|Array} input - Message string, UserMessage, or array of messages
   * @param {object} [params]                - Override params for this call only
   * @returns {Promise<string>}
   */
  async chat(input, params = {}) {
    const messages = this._normalizeInput(input);
    const mergedParams = { ...this.defaultParams, ...params };

    let response;

    switch (this.provider) {
      case "anthropic":
        response = await this._chatAnthropic(messages, mergedParams);
        break;
      case "openai":
        response = await this._chatOpenAI(messages, mergedParams);
        break;
      case "google":
        response = await this._chatGoogle(messages, mergedParams);
        break;
    }

    // Update history
    this.history.push(...messages);
    this.history.push(new AssistantMessage(response));

    return response;
  }

  /**
   * Alias for chat() — matches Python's send() method name.
   */
  async send(input, params = {}) {
    return this.chat(input, params);
  }

  /**
   * Stream a response. Yields string chunks as they arrive.
   *
   * @param {string|UserMessage|Array} input
   * @param {object} [params]
   * @returns {AsyncGenerator<string>}
   */
  async *stream(input, params = {}) {
    const messages = this._normalizeInput(input);
    const mergedParams = { ...this.defaultParams, ...params };
    let fullText = "";

    switch (this.provider) {
      case "anthropic":
        for await (const chunk of this._streamAnthropic(messages, mergedParams)) {
          fullText += chunk;
          yield chunk;
        }
        break;

      case "openai":
        for await (const chunk of this._streamOpenAI(messages, mergedParams)) {
          fullText += chunk;
          yield chunk;
        }
        break;

      case "google":
        for await (const chunk of this._streamGoogle(messages, mergedParams)) {
          fullText += chunk;
          yield chunk;
        }
        break;
    }

    this.history.push(...messages);
    this.history.push(new AssistantMessage(fullText));
  }

  /**
   * Clear conversation history.
   */
  clearHistory() {
    this.history = [];
  }

  /**
   * Get current history as plain objects.
   */
  getHistory() {
    return this.history.map((m) => ({ role: m.role, content: m.content }));
  }

  // ─── Internal: message normalization ────────────────────────────────────────

  _normalizeInput(input) {
    if (typeof input === "string") {
      return [new UserMessage(input)];
    }
    if (input instanceof UserMessage || input instanceof AssistantMessage) {
      return [input];
    }
    if (Array.isArray(input)) {
      return input.map((m) => {
        if (typeof m === "string") return new UserMessage(m);
        return m;
      });
    }
    throw new Error("[LlmChat] Invalid input type");
  }

  _buildMessageHistory(newMessages) {
    return [
      ...this.history.map((m) => ({ role: m.role, content: m.content })),
      ...newMessages.map((m) => ({ role: m.role, content: m.content })),
    ];
  }

  // ─── Internal: Anthropic ─────────────────────────────────────────────────────

  async _chatAnthropic(messages, params) {
    const { max_tokens = 4096, ...rest } = params;

    const res = await this._client.messages.create({
      model: this.model,
      max_tokens,
      ...(this.systemMessage ? { system: this.systemMessage } : {}),
      messages: this._buildMessageHistory(messages),
      ...rest,
    });

    return res.content[0].text;
  }

  async *_streamAnthropic(messages, params) {
    const { max_tokens = 4096, ...rest } = params;

    const stream = this._client.messages.stream({
      model: this.model,
      max_tokens,
      ...(this.systemMessage ? { system: this.systemMessage } : {}),
      messages: this._buildMessageHistory(messages),
      ...rest,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta?.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }

  // ─── Internal: OpenAI ────────────────────────────────────────────────────────

  _buildOpenAIMessages(messages) {
    const all = [];

    if (this.systemMessage) {
      all.push({ role: "system", content: this.systemMessage });
    }

    for (const m of this.history) {
      all.push({ role: m.role, content: m.content });
    }

    for (const m of messages) {
      all.push({ role: m.role, content: m.content });
    }

    return all;
  }

  async _chatOpenAI(messages, params) {
    const { max_tokens, ...rest } = params;

    const res = await this._client.chat.completions.create({
      model: this.model,
      messages: this._buildOpenAIMessages(messages),
      ...(max_tokens ? { max_tokens } : {}),
      ...rest,
    });

    return res.choices[0].message.content;
  }

  async *_streamOpenAI(messages, params) {
    const { max_tokens, ...rest } = params;

    const stream = await this._client.chat.completions.create({
      model: this.model,
      messages: this._buildOpenAIMessages(messages),
      ...(max_tokens ? { max_tokens } : {}),
      stream: true,
      ...rest,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  // ─── Internal: Google ────────────────────────────────────────────────────────

  _buildGoogleHistory(messages) {
    const all = [];

    for (const m of this.history) {
      all.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
    }

    // All except the last message go into history
    const allNew = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    return { history: all.concat(allNew.slice(0, -1)), lastMessage: allNew[allNew.length - 1] };
  }

  async _chatGoogle(messages, params) {
    const model = this._client.getGenerativeModel({
      model: this.model,
      ...(this.systemMessage
        ? { systemInstruction: { parts: [{ text: this.systemMessage }] } }
        : {}),
    });

    const { history, lastMessage } = this._buildGoogleHistory(messages);

    const chatSession = model.startChat({ history });
    const result = await chatSession.sendMessage(lastMessage.parts[0].text);

    return result.response.text();
  }

  async *_streamGoogle(messages, params) {
    const model = this._client.getGenerativeModel({
      model: this.model,
      ...(this.systemMessage
        ? { systemInstruction: { parts: [{ text: this.systemMessage }] } }
        : {}),
    });

    const { history, lastMessage } = this._buildGoogleHistory(messages);

    const chatSession = model.startChat({ history });
    const result = await chatSession.sendMessageStream(
      lastMessage.parts[0].text
    );

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }
}
