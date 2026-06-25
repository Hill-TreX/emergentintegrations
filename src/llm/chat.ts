/**
 * LLM integration using OpenAI SDK for flexible provider support.
 * Exact port of the Python emergentintegrations llm/chat.py module.
 */
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { getAppIdentifier, getIntegrationProxyUrl } from "./utils";

// ============================================================
// Data Classes / Interfaces
// ============================================================

/**
 * A tool the model wants the customer to execute and report back on.
 * `arguments` is the JSON-decoded dict (or {} on parse failure).
 * `raw_arguments` is the original JSON string from the model — preserved so
 * the assistant message can be round-tripped into history with byte-for-byte
 * fidelity (providers reject any drift).
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  raw_arguments: string;
}

/** Token counts for cost / observability. */
export interface Usage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

/**
 * Return type of LlmChat.sendMessageWithTools().
 * `content` is the assistant text (may be null on pure tool-call turns).
 * `tool_calls` is null when the model did not call any custom function.
 * `raw` is the full response — escape hatch for provider-specific fields.
 */
export interface ChatResponse {
  content: string | null;
  tool_calls: ToolCall[] | null;
  finish_reason: string;
  usage: Usage;
  raw: any;
}

/** A piece of assistant text. Append to your UI as it arrives. */
export interface TextDelta {
  type: "text_delta";
  content: string;
}

/** Fired once when the model begins emitting a tool call. */
export interface ToolCallStart {
  type: "tool_call_start";
  id: string;
  name: string;
  index: number;
}

/** Fired when a tool call's argument JSON is fully assembled. */
export interface ToolCallReady {
  type: "tool_call_ready";
  tool_call: ToolCall;
}

/** Fired exactly once at the end of the stream. */
export interface StreamDone {
  type: "stream_done";
  content: string | null;
  tool_calls: ToolCall[] | null;
  finish_reason: string;
  usage: Usage;
  raw: any;
}

export type ChatStreamEvent = TextDelta | ToolCallStart | ToolCallReady | StreamDone;

// ============================================================
// File Content Classes
// ============================================================

export interface FileContent {
  content_type: string;
  file_content_base64: string;
}

export class ImageContent implements FileContent {
  content_type: string = "image";
  file_content_base64: string;

  constructor(imageBase64: string) {
    this.file_content_base64 = imageBase64;
  }

  static getMimeType(fileContentBase64: string): string {
    if (fileContentBase64.startsWith("iVBORw0KGgo")) return "image/png";
    if (fileContentBase64.startsWith("/9j/")) return "image/jpeg";
    if (fileContentBase64.startsWith("R0lGOD")) return "image/gif";
    if (fileContentBase64.startsWith("UklGR")) return "image/webp";
    return "image/png"; // Default to PNG for backwards compatibility
  }
}

export class FileContentWithMimeType implements FileContent {
  content_type: string;
  file_content_base64: string;

  constructor(mimeType: string, filePath: string) {
    const fileBytes = fs.readFileSync(filePath);
    this.file_content_base64 = fileBytes.toString("base64");
    this.content_type = mimeType;
  }
}

export interface UserMessage {
  text?: string;
  file_contents?: FileContent[];
}

// ============================================================
// Error Class
// ============================================================

export class ChatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatError";
  }
}

// ============================================================
// LlmChat Class
// ============================================================

export class LlmChat {
  private apiKey: string;
  private model: string = "gpt-4o";
  private provider: string = "openai";
  private messages: any[];
  private sessionId: string;
  private extraParams: Record<string, any> = {};
  private customHeaders: Record<string, string> = {};
  private tools: any[] | null = null;
  private toolChoice: any = null;

  constructor(
    apiKey: string,
    sessionId: string,
    systemMessage: string,
    initialMessages?: any[],
    customHeaders?: Record<string, string>
  ) {
    this.apiKey = apiKey;
    this.sessionId = sessionId;
    this.messages = initialMessages || [{ role: "system", content: systemMessage }];
    this.customHeaders = customHeaders || {};

    const appUrl = getAppIdentifier();
    if (appUrl) {
      this.customHeaders["X-App-ID"] = appUrl;
    }
  }

  withModel(provider: string, model: string): this {
    this.provider = provider;
    this.model = model;
    return this;
  }

  withParams(params: Record<string, any>): this {
    Object.assign(this.extraParams, params);
    return this;
  }

