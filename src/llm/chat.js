/**
 * emergentintegrations - Node.js
 * Mirrors the Python emergentintegrations package API exactly.
 *
 * Architecture: Everything routes through the OpenAI SDK.
 * - sk-emergent-* keys → Emergent proxy (handles Anthropic, Google, OpenAI)
 * - Any other key      → Direct OpenAI-compatible endpoint
 */

import OpenAI from "openai";
import fs from "fs";
import path from "path";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PROXY_URL = "https://integrations.emergentagent.com/llm";

// ─── Content types ────────────────────────────────────────────────────────────

/**
 * Image content built from a base64 string.
 * Infers mime type from the base64 header (PNG/JPEG/GIF/WEBP).
 */
export class ImageContent {
  /**
   * @param {string} imageBase64 - Raw base64 string (with or without data URI prefix)
   */
  constructor(imageBase64) {
    this.imageBase64 = imageBase64;
    this.mimeType = ImageContent._inferMimeType(imageBase64);
  }

  static _inferMimeType(b64) {
    if (b64.startsWith("/9j/")) return "image/jpeg";
    if (b64.startsWith("iVBORw0KGgo")) return "image/png";
    if (b64.startsWith("R0lGOD")) return "image/gif";
    if (b64.startsWith("UklGR")) return "image/webp";
    // data URI prefix
    const match = b64.match(/^data:(image\/[a-z]+);base64,/);
    if (match) return match[1];
    return "image/jpeg"; // fallback
  }

  /** Strip data URI prefix if present and return raw base64 */
  get rawBase64() {
    return this.imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
  }
}

/**
 * File content with an explicit mime type, read from disk.
 */
export class FileContentWithMimeType {
  /**
   * @param {string} mimeType - e.g. "image/png", "application/pdf"
   * @param {string} filePath - Absolute or relative path to file
   */
  constructor(mimeType, filePath) {
    this.mimeType = mimeType;
    this.filePath = filePath;
    const data = fs.readFileSync(path.resolve(filePath));
    this.base64 = data.toString("base64");
  }
}

/**
 * A user message, optionally with file/image attachments.
 *
 * @example
 * new UserMessage({ text: "What's in this image?", fileContents: [new ImageContent(base64)] })
 * new UserMessage({ text: "Hello" })
 * new UserMessage("Hello")   // shorthand string
 */
export class UserMessage {
  /**
   * @param {string|object} options
   * @param {string} [options.text]
   * @param {Array<ImageContent|FileContentWithMimeType>} [options.fileContents]
   */
  constructor(options) {
    if (typeof options === "string") {
      this.text = options;
      this.fileContents = [];
    } else {
      this.text = options.text ?? null;
      this.fileContents = options.fileContents ?? [];
    }
    this.role = "user";
  }

