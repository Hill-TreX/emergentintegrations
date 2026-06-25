/**
 * emergentintegrations — test suite
 * Mirrors the real Python tests/test_chat.py + extra Node-specific checks.
 *
 * Run: node tests/test.js
 * Live: OPENAI_API_KEY=sk-... node tests/test.js
 *       EMERGENT_LLM_KEY=sk-emergent-... node tests/test.js
 */

import {
  ChatError,
  FileContent,
  FileContentWithMimeType,
  ImageContent,
  LlmChat,
  UserMessage,
} from "../src/index.js";

import { LlmChat as LlmChatLlm } from "../src/llm/index.js";
import { LlmChat as LlmChatOpenai } from "../src/llm/openai/index.js";
import { LlmChat as LlmChatChat } from "../src/llm/chat.js";

import {
  DEFAULT_PROXY_URL,
  getAppIdentifier,
  getIntegrationProxyUrl,
  isEmergentKey,
} from "../src/_proxy.js";

let passed = 0;
let failed = 0;

function assert(label, condition, info = "") {
  if (condition) {
    console.log(`  ✅ ${label}${info ? " — " + info : ""}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${info ? " — " + info : ""}`);
    failed++;
  }
}

async function assertThrows(label, fn, errorType = null) {
  try {
    await fn();
    console.log(`  ❌ ${label} — expected error, got none`);
    failed++;
  } catch (e) {
    const ok = errorType ? e instanceof errorType : true;
    if (ok) {
      console.log(`  ✅ ${label} — threw ${e.constructor.name}: ${e.message.slice(0, 60)}`);
      passed++;
    } else {
      console.log(`  ❌ ${label} — threw ${e.constructor.name} not ${errorType.name}`);
      failed++;
    }
  }
}

console.log("\n📦 emergentintegrations — parity verification\n");

// ─── Import path parity ───────────────────────────────────────────────────────
console.log("── Import path parity ──────────────────────");
// Mirrors: test_nested_import_paths_resolve_to_same_class
assert("LlmChat === LlmChatLlm (emergentintegrations/llm)", LlmChat === LlmChatLlm);
assert("LlmChat === LlmChatOpenai (emergentintegrations/llm/openai)", LlmChat === LlmChatOpenai);
assert("LlmChat === LlmChatChat (emergentintegrations/llm/chat)", LlmChat === LlmChatChat);

// ─── _proxy.js ────────────────────────────────────────────────────────────────
console.log("\n── _proxy helpers ──────────────────────────");
// Mirrors: test_is_emergent_key
assert("isEmergentKey('sk-emergent-abc123')", isEmergentKey("sk-emergent-abc123") === true);
assert("isEmergentKey('sk-test-1') is false", isEmergentKey("sk-test-1") === false);
assert("isEmergentKey('') is false", isEmergentKey("") === false);

// Mirrors: test_proxy_url_defaults
const savedProxy = process.env.INTEGRATION_PROXY_URL;
const savedProxyLower = process.env.integration_proxy_url;
delete process.env.INTEGRATION_PROXY_URL;
delete process.env.integration_proxy_url;
assert("getIntegrationProxyUrl() defaults to DEFAULT_PROXY_URL", getIntegrationProxyUrl() === DEFAULT_PROXY_URL);

// Mirrors: test_proxy_url_env_precedence
process.env.INTEGRATION_PROXY_URL = "https://upper.example";
process.env.integration_proxy_url = "https://lower.example";
assert("INTEGRATION_PROXY_URL takes precedence over lowercase", getIntegrationProxyUrl() === "https://upper.example");
delete process.env.INTEGRATION_PROXY_URL;
delete process.env.integration_proxy_url;
if (savedProxy) process.env.INTEGRATION_PROXY_URL = savedProxy;
if (savedProxyLower) process.env.integration_proxy_url = savedProxyLower;

// Mirrors: test_app_identifier_fallback
const savedApp = process.env.APP_URL;
const savedReact = process.env.REACT_APP_BACKEND_URL;
delete process.env.APP_URL;
process.env.REACT_APP_BACKEND_URL = "https://app.example";
assert("getAppIdentifier() falls back to REACT_APP_BACKEND_URL", getAppIdentifier() === "https://app.example");
delete process.env.REACT_APP_BACKEND_URL;
if (savedApp) process.env.APP_URL = savedApp;
if (savedReact) process.env.REACT_APP_BACKEND_URL = savedReact;

