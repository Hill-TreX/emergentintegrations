"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmChat = exports.ChatError = exports.FileContentWithMimeType = exports.ImageContent = void 0;
/**
 * LLM integration using OpenAI SDK for flexible provider support.
 * Exact port of the Python emergentintegrations llm/chat.py module.
 */
const openai_1 = __importDefault(require("openai"));
const fs = __importStar(require("fs"));
const utils_1 = require("./utils");
class ImageContent {
    constructor(imageBase64) {
        this.content_type = "image";
        this.file_content_base64 = imageBase64;
    }
    static getMimeType(fileContentBase64) {
        if (fileContentBase64.startsWith("iVBORw0KGgo"))
            return "image/png";
        if (fileContentBase64.startsWith("/9j/"))
            return "image/jpeg";
        if (fileContentBase64.startsWith("R0lGOD"))
            return "image/gif";
        if (fileContentBase64.startsWith("UklGR"))
            return "image/webp";
        return "image/png"; // Default to PNG for backwards compatibility
    }
}
exports.ImageContent = ImageContent;
class FileContentWithMimeType {
    constructor(mimeType, filePath) {
        const fileBytes = fs.readFileSync(filePath);
        this.file_content_base64 = fileBytes.toString("base64");
        this.content_type = mimeType;
    }
}
exports.FileContentWithMimeType = FileContentWithMimeType;
// ============================================================
// Error Class
// ============================================================
class ChatError extends Error {
    constructor(message) {
        super(message);
        this.name = "ChatError";
    }
}
exports.ChatError = ChatError;
// ============================================================
// LlmChat Class
// ============================================================
class LlmChat {
    constructor(apiKey, sessionId, systemMessage, initialMessages, customHeaders) {
        this.model = "gpt-4o";
        this.provider = "openai";
        this.extraParams = {};
        this.customHeaders = {};
        this.tools = null;
        this.toolChoice = null;
        this.apiKey = apiKey;
        this.sessionId = sessionId;
        this.messages = initialMessages || [{ role: "system", content: systemMessage }];
        this.customHeaders = customHeaders || {};
        const appUrl = (0, utils_1.getAppIdentifier)();
        if (appUrl) {
            this.customHeaders["X-App-ID"] = appUrl;
        }
    }
    withModel(provider, model) {
        this.provider = provider;
        this.model = model;
        return this;
    }
    withParams(params) {
        Object.assign(this.extraParams, params);
        return this;
    }
    /**
     * Configure tools for subsequent sendMessageWithTools() calls.
     * Accepts both OpenAI custom function shape and provider-hosted tool dicts
     * (e.g. {"type": "web_search_20250305", "name": "web_search"} for Anthropic,
     * {"googleSearch": {}} for Gemini).
     */
    withTools(tools, toolChoice) {
        this._validateTools(tools);
        this.tools = tools;
        this.toolChoice = toolChoice ?? null;
        return this;
    }
    /**
     * Append a tool-result message to history for the next sendMessageWithTools() call.
     * `toolCallId` must match an ID emitted in the most recent assistant message's tool_calls.
     */
    addToolResult(toolCallId, content) {
        const validIds = this._lastAssistantToolCallIds();
        if (!validIds.has(toolCallId)) {
            throw new ChatError(`tool_call_id '${toolCallId}' does not match any pending tool call`);
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
    async sendMessageWithTools(userMessage) {
        const messages = await this.getMessages();
        if (userMessage) {
            await this._addUserMessage(messages, userMessage);
        }
        else if (!messages.length || messages[messages.length - 1].role !== "tool") {
            throw new ChatError("sendMessageWithTools called without a user message and no pending tool results");
        }
        const client = this._buildClient();
        const params = this._buildCompletionParams(messages, true);
        try {
            const raw = await client.chat.completions.create(params);
            const response = this._parseToolResponse(raw);
            messages.push(this._assistantHistoryMessage(response.content, response.tool_calls));
            await this._saveMessages(messages);
            return response;
        }
        catch (e) {
            throw new ChatError(`Failed to generate chat completion: ${e.message}`);
        }
    }
    /**
     * Stream the assistant response. Yields TextDelta, ToolCallStart, ToolCallReady, StreamDone.
     */
    async *streamMessage(userMessage) {
        const messages = await this.getMessages();
        if (userMessage) {
            await this._addUserMessage(messages, userMessage);
        }
        else if (!messages.length || messages[messages.length - 1].role !== "tool") {
            throw new ChatError("streamMessage called without a user message and no pending tool results");
        }
        const client = this._buildClient();
        const params = this._buildCompletionParams(messages, true);
        params.stream = true;
        params.stream_options = { include_usage: true };
        let stream;
        try {
            stream = await client.chat.completions.create(params);
        }
        catch (e) {
            throw new ChatError(`Failed to start streaming completion: ${e.message}`);
        }
        const textBuf = [];
        const toolState = new Map();
        const started = new Set();
        let finishReason = "stop";
        let usage = null;
        let lastChunk = null;
        try {
            for await (const chunk of stream) {
                lastChunk = chunk;
                if (chunk.usage) {
                    usage = this._extractUsage(chunk);
                }
                if (!chunk.choices || chunk.choices.length === 0)
                    continue;
                const choice = chunk.choices[0];
                if (choice.finish_reason) {
                    finishReason = choice.finish_reason;
                }
                const delta = choice.delta;
                if (!delta)
                    continue;
                if (delta.content) {
                    textBuf.push(delta.content);
                    yield { type: "text_delta", content: delta.content };
                }
                if (delta.tool_calls) {
                    for (const tcd of delta.tool_calls) {
                        const idx = tcd.index;
                        if (!toolState.has(idx)) {
                            toolState.set(idx, { id: null, name: null, args: [] });
                        }
                        const st = toolState.get(idx);
                        if (tcd.id)
                            st.id = tcd.id;
                        if (tcd.function?.name)
                            st.name = tcd.function.name;
                        if (tcd.function?.arguments)
                            st.args.push(tcd.function.arguments);
                        if (!started.has(idx) && st.id && st.name) {
                            started.add(idx);
                            yield { type: "tool_call_start", id: st.id, name: st.name, index: idx };
                        }
                    }
                }
            }
        }
        catch (e) {
            throw new ChatError(`Error during streaming: ${e.message}`);
        }
        // Stream exhausted — assemble final tool_calls
        const finalTcs = [];
        const sortedIndices = Array.from(toolState.keys()).sort((a, b) => a - b);
        for (const idx of sortedIndices) {
            const st = toolState.get(idx);
            if (!(st.id && st.name))
                continue;
            const rawArgs = st.args.join("") || "{}";
            let parsed;
            try {
                parsed = JSON.parse(rawArgs);
            }
            catch {
                parsed = {};
            }
            const tc = {
                id: st.id,
                name: st.name,
                arguments: parsed,
                raw_arguments: rawArgs,
            };
            finalTcs.push(tc);
            yield { type: "tool_call_ready", tool_call: tc };
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
        };
    }
    /**
     * Legacy send_message — returns just the text content string.
     */
    async sendMessage(userMessage) {
        const messages = await this.getMessages();
        await this._addUserMessage(messages, userMessage);
        try {
            const client = this._buildClient();
            const params = this._buildCompletionParams(messages, false);
            const response = await client.chat.completions.create(params);
            const responseText = this._extractResponseText(response);
            messages.push({ role: "assistant", content: responseText });
            await this._saveMessages(messages);
            return responseText;
        }
        catch (e) {
            throw new ChatError(`Failed to generate chat completion: ${e.message}`);
        }
    }
    /**
     * Send a message and extract both text and images from the response.
     * Returns [text, images] where images is a list of {mime_type, data} objects.
     */
    async sendMessageMultimodalResponse(userMessage) {
        const messages = await this.getMessages();
        await this._addUserMessage(messages, userMessage);
        try {
            const client = this._buildClient();
            const params = this._buildCompletionParams(messages, false);
            const response = await client.chat.completions.create(params);
            let text = null;
            const images = [];
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
        }
        catch (e) {
            throw new ChatError(`Failed to generate multimodal completion: ${e.message}`);
        }
    }
    // ============================================================
    // Private Methods
    // ============================================================
    _isEmergentKey(apiKey) {
        return apiKey.startsWith("sk-emergent-");
    }
    _buildClient() {
        const opts = { apiKey: this.apiKey };
        if (this._isEmergentKey(this.apiKey)) {
            opts.baseURL = `${(0, utils_1.getIntegrationProxyUrl)()}/llm`;
            if (Object.keys(this.customHeaders).length > 0) {
                opts.defaultHeaders = this.customHeaders;
            }
        }
        return new openai_1.default(opts);
    }
    _buildCompletionParams(messages, includeTools) {
        let model;
        if (this._isEmergentKey(this.apiKey)) {
            // With emergent key: gemini gets prefix, everything else is raw model name
            model = this.provider === "gemini" ? `gemini/${this.model}` : this.model;
        }
        else {
            // Without emergent key: use provider/model format (LiteLLM style)
            model = `${this.provider}/${this.model}`;
        }
        const params = { model, messages };
        if (includeTools && this.tools) {
            params.tools = this.tools;
            if (this.toolChoice !== null) {
                params.tool_choice = this.toolChoice;
            }
        }
        Object.assign(params, this.extraParams);
        return params;
    }
    _parseToolResponse(raw) {
        const choice = raw.choices[0];
        const message = choice.message;
        const content = message.content || null;
        const finishReason = choice.finish_reason || "stop";
        const rawToolCalls = message.tool_calls || null;
        const parsedToolCalls = rawToolCalls
            ? rawToolCalls.map((tc) => this._parseToolCall(tc))
            : null;
        return {
            content,
            tool_calls: parsedToolCalls,
            finish_reason: finishReason,
            usage: this._extractUsage(raw),
            raw,
        };
    }
    _parseToolCall(tc) {
        const rawArgs = tc.function.arguments || "{}";
        let parsed;
        try {
            parsed = JSON.parse(rawArgs);
        }
        catch {
            parsed = {};
        }
        return {
            id: tc.id,
            name: tc.function.name,
            arguments: parsed,
            raw_arguments: rawArgs,
        };
    }
    _extractUsage(raw) {
        const u = raw.usage;
        if (!u)
            return { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
        const inputTokens = u.prompt_tokens ?? u.input_tokens ?? 0;
        const outputTokens = u.completion_tokens ?? u.output_tokens ?? 0;
        const totalTokens = u.total_tokens ?? inputTokens + outputTokens;
        return { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: totalTokens };
    }
    _extractResponseText(response) {
        if (response.choices && response.choices.length > 0 && response.choices[0].message) {
            return response.choices[0].message.content;
        }
        throw new ChatError("Failed to extract response text");
    }
    async _addUserMessage(messages, message) {
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
            }
            else {
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
    _assistantHistoryMessage(content, toolCalls) {
        const message = { role: "assistant", content };
        if (toolCalls) {
            message.tool_calls = toolCalls.map((tc) => ({
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: tc.raw_arguments },
            }));
        }
        return message;
    }
    _validateTools(tools) {
        if (!Array.isArray(tools) || tools.length === 0) {
            throw new ChatError("withTools requires a non-empty list of tool definitions");
        }
        tools.forEach((tool, i) => {
            if (typeof tool !== "object" || tool === null || Object.keys(tool).length === 0) {
                throw new ChatError(`withTools: tool at index ${i} must be a non-empty dict`);
            }
            if (tool.type === "function") {
                if (!tool.function || !tool.function.name) {
                    throw new ChatError(`withTools: function tool at index ${i} must have a 'function' dict with a 'name'`);
                }
            }
        });
    }
    _lastAssistantToolCallIds() {
        for (let i = this.messages.length - 1; i >= 0; i--) {
            if (this.messages[i].role === "assistant") {
                const tcs = this.messages[i].tool_calls || [];
                return new Set(tcs.map((tc) => tc.id).filter(Boolean));
            }
        }
        return new Set();
    }
    async getMessages() {
        return this.messages;
    }
    async _saveMessages(messages) {
        this.messages = messages;
    }
}
exports.LlmChat = LlmChat;
//# sourceMappingURL=chat.js.map