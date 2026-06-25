/**
 * Async LLM chat client built on the OpenAI SDK.
 *
 * Routes to the Emergent integration proxy when the API key begins with
 * "sk-emergent-"; otherwise talks to OpenAI (or any OpenAI-compatible
 * endpoint supplied via base_url) directly.
 *
 * Mirrors: src/emergentintegrations/llm/chat.py exactly.
 */

import fs from "fs";
import path from "path";
import OpenAI from "openai";
import {
  getAppIdentifier,
  getIntegrationProxyUrl,
  isEmergentKey,
} from "../_proxy.js";

// ─── Errors ───────────────────────────────────────────────────────────────────

/**
 * Raised for any failure in the chat flow.
 * Mirrors: class ChatError(Exception)
 */
export class ChatError extends Error {
  constructor(message) {
    super(message);
    this.name = "ChatError";
  }
}

// ─── File / Image content ─────────────────────────────────────────────────────

/**
 * Base class for file attachments.
 * Mirrors: class FileContent
 */
export class FileContent {
  /**
   * @param {string} contentType          - e.g. "image", "image/png", "application/pdf"
   * @param {string} fileContentBase64    - Raw base64 encoded content
   */
  constructor(contentType, fileContentBase64) {
    this.content_type = contentType;
    this.file_content_base64 = fileContentBase64;
  }
}

// Image MIME signatures — same order as Python
const _IMAGE_MIME_SIGNATURES = [
  ["iVBORw0KGgo", "image/png"],
  ["/9j/", "image/jpeg"],
  ["R0lGOD", "image/gif"],
  ["UklGR", "image/webp"],
];

/**
 * Image content built from a base64 string.
 * Mirrors: class ImageContent(FileContent)
 */
export class ImageContent extends FileContent {
  /**
   * @param {string} imageBase64 - Raw base64 image data
   */
  constructor(imageBase64) {
    super("image", imageBase64);
  }

  /**
   * Infer mime type from base64 prefix.
   * Mirrors: @staticmethod get_mime_type()
   * @param {string} fileContentBase64
   * @returns {string}
   */
  static getMimeType(fileContentBase64) {
    for (const [prefix, mime] of _IMAGE_MIME_SIGNATURES) {
      if (fileContentBase64.startsWith(prefix)) return mime;
    }
    return "image/png"; // default fallback matches Python
  }
}

/**
 * File content with an explicit mime type, read from disk.
 * Mirrors: class FileContentWithMimeType(FileContent)
 */
export class FileContentWithMimeType extends FileContent {
  /**
   * @param {string} mimeType  - e.g. "image/png", "application/pdf"
   * @param {string} filePath  - Path to the file on disk
   */
  constructor(mimeType, filePath) {
    const data = fs.readFileSync(path.resolve(filePath));
    super(mimeType, data.toString("base64"));
  }
}

// ─── UserMessage ─────────────────────────────────────────────────────────────

/**
 * A user message with optional file attachments.
 * Mirrors: class UserMessage
 *
 * @example
 * new UserMessage({ text: "Hello" })
 * new UserMessage({ text: "What's this?", file_contents: [new ImageContent(b64)] })
 */
export class UserMessage {
  /**
   * @param {object} [options]
   * @param {string|null} [options.text]
   * @param {FileContent[]} [options.file_contents]
   */
  constructor({ text = null, file_contents = null } = {}) {
    this.text = text;
    this.file_contents = Array.from(file_contents || []);
  }
}

// ─── LlmChat ─────────────────────────────────────────────────────────────────

