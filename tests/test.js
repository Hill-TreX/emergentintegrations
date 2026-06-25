/**
 * emergentintegrations - Test suite
 * Run: node tests/test.js
 *
 * Live tests need one of:
 *   OPENAI_API_KEY=sk-...
 *   EMERGENT_LLM_KEY=sk-emergent-...
 */

import {
  LlmChat,
  UserMessage,
  ImageContent,
  FileContentWithMimeType,
} from "../src/index.js";

let passed = 0;
let failed = 0;

function log(label, ok, info = "") {
  if (ok) {
    console.log(`  ✅ ${label}${info ? " — " + info : ""}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${info ? " — " + info : ""}`);
    failed++;
  }
}

console.log("\n📦 emergentintegrations test suite\n");
console.log("── Unit Tests ──────────────────────────────");

// UserMessage string shorthand
const um1 = new UserMessage("hello");
log("UserMessage string shorthand — role", um1.role === "user");
log("UserMessage string shorthand — text", um1.text === "hello");
log("UserMessage string shorthand — fileContents empty", um1.fileContents.length === 0);

// UserMessage object
const um2 = new UserMessage({ text: "hi", fileContents: [] });
log("UserMessage object — text", um2.text === "hi");

// UserMessage toOpenAIMessage plain text
const msg = um1.toOpenAIMessage();
log("toOpenAIMessage plain", msg.role === "user" && msg.content === "hello");

// ImageContent mime detection
const jpeg = new ImageContent("/9j/abc123");
log("ImageContent JPEG detection", jpeg.mimeType === "image/jpeg");
const png = new ImageContent("iVBORw0KGgoAAAANSUhEUg");
log("ImageContent PNG detection", png.mimeType === "image/png");

// UserMessage with image → array content
const umImg = new UserMessage({
  text: "What's this?",
  fileContents: [new ImageContent("/9j/abc")],
});
const imgMsg = umImg.toOpenAIMessage();
log("UserMessage with image — array content", Array.isArray(imgMsg.content));
log("UserMessage with image — text part", imgMsg.content[0].type === "text");
log("UserMessage with image — image part", imgMsg.content[1].type === "image_url");

// LlmChat: missing apiKey throws
try {
  new LlmChat({ sessionId: "x" });
  log("Throws on missing apiKey", false);
} catch (e) {
  log("Throws on missing apiKey", e.message.includes("apiKey"));
}

// LlmChat: missing sessionId throws
try {
  new LlmChat({ apiKey: "sk-test" });
  log("Throws on missing sessionId", false);
} catch (e) {
  log("Throws on missing sessionId", e.message.includes("sessionId"));
}

// LlmChat: builder pattern is chainable
const chat = new LlmChat({ apiKey: "sk-test", sessionId: "test-123" })
  .withModel("openai", "gpt-4o-mini")
  .withParams({ temperature: 0.3 });
log("Builder .withModel() chainable", chat._model === "gpt-4o-mini");
log("Builder .withParams() chainable", chat._extraParams.temperature === 0.3);

// sessionHistory starts empty
log("sessionHistory starts empty", chat.sessionHistory.length === 0);

// clearHistory works
chat._history.push({ role: "user", content: "test" });
chat.clearHistory();
log("clearHistory empties history", chat.sessionHistory.length === 0);

// sk-emergent-* key routes to proxy
const emergentChat = new LlmChat({
  apiKey: "sk-emergent-testkey",
  sessionId: "sess-1",
});
log(
  "sk-emergent-* routes to proxy baseURL",
  emergentChat._client.baseURL.includes("integrations.emergentagent.com")
);

// plain key uses no baseURL override
const plainChat = new LlmChat({
  apiKey: "sk-openai-testkey",
  sessionId: "sess-2",
});
log(
  "Plain key uses OpenAI default",
  !plainChat._client.baseURL.includes("integrations.emergentagent.com")
);

// ─── Live tests ───────────────────────────────────────────────────────────────

console.log("\n── Live API Tests ──────────────────────────");

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const EMERGENT_KEY = process.env.EMERGENT_LLM_KEY;

async function runLive() {
  if (!OPENAI_KEY && !EMERGENT_KEY) {
    console.log("  ⏭️  Skipped — set OPENAI_API_KEY or EMERGENT_LLM_KEY to run live tests");
  } else {
    const key = OPENAI_KEY ?? EMERGENT_KEY;
    const isEmergent = !OPENAI_KEY;

    try {
      const chat = new LlmChat({
        apiKey: key,
        sessionId: "live-test-001",
        systemMessage: "Reply with exactly: PONG",
        ...(isEmergent ? {} : {}),
      })
        .withModel("openai", "gpt-4o-mini")
        .withParams({ temperature: 0 });

      const res = await chat.sendMessage(new UserMessage("PING"));
      log("sendMessage() returns string", typeof res === "string" && res.length > 0, res.slice(0, 50));
      log("History updated after sendMessage", chat.sessionHistory.length === 2);

      // Multi-turn
      const chat2 = new LlmChat({
        apiKey: key,
        sessionId: "live-test-002",
      }).withModel("openai", "gpt-4o-mini");

      await chat2.sendMessage(new UserMessage("My name is Hilton."));
      const res2 = await chat2.sendMessage(new UserMessage("What is my name?"));
      log("Multi-turn history works", chat2.sessionHistory.length === 4);
      log("Multi-turn answer contains name", res2.toLowerCase().includes("hilton"), res2.slice(0, 60));

      // Streaming
      const chat3 = new LlmChat({
        apiKey: key,
        sessionId: "live-test-003",
      }).withModel("openai", "gpt-4o-mini");

      let streamed = "";
      for await (const chunk of chat3.stream(new UserMessage("Say hello in 3 words"))) {
        streamed += chunk;
      }
      log("stream() yields chunks", streamed.length > 0, streamed.slice(0, 50));

    } catch (e) {
      log("Live API test", false, e.message);
    }
  }

  console.log(`\n── Results ─────────────────────────────────`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total:  ${passed + failed}\n`);

  if (failed > 0) process.exit(1);
}

runLive();
