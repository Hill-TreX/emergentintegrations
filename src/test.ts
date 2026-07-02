/**
 * emergentintegrations — smoke test suite (no API key required)
 * Run: npm test
 */
import {
  LlmChat, UserMessage, ImageContent, FileContent,
  ChatError, ToolCall, Usage, ChatResponse,
  TextDelta, ToolCallStart, ToolCallReady, StreamDone,
  OpenAIChatRealtime, OpenAITextToSpeech, OpenAISpeechToText,
  OpenAIImageGeneration, OpenAIVideoGeneration,
  GeminiImageGeneration, GeminiVideoGeneration,
  StripeCheckout, CheckoutError,
  createChat, validateApiKey, getProxyInfo, listModels,
  getAppIdentifier, getIntegrationProxyUrl,
} from "./index";

let passed = 0;
let failed = 0;

function check(label: string, val: boolean): void {
  if (val) { console.log(`  ✅ ${label}`); passed++; }
  else { console.log(`  ❌ ${label}`); failed++; }
}

console.log("\n📦 emergentintegrations smoke tests\n");

// All classes exported as constructors
const classes: Record<string, unknown> = {
  LlmChat, UserMessage, ImageContent, FileContent, ChatError,
  ToolCall, Usage, ChatResponse, TextDelta, ToolCallStart,
  ToolCallReady, StreamDone, OpenAIChatRealtime, OpenAITextToSpeech,
  OpenAISpeechToText, OpenAIImageGeneration, OpenAIVideoGeneration,
  GeminiImageGeneration, GeminiVideoGeneration, StripeCheckout, CheckoutError,
};
for (const [name, cls] of Object.entries(classes)) {
  check(`${name} is a constructor`, typeof cls === "function");
}
check("createChat is a function", typeof createChat === "function");
check("validateApiKey is a function", typeof validateApiKey === "function");
check("getProxyInfo is a function", typeof getProxyInfo === "function");
check("listModels is a function", typeof listModels === "function");
check("getAppIdentifier is a function", typeof getAppIdentifier === "function");
check("getIntegrationProxyUrl is a function", typeof getIntegrationProxyUrl === "function");

// LlmChat defaults
// LlmChat requires a real Emergent-shaped key now — the constructor throws otherwise.
const chat = new LlmChat("sk-emergent-test", "s", "sys");
check("model default gpt-4o", chat.model === "gpt-4o");
check("provider default openai", chat.provider === "openai");
check("messages[0] system", chat.messages[0].role === "system");

// The guard: this is the actual bug fix, so it needs its own real assertion,
// not just a passing construction elsewhere in the file.
try {
  new LlmChat("sk-proj-not-an-emergent-key", "s", "sys");
  check("LlmChat rejects a direct OpenAI-shaped key", false);
} catch (e) {
  check("LlmChat rejects a direct OpenAI-shaped key", e instanceof ChatError);
}
try {
  new LlmChat("sk-ant-not-an-emergent-key", "s", "sys");
  check("LlmChat rejects a direct Anthropic-shaped key", false);
} catch (e) {
  check("LlmChat rejects a direct Anthropic-shaped key", e instanceof ChatError);
}

// Chain
chat.withModel("anthropic", "claude-sonnet-4-6").withParams({ temperature: 0.3 });
check("withModel chains", chat.model === "claude-sonnet-4-6");

// Proxy detection
const info = getProxyInfo("sk-emergent-x");
check("emergent key detected", info.isEmergent === true);
check("plain key not emergent", getProxyInfo("sk-abc").isEmergent === false);

// UserMessage
const um = new UserMessage({ text: "hi" });
check("UserMessage constructs", um.text === "hi" && um.file_contents.length === 0);

// ImageContent
check("ImageContent mime JPEG", ImageContent.getMimeType("/9j/") === "image/jpeg");
const img = new ImageContent("/9j/x");
check("ImageContent extends FileContent", img instanceof FileContent);

// Dataclasses construct
const usage = new Usage({ input_tokens: 1, output_tokens: 2, total_tokens: 3 });
check("Usage constructs", usage.total_tokens === 3);
const td = new TextDelta("x");
check("TextDelta type tag", td.type === "text_delta");

// Errors
check("ChatError is Error", new ChatError("x") instanceof Error);
check("validateApiKey throws on empty", (() => { try { validateApiKey(undefined); return false; } catch { return true; } })());

console.log(`\nPassed: ${passed} | Failed: ${failed}\n`);
if (failed > 0) process.exit(1);