  /**
   * Configure tools for subsequent sendMessageWithTools() calls.
   * Accepts both OpenAI custom function shape and provider-hosted tool dicts
   * (e.g. {"type": "web_search_20250305", "name": "web_search"} for Anthropic,
   * {"googleSearch": {}} for Gemini).
   */
  withTools(tools: any[], toolChoice?: any): this {
    this._validateTools(tools);
    this.tools = tools;
    this.toolChoice = toolChoice ?? null;
    return this;
  }

  /**
   * Append a tool-result message to history for the next sendMessageWithTools() call.
   * `toolCallId` must match an ID emitted in the most recent assistant message's tool_calls.
   */
  addToolResult(toolCallId: string, content: string): this {
    const validIds = this._lastAssistantToolCallIds();
    if (!validIds.has(toolCallId)) {
      throw new ChatError(
        `tool_call_id '${toolCallId}' does not match any pending tool call`
      );
    }
    this.messages.push({
      role: "tool",
      tool_call_id: toolCallId,
      content: content,
    });
    return this;
  }

  /**
   * Tool-aware variant of sendMessage().
   * Returns a ChatResponse exposing content, tool_calls, finish_reason, usage, and raw response.
   */
  async sendMessageWithTools(userMessage?: UserMessage): Promise<ChatResponse> {
    const messages = await this.getMessages();
    if (userMessage) {
      await this._addUserMessage(messages, userMessage);
    } else if (!messages.length || messages[messages.length - 1].role !== "tool") {
      throw new ChatError(
        "sendMessageWithTools called without a user message and no pending tool results"
      );
    }

    const client = this._buildClient();
    const params = this._buildCompletionParams(messages, true);

    try {
      const raw = await client.chat.completions.create(params);
      const response = this._parseToolResponse(raw);
      messages.push(this._assistantHistoryMessage(response.content, response.tool_calls));
      await this._saveMessages(messages);
      return response;
    } catch (e: any) {
      throw new ChatError(`Failed to generate chat completion: ${e.message}`);
    }
  }

  /**
   * Stream the assistant response. Yields TextDelta, ToolCallStart, ToolCallReady, StreamDone.
   */
  async *streamMessage(userMessage?: UserMessage): AsyncGenerator<ChatStreamEvent> {
    const messages = await this.getMessages();
    if (userMessage) {
      await this._addUserMessage(messages, userMessage);
    } else if (!messages.length || messages[messages.length - 1].role !== "tool") {
      throw new ChatError(
        "streamMessage called without a user message and no pending tool results"
      );
    }

    const client = this._buildClient();
    const params = this._buildCompletionParams(messages, true);
    params.stream = true;
    params.stream_options = { include_usage: true };

    let stream: any;
    try {
      stream = await client.chat.completions.create(params);
    } catch (e: any) {
      throw new ChatError(`Failed to start streaming completion: ${e.message}`);
    }

    const textBuf: string[] = [];
    const toolState: Map<number, { id: string | null; name: string | null; args: string[] }> = new Map();
    const started: Set<number> = new Set();
    let finishReason: string = "stop";
    let usage: Usage | null = null;
    let lastChunk: any = null;

    try {
      for await (const chunk of stream) {
        lastChunk = chunk;

        if (chunk.usage) {
          usage = this._extractUsage(chunk);
        }

        if (!chunk.choices || chunk.choices.length === 0) continue;
        const choice = chunk.choices[0];
        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }
        const delta = choice.delta;
        if (!delta) continue;

        if (delta.content) {
          textBuf.push(delta.content);
          yield { type: "text_delta", content: delta.content } as TextDelta;
        }

        if (delta.tool_calls) {
          for (const tcd of delta.tool_calls) {
            const idx = tcd.index;
            if (!toolState.has(idx)) {
              toolState.set(idx, { id: null, name: null, args: [] });
            }
            const st = toolState.get(idx)!;
            if (tcd.id) st.id = tcd.id;
            if (tcd.function?.name) st.name = tcd.function.name;
            if (tcd.function?.arguments) st.args.push(tcd.function.arguments);

            if (!started.has(idx) && st.id && st.name) {
              started.add(idx);
              yield { type: "tool_call_start", id: st.id, name: st.name, index: idx } as ToolCallStart;
            }
          }
        }
      }
    } catch (e: any) {
      throw new ChatError(`Error during streaming: ${e.message}`);
    }

