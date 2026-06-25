/**
 * emergentintegrations - TypeScript definitions
 * Node.js replica of the Python emergentintegrations package
 */

export declare class ImageContent {
  imageBase64: string;
  mimeType: string;
  readonly rawBase64: string;
  /** Infers mime type from base64 header (PNG/JPEG/GIF/WEBP) */
  constructor(imageBase64: string);
}

export declare class FileContentWithMimeType {
  mimeType: string;
  filePath: string;
  base64: string;
  constructor(mimeType: string, filePath: string);
}

export interface UserMessageOptions {
  text?: string;
  fileContents?: Array<ImageContent | FileContentWithMimeType>;
}

export declare class UserMessage {
  role: "user";
  text: string | null;
  fileContents: Array<ImageContent | FileContentWithMimeType>;
  constructor(options: string | UserMessageOptions);
  toOpenAIMessage(): object;
}

export interface LlmChatOptions {
  /** Provider key, or sk-emergent-* to route via Emergent proxy */
  apiKey: string;
  /** Session identifier */
  sessionId: string;
  /** System prompt */
  systemMessage?: string;
  /** Seed conversation history */
  initialMessages?: UserMessage[];
  /** Extra HTTP headers */
  customHeaders?: Record<string, string>;
  /** Override base URL entirely */
  baseUrl?: string;
}

export declare class LlmChat {
  readonly sessionId: string;
  readonly systemMessage: string | null;
  readonly sessionHistory: object[];

  constructor(options: LlmChatOptions);

  /** Set target model. Chainable. */
  withModel(provider: string, model: string): this;

  /** Set extra params forwarded to chat.completions.create. Chainable. */
  withParams(params: Record<string, unknown>): this;

  /** Send a message, get assistant text back. History maintained automatically. */
  sendMessage(userMessage: UserMessage): Promise<string>;

  /** Send a message, get text + any generated images back. */
  sendMessageMultimodalResponse(
    userMessage: UserMessage
  ): Promise<[string, Array<{ mimeType: string; data: string }>]>;

  /** Stream a response as an async generator of string chunks. */
  stream(userMessage: UserMessage): AsyncGenerator<string>;

  /** Clear session history. */
  clearHistory(): void;
}
