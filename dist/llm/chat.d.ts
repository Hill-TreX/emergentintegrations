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
export interface FileContent {
    content_type: string;
    file_content_base64: string;
}
export declare class ImageContent implements FileContent {
    content_type: string;
    file_content_base64: string;
    constructor(imageBase64: string);
    static getMimeType(fileContentBase64: string): string;
}
export declare class FileContentWithMimeType implements FileContent {
    content_type: string;
    file_content_base64: string;
    constructor(mimeType: string, filePath: string);
}
export interface UserMessage {
    text?: string;
    file_contents?: FileContent[];
}
export declare class ChatError extends Error {
    constructor(message: string);
}
export declare class LlmChat {
    private apiKey;
    private model;
    private provider;
    private messages;
    private sessionId;
    private extraParams;
    private customHeaders;
    private tools;
    private toolChoice;
    constructor(apiKey: string, sessionId: string, systemMessage: string, initialMessages?: any[], customHeaders?: Record<string, string>);
    withModel(provider: string, model: string): this;
    withParams(params: Record<string, any>): this;
    /**
     * Configure tools for subsequent sendMessageWithTools() calls.
     * Accepts both OpenAI custom function shape and provider-hosted tool dicts
     * (e.g. {"type": "web_search_20250305", "name": "web_search"} for Anthropic,
     * {"googleSearch": {}} for Gemini).
     */
    withTools(tools: any[], toolChoice?: any): this;
    /**
     * Append a tool-result message to history for the next sendMessageWithTools() call.
     * `toolCallId` must match an ID emitted in the most recent assistant message's tool_calls.
     */
    addToolResult(toolCallId: string, content: string): this;
    /**
     * Tool-aware variant of sendMessage().
     * Returns a ChatResponse exposing content, tool_calls, finish_reason, usage, and raw response.
     */
    sendMessageWithTools(userMessage?: UserMessage): Promise<ChatResponse>;
    /**
     * Stream the assistant response. Yields TextDelta, ToolCallStart, ToolCallReady, StreamDone.
     */
    streamMessage(userMessage?: UserMessage): AsyncGenerator<ChatStreamEvent>;
    /**
     * Legacy send_message — returns just the text content string.
     */
    sendMessage(userMessage: UserMessage): Promise<string>;
    /**
     * Send a message and extract both text and images from the response.
     * Returns [text, images] where images is a list of {mime_type, data} objects.
     */
    sendMessageMultimodalResponse(userMessage: UserMessage): Promise<[string | null, Array<{
        mime_type: string;
        data: string;
    }>]>;
    private _isEmergentKey;
    private _buildClient;
    private _buildCompletionParams;
    private _parseToolResponse;
    private _parseToolCall;
    private _extractUsage;
    private _extractResponseText;
    private _addUserMessage;
    private _assistantHistoryMessage;
    private _validateTools;
    private _lastAssistantToolCallIds;
    getMessages(): Promise<any[]>;
    private _saveMessages;
}
//# sourceMappingURL=chat.d.ts.map