// ─── ImageContent ─────────────────────────────────────────────────────────────
console.log("\n── ImageContent ────────────────────────────");
// Mirrors: test_image_mime_inference
assert("PNG mime", ImageContent.getMimeType("iVBORw0KGgo...") === "image/png");
assert("JPEG mime", ImageContent.getMimeType("/9j/4AAQ...") === "image/jpeg");
assert("GIF mime", ImageContent.getMimeType("R0lGODdh...") === "image/gif");
assert("WEBP mime", ImageContent.getMimeType("UklGRiQ...") === "image/webp");
assert("Unknown prefix → image/png", ImageContent.getMimeType("unknownprefix") === "image/png");

// ImageContent extends FileContent
const img = new ImageContent("/9j/abc");
assert("ImageContent extends FileContent", img instanceof FileContent);
assert("ImageContent content_type === 'image'", img.content_type === "image");
assert("ImageContent file_content_base64", img.file_content_base64 === "/9j/abc");

// FileContent base class
const fc = new FileContent("image/png", "base64data");
assert("FileContent content_type", fc.content_type === "image/png");
assert("FileContent file_content_base64", fc.file_content_base64 === "base64data");

// ─── UserMessage ─────────────────────────────────────────────────────────────
console.log("\n── UserMessage ─────────────────────────────");
const um = new UserMessage({ text: "hello", file_contents: [] });
assert("UserMessage text", um.text === "hello");
assert("UserMessage file_contents is array", Array.isArray(um.file_contents));

const umEmpty = new UserMessage();
assert("UserMessage() defaults text=null", umEmpty.text === null);
assert("UserMessage() defaults file_contents=[]", umEmpty.file_contents.length === 0);

const umWithFile = new UserMessage({ text: "hi", file_contents: [img] });
assert("UserMessage with file_contents stores it", umWithFile.file_contents[0] === img);

// ─── LlmChat construction ─────────────────────────────────────────────────────
console.log("\n── LlmChat construction ────────────────────");

// Mirrors: test_emergent_key_sets_proxy_base_url
delete process.env.INTEGRATION_PROXY_URL;
delete process.env.APP_URL;
delete process.env.REACT_APP_BACKEND_URL;
const chatEmergent = new LlmChat({ apiKey: "sk-emergent-xyz", sessionId: "s", systemMessage: "sys" });
assert("sk-emergent-* sets _base_url to proxy/llm", chatEmergent._base_url === `${DEFAULT_PROXY_URL}/llm`);

// Mirrors: test_plain_key_has_no_base_url
const chatPlain = new LlmChat({ apiKey: "sk-abcdef", sessionId: "s", systemMessage: "sys" });
assert("Plain key has _base_url === null", chatPlain._base_url === null);

// Mirrors: test_app_id_header_injected
process.env.APP_URL = "https://app.example";
const chatWithApp = new LlmChat({ apiKey: "sk-abcdef", sessionId: "s", systemMessage: "sys" });
assert("APP_URL sets X-App-ID header", chatWithApp.custom_headers["X-App-ID"] === "https://app.example");
delete process.env.APP_URL;

// Mirrors: test_user_custom_headers_preserved
process.env.APP_URL = "https://app.example";
const chatCustom = new LlmChat({
  apiKey: "sk-abcdef",
  sessionId: "s",
  systemMessage: "sys",
  customHeaders: { "X-Custom": "yes", "X-App-ID": "override" },
});
assert("Custom X-Custom header preserved", chatCustom.custom_headers["X-Custom"] === "yes");
assert("User X-App-ID overrides env (setdefault behaviour)", chatCustom.custom_headers["X-App-ID"] === "override");
delete process.env.APP_URL;

// Mirrors: test_explicit_base_url_overrides_emergent_routing
const chatBaseUrl = new LlmChat({
  apiKey: "sk-emergent-xyz",
  sessionId: "s",
  systemMessage: "sys",
  baseUrl: "https://custom.example",
});
assert("Explicit baseUrl overrides emergent routing", chatBaseUrl._base_url === "https://custom.example");

// messages[] initialised with system message
const chatMsg = new LlmChat({ apiKey: "sk-a", sessionId: "s", systemMessage: "sys" });
assert("messages[0] is system message", chatMsg.messages[0].role === "system" && chatMsg.messages[0].content === "sys");
assert("model defaults to gpt-4o", chatMsg.model === "gpt-4o");

// Mirrors: test_with_model_and_with_params_chain
const chained = new LlmChat({ apiKey: "sk-a", sessionId: "s", systemMessage: "sys" })
  .withModel("openai", "gpt-4o-mini")
  .withParams({ temperature: 0.3, max_tokens: 128 });
assert("withModel sets model", chained.model === "gpt-4o-mini");
assert("withParams sets extra_params.temperature", chained.extra_params.temperature === 0.3);
assert("withParams sets extra_params.max_tokens", chained.extra_params.max_tokens === 128);

// ─── _buildUserTurn ───────────────────────────────────────────────────────────
console.log("\n── _buildUserTurn ──────────────────────────");

