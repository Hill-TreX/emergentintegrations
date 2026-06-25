/**
 * emergentintegrations — lightweight async LLM chat client on top of the OpenAI SDK.
 * Mirrors: src/emergentintegrations/__init__.py
 */
export {
  ChatError,
  FileContent,
  FileContentWithMimeType,
  ImageContent,
  LlmChat,
  UserMessage,
} from "./llm/chat.js";

export const __version__ = "1.2.0";
