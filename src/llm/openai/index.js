/**
 * Compatibility shim matching the import path used by existing Emergent templates.
 * Historic callers use: from emergentintegrations.llm.openai import LlmChat
 * Mirrors: src/emergentintegrations/llm/openai/__init__.py
 */
export {
  ChatError,
  FileContent,
  FileContentWithMimeType,
  ImageContent,
  LlmChat,
  UserMessage,
} from "../chat.js";