    // Stream exhausted — assemble final tool_calls
    const finalTcs: ToolCall[] = [];
    const sortedIndices = Array.from(toolState.keys()).sort((a, b) => a - b);
    for (const idx of sortedIndices) {
      const st = toolState.get(idx)!;
      if (!(st.id && st.name)) continue;
      const rawArgs = st.args.join("") || "{}";
      let parsed: Record<string, any>;
      try {
        parsed = JSON.parse(rawArgs);
      } catch {
        parsed = {};
      }
      const tc: ToolCall = {
        id: st.id,
        name: st.name,
        arguments: parsed,
        raw_arguments: rawArgs,
      };
      finalTcs.push(tc);
      yield { type: "tool_call_ready", tool_call: tc } as ToolCallReady;
    }

    const fullText = textBuf.join("") || null;
    messages.push(this._assistantHistoryMessage(fullText, finalTcs.length > 0 ? finalTcs : null));
    await this._saveMessages(messages);

    yield {
      type: "stream_done",
      content: fullText,
      tool_calls: finalTcs.length > 0 ? finalTcs : null,
      finish_reason: finishReason,
      usage: usage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      raw: lastChunk,
    } as StreamDone;
  }

  /**
   * Legacy send_message — returns just the text content string.
   */
  async sendMessage(userMessage: UserMessage): Promise<string> {
    const messages = await this.getMessages();
    await this._addUserMessage(messages, userMessage);
    try {
      const client = this._buildClient();
      const params = this._buildCompletionParams(messages, false);
      const response: any = await client.chat.completions.create(params);
      const responseText = this._extractResponseText(response);
      messages.push({ role: "assistant", content: responseText });
      await this._saveMessages(messages);
      return responseText;
    } catch (e: any) {
      throw new ChatError(`Failed to generate chat completion: ${e.message}`);
    }
  }

  /**
   * Send a message and extract both text and images from the response.
   * Returns [text, images] where images is a list of {mime_type, data} objects.
   */
  async sendMessageMultimodalResponse(
    userMessage: UserMessage
  ): Promise<[string | null, Array<{ mime_type: string; data: string }>]> {
    const messages = await this.getMessages();
    await this._addUserMessage(messages, userMessage);
    try {
      const client = this._buildClient();
      const params = this._buildCompletionParams(messages, false);
      const response: any = await client.chat.completions.create(params);

      let text: string | null = null;
      const images: Array<{ mime_type: string; data: string }> = [];

      if (response.choices && response.choices.length > 0 && response.choices[0].message) {
        const message = response.choices[0].message;

        // Extract images from separate field (Gemini's format via proxy)
        if (message.images && Array.isArray(message.images)) {
          for (const imgData of message.images) {
            if (imgData.image_url && imgData.image_url.url) {
              const url = imgData.image_url.url;
              if (url.includes("data:") && url.includes(";base64,")) {
                const parts = url.split(";base64,");
                const mimeType = parts[0].replace("data:", "");
                const base64Data = parts[1];
                images.push({ mime_type: mimeType, data: base64Data });
              }
            }
          }
        }

        // Extract text from content if present
        if (message.content) {
          text = message.content;
        }
      }

      // Save assistant message if text was returned
      if (text) {
        messages.push({ role: "assistant", content: text });
        await this._saveMessages(messages);
      }

      return [text, images];
    } catch (e: any) {
      throw new ChatError(`Failed to generate multimodal completion: ${e.message}`);
    }
  }

  // ============================================================
  // Private Methods
  // ============================================================

  private _isEmergentKey(apiKey: string): boolean {
    return apiKey.startsWith("sk-emergent-");
  }

  private _buildClient(): OpenAI {
    const opts: any = { apiKey: this.apiKey };
    if (this._isEmergentKey(this.apiKey)) {
      opts.baseURL = `${getIntegrationProxyUrl()}/llm`;
      if (Object.keys(this.customHeaders).length > 0) {
        opts.defaultHeaders = this.customHeaders;
      }
    }
    return new OpenAI(opts);
  }

  private _buildCompletionParams(messages: any[], includeTools: boolean): any {
    let model: string;
    if (this._isEmergentKey(this.apiKey)) {
      // With emergent key: gemini gets prefix, everything else is raw model name
      model = this.provider === "gemini" ? `gemini/${this.model}` : this.model;
    } else {
      // Without emergent key: use provider/model format (LiteLLM style)
      model = `${this.provider}/${this.model}`;
    }

    const params: any = { model, messages };
    if (includeTools && this.tools) {
      params.tools = this.tools;
      if (this.toolChoice !== null) {
        params.tool_choice = this.toolChoice;
      }
    }
    Object.assign(params, this.extraParams);
    return params;
  }

  private _parseToolResponse(raw: any): ChatResponse {
    const choice = raw.choices[0];
    const message = choice.message;
    const content = message.content || null;
    const finishReason = choice.finish_reason || "stop";
    const rawToolCalls = message.tool_calls || null;

    const parsedToolCalls = rawToolCalls
      ? rawToolCalls.map((tc: any) => this._parseToolCall(tc))
      : null;

    return {
      content,
      tool_calls: parsedToolCalls,
      finish_reason: finishReason,
      usage: this._extractUsage(raw),
      raw,
    };
  }

  private _parseToolCall(tc: any): ToolCall {
    const rawArgs = tc.function.arguments || "{}";
    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(rawArgs);
    } catch {
      parsed = {};
    }
    return {
      id: tc.id,
      name: tc.function.name,
      arguments: parsed,
      raw_arguments: rawArgs,
    };
  }

  private _extractUsage(raw: any): Usage {
    const u = raw.usage;
    if (!u) return { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
    const inputTokens = u.prompt_tokens ?? u.input_tokens ?? 0;
    const outputTokens = u.completion_tokens ?? u.output_tokens ?? 0;
    const totalTokens = u.total_tokens ?? inputTokens + outputTokens;
    return { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: totalTokens };
  }

  private _extractResponseText(response: any): string {
    if (response.choices && response.choices.length > 0 && response.choices[0].message) {
      return response.choices[0].message.content;
    }
    throw new ChatError("Failed to extract response text");
  }

  private async _addUserMessage(messages: any[], message: UserMessage): Promise<void> {
    const fileContents = message.file_contents || [];

    // Check if file contents are being used with non-Gemini provider
    if (fileContents.some((content) => content instanceof FileContentWithMimeType)) {
      if (this.provider !== "gemini") {
        throw new ChatError("File attachments are only supported with Gemini provider");
      }
    }

    if (message.text) {
      messages.push({ role: "user", content: [{ type: "text", text: message.text }] });
    }

    for (const content of fileContents) {
      if (content.content_type === "image") {
        const mimeType = ImageContent.getMimeType(content.file_content_base64);
        messages.push({
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${content.file_content_base64}`,
              },
            },
          ],
        });
      } else {
        messages.push({
          role: "user",
          content: [
            {
              type: "file",
              file: {
                file_data: `data:${content.content_type};base64,${content.file_content_base64}`,
              },
            },
          ],
        });
      }
    }
    await this._saveMessages(messages);
  }

  private _assistantHistoryMessage(
    content: string | null,
    toolCalls: ToolCall[] | null
  ): any {
    const message: any = { role: "assistant", content };
    if (toolCalls) {
      message.tool_calls = toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: tc.raw_arguments },
      }));
    }
    return message;
  }

  private _validateTools(tools: any[]): void {
    if (!Array.isArray(tools) || tools.length === 0) {
      throw new ChatError("withTools requires a non-empty list of tool definitions");
    }
    tools.forEach((tool, i) => {
      if (typeof tool !== "object" || tool === null || Object.keys(tool).length === 0) {
        throw new ChatError(`withTools: tool at index ${i} must be a non-empty dict`);
      }
      if (tool.type === "function") {
        if (!tool.function || !tool.function.name) {
          throw new ChatError(
            `withTools: function tool at index ${i} must have a 'function' dict with a 'name'`
          );
        }
      }
    });
  }

  private _lastAssistantToolCallIds(): Set<string> {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === "assistant") {
        const tcs = this.messages[i].tool_calls || [];
        return new Set(tcs.map((tc: any) => tc.id).filter(Boolean));
      }
    }
    return new Set();
  }

  async getMessages(): Promise<any[]> {
    return this.messages;
  }

  private async _saveMessages(messages: any[]): Promise<void> {
    this.messages = messages;
  }
}
