/**
 * emergentintegrations - Node.js/TypeScript package
 * A library for various integrations including payments and LLM services.
 *
 * Exact port of the Python emergentintegrations v0.2.0 package.
 *
 * @version 0.2.0
 */

// ============================================================
// LLM Module Exports
// ============================================================

// Core chat
export {
  LlmChat,
  ChatError,
  ImageContent,
  FileContentWithMimeType,
  UserMessage,
} from "./llm/chat";

export type {
  ChatResponse,
  ToolCall,
  Usage,
  ChatStreamEvent,
  TextDelta,
  ToolCallStart,
  ToolCallReady,
  StreamDone,
  FileContent,
} from "./llm/chat";

// Utilities
export { getAppIdentifier, getIntegrationProxyUrl } from "./llm/utils";

// OpenAI integrations
export { OpenAIChatRealtime } from "./llm/openai/realtime";
export { OpenAIVideoGeneration } from "./llm/openai/videoGeneration";
export { OpenAITextToSpeech } from "./llm/openai/textToSpeech";
export { OpenAISpeechToText } from "./llm/openai/speechToText";
export { OpenAIImageGeneration } from "./llm/openai/imageGeneration";

// Gemini integrations
export { GeminiImageGeneration } from "./llm/gemini/imageGeneration";
export { GeminiVideoGeneration } from "./llm/gemini/videoGeneration";

// ============================================================
// Payments Module Exports
// ============================================================

export { StripeCheckout, CheckoutError } from "./payments/stripe/checkout";
export type {
  CheckoutSessionRequest,
  CheckoutSessionResponse,
  CheckoutStatusResponse,
  WebhookEventResponse,
} from "./payments/stripe/checkout";