/**
 * Stateful async chat session.
 *
 * The conversation history is kept in-memory on the instance (this.messages).
 * Callers that need persistence should serialise messages themselves.
 *
 * Mirrors: class LlmChat exactly.
 *
 * @example
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
   * @param {string}   options.sessionId       - Session identifier
   * @param {string}   options.systemMessage   - System prompt (positional in Python)
   * @param {object[]|null} [options.initialMessages] - Seed history (replaces system msg if provided)
   * @param {object|null}   [options.customHeaders]   - Extra HTTP headers
   * @param {string|null}   [options.baseUrl]         - Override base URL entirely
   */
  constructor({
    apiKey,
    sessionId,
    systemMessage,
    initialMessages = null,
    customHeaders = null,
    baseUrl = null,
  }) {
    if (!apiKey) throw new Error("[LlmChat] apiKey is required");
    if (!sessionId) throw new Error("[LlmChat] sessionId is required");

    this.api_key = apiKey;
    this.session_id = sessionId;
    this.model = "gpt-4o";                          // default matches Python
    this.extra_params = {};
    this.custom_headers = Object.assign({}, customHeaders || {});

    // messages[] starts with system message unless initial_messages provided
    // Mirrors Python: list(initial_messages or [{"role": "system", "content": system_message}])
    if (initialMessages && initialMessages.length > 0) {
      this.messages = [...initialMessages];
    } else {
      this.messages = [{ role: "system", content: systemMessage }];
    }

    // X-App-ID header — set only if not already in custom_headers
    const appId = getAppIdentifier();
    if (appId && !Object.prototype.hasOwnProperty.call(this.custom_headers, "X-App-ID")) {
      this.custom_headers["X-App-ID"] = appId;
    }

    // Base URL resolution — mirrors Python _proxy logic exactly
    if (baseUrl !== null) {
      this._base_url = baseUrl;
    } else if (isEmergentKey(apiKey)) {
      this._base_url = `${getIntegrationProxyUrl().replace(/\/$/, "")}/llm`;
    } else {
      this._base_url = null;
    }
  }

  // ─── Builder methods (chainable) ────────────────────────────────────────────

  /**
   * Set the target model. Chainable.
   * provider is accepted for backwards compatibility only — dispatching
   * happens at the proxy or via base_url.
   * Mirrors: def with_model(self, provider, model)
   *
   * @param {string} provider - "openai" | "anthropic" | "google" etc. (ignored, proxy handles it)
   * @param {string} model    - Model name e.g. "gpt-4o", "claude-sonnet-4-6"
   * @returns {LlmChat}
   */
  withModel(provider, model) {
    void provider; // intentionally unused — matches Python: del provider
    this.model = model;
    return this;
  }

  /**
   * Set extra parameters forwarded to chat.completions.create. Chainable.
   * Mirrors: def with_params(self, **params)
   *
   * @param {object} params - e.g. { temperature: 0.3, max_tokens: 512 }
   * @returns {LlmChat}
   */
  withParams(params) {
    Object.assign(this.extra_params, params);
    return this;
  }

  // ─── History ─────────────────────────────────────────────────────────────────

  /**
   * Returns the current message history.
   * Mirrors: async def get_messages(self)
   * @returns {Promise<object[]>}
   */
  async getMessages() {
    return this.messages;
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  /**
   * Build a fresh OpenAI client per call.
   * Mirrors: def _client(self) -> AsyncOpenAI
   */
  _client() {
    const kwargs = { apiKey: this.api_key };
    if (this._base_url) kwargs.baseURL = this._base_url;
    if (Object.keys(this.custom_headers).length > 0) {
      kwargs.defaultHeaders = this.custom_headers;
    }
    return new OpenAI(kwargs);
  }

  /**
   * Convert a UserMessage into the OpenAI messages array format.
   * Mirrors: def _build_user_turn(self, message)
   * Raises ChatError if message has neither text nor file_contents.
   *
   * @param {UserMessage} message
   * @returns {object[]}
   */
  _buildUserTurn(message) {
    const parts = [];

    if (message.text) {
      parts.push({ type: "text", text: message.text });
    }

    for (const content of message.file_contents) {
      if (content.content_type === "image") {
        const mime = ImageContent.getMimeType(content.file_content_base64);
        parts.push({
          type: "image_url",
          image_url: {
            url: `data:${mime};base64,${content.file_content_base64}`,
          },
        });
      } else {
        // FileContentWithMimeType or other
        const dataUrl = `data:${content.content_type};base64,${content.file_content_base64}`;
        parts.push({ type: "image_url", image_url: { url: dataUrl } });
      }
    }

    if (parts.length === 0) {
      throw new ChatError("UserMessage must contain text or at least one file");
    }

    return [{ role: "user", content: parts }];
  }

  // ─── Public send methods ─────────────────────────────────────────────────────

  /**
   * Send a message and return assistant text.
   * Conversation history (this.messages) is updated automatically.
   * Mirrors: async def send_message(self, user_message)
   *
   * @param {UserMessage} userMessage
   * @returns {Promise<string>}
   * @throws {ChatError}
   */
  async sendMessage(userMessage) {
    // Extend messages BEFORE the API call — matches Python exactly
    this.messages.push(...this._buildUserTurn(userMessage));

    let response;
    try {
      response = await this._client().chat.completions.create({
        model: this.model,
        messages: this.messages,
        ...this.extra_params,
      });
    } catch (exc) {
      throw new ChatError(`Failed to generate chat completion: ${exc.message}`);
    }

    let text;
    try {
      text = response.choices[0].message.content || "";
    } catch (exc) {
      throw new ChatError(`Malformed completion response: ${exc.message}`);
    }

    this.messages.push({ role: "assistant", content: text });
    return text;
  }

  /**
   * Send a message and return [text, images].
   * images is a list of { mime_type, data } when the upstream response
   * carries generated images (e.g. Gemini via Emergent proxy).
   * For plain OpenAI completions, images is always [].
   * Mirrors: async def send_message_multimodal_response(self, user_message)
   *
   * @param {UserMessage} userMessage
   * @returns {Promise<[string|null, Array<{mime_type: string, data: string}>]>}
   * @throws {ChatError}
   */
  async sendMessageMultimodalResponse(userMessage) {
    this.messages.push(...this._buildUserTurn(userMessage));

    let response;
    try {
      response = await this._client().chat.completions.create({
        model: this.model,
        messages: this.messages,
        ...this.extra_params,
      });
    } catch (exc) {
      throw new ChatError(`Failed to generate multimodal completion: ${exc.message}`);
    }

    const message = response.choices[0].message;
    const text = message.content || null;
    const images = [];

    const rawImages = message.images || null;
    if (rawImages) {
      for (const item of rawImages) {
        const url =
          typeof item === "object" && item.image_url
            ? item.image_url.url
            : null;
        if (!url || !url.includes(";base64,")) continue;
        const [header, data] = url.split(";base64,");
        const mime = header.replace("data:", "") || "image/png";
        images.push({ mime_type: mime, data });
      }
    }

    if (text) {
      this.messages.push({ role: "assistant", content: text });
    }

    return [text, images];
  }

  /**
   * Stream a response. Yields string chunks as they arrive.
   * History is updated after stream completes.
   * (Streaming not in Python package — Node bonus feature)
   *
   * @param {UserMessage} userMessage
   * @returns {AsyncGenerator<string>}
   * @throws {ChatError}
   */
  async *stream(userMessage) {
    this.messages.push(...this._buildUserTurn(userMessage));

    let streamObj;
    try {
      streamObj = await this._client().chat.completions.create({
        model: this.model,
        messages: this.messages,
        stream: true,
        ...this.extra_params,
      });
    } catch (exc) {
      throw new ChatError(`Failed to start stream: ${exc.message}`);
    }

    let fullText = "";
    for await (const chunk of streamObj) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        yield delta;
      }
    }

    this.messages.push({ role: "assistant", content: fullText });
  }
}