  /** Convert to OpenAI message format */
  toOpenAIMessage() {
    if (!this.fileContents || this.fileContents.length === 0) {
      return { role: "user", content: this.text ?? "" };
    }

    const content = [];

    if (this.text) {
      content.push({ type: "text", text: this.text });
    }

    for (const fc of this.fileContents) {
      const b64 = fc instanceof ImageContent ? fc.rawBase64 : fc.base64;
      const mime = fc.mimeType;
      content.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${b64}` },
      });
    }

    return { role: "user", content };
  }
}

// ─── LlmChat ─────────────────────────────────────────────────────────────────

/**
 * Unified async LLM chat client.
 * Mirrors the Python emergentintegrations LlmChat class exactly.
 *
 * @example
 * import { LlmChat, UserMessage, ImageContent } from "emergentintegrations";
 *
 * const chat = new LlmChat({
 *   apiKey: "sk-emergent-...",
 *   sessionId: "abc-123",
 *   systemMessage: "You are a concise assistant.",
 * })
 *   .withModel("openai", "gpt-4o-mini")
 *   .withParams({ temperature: 0.3 });
 *
 * const reply = await chat.sendMessage(new UserMessage({ text: "Hello!" }));
 */
export class LlmChat {
  /**
   * @param {object} options
   * @param {string}   options.apiKey          - Provider key or sk-emergent-* for proxy
   * @param {string}   options.sessionId       - Session identifier for conversation tracking
   * @param {string}   [options.systemMessage] - System prompt
   * @param {Array}    [options.initialMessages] - Seed conversation history
   * @param {object}   [options.customHeaders] - Extra HTTP headers
   * @param {string}   [options.baseUrl]       - Override base URL entirely
   */
  constructor({
    apiKey,
    sessionId,
    systemMessage = null,
    initialMessages = null,
    customHeaders = null,
    baseUrl = null,
  }) {
    if (!apiKey) throw new Error("[LlmChat] apiKey is required");
    if (!sessionId) throw new Error("[LlmChat] sessionId is required");

    this.apiKey = apiKey;
    this.sessionId = sessionId;
    this.systemMessage = systemMessage;
    this.customHeaders = customHeaders ?? {};
    this._model = "gpt-4o-mini";
    this._extraParams = {};
    this._history = [];

    // Seed history
    if (initialMessages) {
      for (const m of initialMessages) {
        this._history.push(m);
      }
    }

    // Routing: sk-emergent-* keys go to the Emergent proxy
    const isEmergentKey = apiKey.startsWith("sk-emergent-");

    let resolvedBaseUrl = baseUrl;

    if (!resolvedBaseUrl) {
      if (isEmergentKey) {
        const proxyBase =
          process.env.INTEGRATION_PROXY_URL ?? DEFAULT_PROXY_URL;
        resolvedBaseUrl = proxyBase;
      }
      // Otherwise: no baseUrl = standard OpenAI API
    }

    // Build headers
    const headers = { ...this.customHeaders };

    // X-App-ID for proxy attribution
    const appUrl =
      process.env.APP_URL ?? process.env.REACT_APP_BACKEND_URL ?? null;
    if (appUrl) {
      headers["X-App-ID"] = appUrl;
    }

    this._client = new OpenAI({
      apiKey,
      ...(resolvedBaseUrl ? { baseURL: resolvedBaseUrl } : {}),
      defaultHeaders: Object.keys(headers).length > 0 ? headers : undefined,
    });
  }

  // ─── Builder methods ────────────────────────────────────────────────────────

  /**
   * Set the target model. Chainable.
   * @param {string} provider - "openai" | "anthropic" | "google" | etc.
   * @param {string} model    - Model name e.g. "gpt-4o-mini", "claude-sonnet-4-6"
   * @returns {LlmChat}
   */
  withModel(provider, model) {
    this._provider = provider;
    this._model = model;
    return this;
  }

  /**
   * Set extra parameters forwarded to chat.completions.create. Chainable.
   * @param {object} params - e.g. { temperature: 0.3, max_tokens: 1000 }
   * @returns {LlmChat}
   */
  withParams(params) {
    this._extraParams = { ...this._extraParams, ...params };
    return this;
  }

  // ─── Core send methods ───────────────────────────────────────────────────────

  /**
   * Send a message and get assistant text back.
   * Conversation history is maintained automatically.
   *
   * @param {UserMessage} userMessage
   * @returns {Promise<string>}
   */
  async sendMessage(userMessage) {
    const messages = this._buildMessages(userMessage);

    const response = await this._client.chat.completions.create({
      model: this._model,
      messages,
      ...this._extraParams,
    });

    const assistantText = response.choices[0].message.content;

    // Update history
    this._history.push(userMessage.toOpenAIMessage());
    this._history.push({ role: "assistant", content: assistantText });

    return assistantText;
  }

  /**
   * Send a message and get both text and any generated images back.
   * Used when upstream response (e.g. Gemini via proxy) carries image data.
   *
   * @param {UserMessage} userMessage
   * @returns {Promise<[string, Array<{mimeType: string, data: string}>]>}
   */
  async sendMessageMultimodalResponse(userMessage) {
    const messages = this._buildMessages(userMessage);

    const response = await this._client.chat.completions.create({
      model: this._model,
      messages,
      ...this._extraParams,
    });

    const choice = response.choices[0];
    const assistantText = choice.message.content ?? "";

    // Extract any generated images from the response
    const images = [];
    if (choice.message.content_parts) {
      for (const part of choice.message.content_parts) {
        if (part.type === "image_url" && part.image_url?.url) {
          const url = part.image_url.url;
          const match = url.match(/^data:(image\/[a-z]+);base64,(.+)$/);
          if (match) {
            images.push({ mimeType: match[1], data: match[2] });
          }
        }
      }
    }

    // Update history
    this._history.push(userMessage.toOpenAIMessage());
    this._history.push({ role: "assistant", content: assistantText });

    return [assistantText, images];
  }

  /**
   * Stream a response. Yields string chunks as they arrive.
   *
   * @param {UserMessage} userMessage
   * @returns {AsyncGenerator<string>}
   */
  async *stream(userMessage) {
    const messages = this._buildMessages(userMessage);

    const stream = await this._client.chat.completions.create({
      model: this._model,
      messages,
      stream: true,
      ...this._extraParams,
    });

    let fullText = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        yield delta;
      }
    }

    this._history.push(userMessage.toOpenAIMessage());
    this._history.push({ role: "assistant", content: fullText });
  }

  // ─── History helpers ─────────────────────────────────────────────────────────

  /** Get session history as plain objects */
  get sessionHistory() {
    return [...this._history];
  }

  /** Clear session history */
  clearHistory() {
    this._history = [];
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  _buildMessages(userMessage) {
    const messages = [];

    if (this.systemMessage) {
      messages.push({ role: "system", content: this.systemMessage });
    }

    for (const h of this._history) {
      messages.push(h);
    }

    messages.push(userMessage.toOpenAIMessage());
    return messages;
  }
}