// Text only
const turnText = chatMsg._buildUserTurn(new UserMessage({ text: "hi" }));
assert("Text-only turn: role=user", turnText[0].role === "user");
assert("Text-only turn: content is array", Array.isArray(turnText[0].content));
assert("Text-only turn: first part is text", turnText[0].content[0].type === "text");
assert("Text-only turn: text value", turnText[0].content[0].text === "hi");

// Image turn
const imgMsg = new UserMessage({ text: "what's this", file_contents: [new ImageContent("/9j/4AAQ")] });
const turnImg = chatMsg._buildUserTurn(imgMsg);
assert("Image turn: text part first", turnImg[0].content[0].type === "text");
assert("Image turn: image_url part second", turnImg[0].content[1].type === "image_url");
assert("Image turn: data URL starts correctly",
  turnImg[0].content[1].image_url.url.startsWith("data:image/jpeg;base64,/9j/4AAQ"));

// Mirrors: test_send_message_rejects_empty_user_message
await assertThrows(
  "Empty UserMessage throws ChatError",
  () => { chatMsg._buildUserTurn(new UserMessage()); },
  ChatError
);

// ─── ChatError ────────────────────────────────────────────────────────────────
console.log("\n── ChatError ───────────────────────────────");
const err = new ChatError("test error");
assert("ChatError is instanceof Error", err instanceof Error);
assert("ChatError.name === 'ChatError'", err.name === "ChatError");
assert("ChatError.message correct", err.message === "test error");

// ─── getMessages() ────────────────────────────────────────────────────────────
console.log("\n── getMessages() ───────────────────────────");
const chatGm = new LlmChat({ apiKey: "sk-a", sessionId: "s", systemMessage: "sys" });
const msgs = await chatGm.getMessages();
assert("getMessages() returns array", Array.isArray(msgs));
assert("getMessages() first is system msg", msgs[0].role === "system");

// ─── Live API tests ───────────────────────────────────────────────────────────
console.log("\n── Live API Tests ──────────────────────────");

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const EMERGENT_KEY = process.env.EMERGENT_LLM_KEY;

if (!OPENAI_KEY && !EMERGENT_KEY) {
  console.log("  ⏭️  Skipped — set OPENAI_API_KEY or EMERGENT_LLM_KEY to run live tests");
} else {
  const key = OPENAI_KEY || EMERGENT_KEY;

  try {
    // Basic sendMessage
    const chat = new LlmChat({
      apiKey: key,
      sessionId: "live-001",
      systemMessage: "Reply with exactly the word: PONG",
    }).withModel("openai", "gpt-4o-mini").withParams({ temperature: 0 });

    const reply = await chat.sendMessage(new UserMessage({ text: "PING" }));
    assert("sendMessage() returns string", typeof reply === "string" && reply.length > 0, reply.slice(0, 40));
    assert("messages updated after sendMessage", chat.messages.length === 3); // system + user + assistant

    // Multi-turn
    const chat2 = new LlmChat({ apiKey: key, sessionId: "live-002", systemMessage: "You are helpful." })
      .withModel("openai", "gpt-4o-mini");
    await chat2.sendMessage(new UserMessage({ text: "My name is Hilton." }));
    const r2 = await chat2.sendMessage(new UserMessage({ text: "What is my name?" }));
    assert("Multi-turn: messages has 5 entries", chat2.messages.length === 5);
    assert("Multi-turn: answer contains name", r2.toLowerCase().includes("hilton"), r2.slice(0, 60));

    // Streaming (Node bonus)
    const chat3 = new LlmChat({ apiKey: key, sessionId: "live-003", systemMessage: "Be brief." })
      .withModel("openai", "gpt-4o-mini");
    let streamed = "";
    for await (const chunk of chat3.stream(new UserMessage({ text: "Say: hello world" }))) {
      streamed += chunk;
    }
    assert("stream() yields text", streamed.length > 0, streamed.slice(0, 40));
    assert("stream() updates messages", chat3.messages.length === 3);

    // ChatError on bad model
    const badChat = new LlmChat({ apiKey: key, sessionId: "live-004", systemMessage: "sys" })
      .withModel("openai", "not-a-real-model-xyz");
    await assertThrows(
      "Bad model throws ChatError",
      () => badChat.sendMessage(new UserMessage({ text: "hi" })),
      ChatError
    );

  } catch (e) {
    console.log(`  ❌ Live test crashed: ${e.message}`);
    failed++;
  }
}

// ─── Results ─────────────────────────────────────────────────────────────────
console.log(`\n── Results ─────────────────────────────────`);
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total:  ${passed + failed}\n`);

if (failed > 0) process.exit(1);
