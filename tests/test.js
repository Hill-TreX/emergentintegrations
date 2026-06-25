/**
 * emergentintegrations - Test & Usage Examples
 * Run: node tests/test.js
 *
 * Set one or more of these env vars to run live tests:
 *   ANTHROPIC_API_KEY
 *   OPENAI_API_KEY
 *   GOOGLE_API_KEY
 *   EMERGENT_LLM_KEY  (routes to all providers via Emergent proxy)
 */

import { LlmChat, UserMessage, AssistantMessage } from "../src/index.js";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_KEY = process.env.GOOGLE_API_KEY;
const EMERGENT_KEY = process.env.EMERGENT_LLM_KEY;

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

// ─── Unit Tests (no API key needed) ──────────────────────────────────────────

console.log("\n📦 emergentintegrations test suite\n");
console.log("── Unit Tests ──────────────────────────────");

// Test 1: UserMessage construction
const um = new UserMessage("hello");
log("UserMessage role", um.role === "user", um.role);
log("UserMessage content", um.content === "hello", um.content);

// Test 2: AssistantMessage construction
const am = new AssistantMessage("world");
log("AssistantMessage role", am.role === "assistant", am.role);

// Test 3: LlmChat provider detection (Anthropic)
try {
  const chat = new LlmChat({ apiKey: "dummy", model: "claude-sonnet-4-6" });
  log("Provider detection: claude -> anthropic", chat.provider === "anthropic", chat.provider);
} catch (e) {
  log("Provider detection: claude", false, e.message);
}

// Test 4: LlmChat provider detection (OpenAI)
try {
  const chat = new LlmChat({ apiKey: "dummy", model: "gpt-4o" });
  log("Provider detection: gpt-4o -> openai", chat.provider === "openai", chat.provider);
} catch (e) {
  log("Provider detection: gpt-4o", false, e.message);
}

// Test 5: LlmChat provider detection (Google)
try {
  const chat = new LlmChat({ apiKey: "dummy", model: "gemini-1.5-pro" });
  log("Provider detection: gemini -> google", chat.provider === "google", chat.provider);
} catch (e) {
  log("Provider detection: gemini", false, e.message);
}

// Test 6: Missing apiKey throws
try {
  new LlmChat({ model: "gpt-4o" });
  log("Throws on missing apiKey", false, "no error thrown");
} catch (e) {
  log("Throws on missing apiKey", e.message.includes("apiKey"), e.message);
}

// Test 7: Missing model throws
try {
  new LlmChat({ apiKey: "dummy" });
  log("Throws on missing model", false, "no error thrown");
} catch (e) {
  log("Throws on missing model", e.message.includes("model"), e.message);
}

// Test 8: clearHistory works
try {
  const chat = new LlmChat({ apiKey: "dummy", model: "gpt-4o" });
  chat.history.push(new UserMessage("test"));
  chat.clearHistory();
  log("clearHistory empties history", chat.history.length === 0);
} catch (e) {
  log("clearHistory", false, e.message);
}

// Test 9: getHistory returns plain objects
try {
  const chat = new LlmChat({ apiKey: "dummy", model: "gpt-4o" });
  chat.history.push(new UserMessage("hi"));
  const h = chat.getHistory();
  log(
    "getHistory returns plain objects",
    h[0].role === "user" && h[0].content === "hi"
  );
} catch (e) {
  log("getHistory", false, e.message);
}

// ─── Live Tests ───────────────────────────────────────────────────────────────

console.log("\n── Live API Tests ──────────────────────────");

async function testAnthropic() {
  if (!ANTHROPIC_KEY && !EMERGENT_KEY) {
    console.log("  ⏭️  Anthropic: skipped (no ANTHROPIC_API_KEY or EMERGENT_LLM_KEY)");
    return;
  }

  try {
    const chat = new LlmChat({
      apiKey: ANTHROPIC_KEY || EMERGENT_KEY,
      model: "claude-haiku-4-5-20251001",
      systemMessage: "You are a test assistant. Reply with exactly: PONG",
      ...(EMERGENT_KEY && !ANTHROPIC_KEY
        ? { baseUrl: "https://integrations.emergentagent.com" }
        : {}),
    });

    const res = await chat.chat("PING");
    log("Anthropic chat()", typeof res === "string" && res.length > 0, res.slice(0, 60));

    // Test history persists
    log("History updated after chat", chat.history.length === 2);

    // Test streaming
    let streamed = "";
    const chat2 = new LlmChat({
      apiKey: ANTHROPIC_KEY || EMERGENT_KEY,
      model: "claude-haiku-4-5-20251001",
      systemMessage: "Reply with exactly 3 words.",
      ...(EMERGENT_KEY && !ANTHROPIC_KEY
        ? { baseUrl: "https://integrations.emergentagent.com" }
        : {}),
    });

    for await (const chunk of chat2.stream("Say hello world now")) {
      streamed += chunk;
    }
    log("Anthropic stream()", streamed.length > 0, streamed.slice(0, 60));

  } catch (e) {
    log("Anthropic live test", false, e.message);
  }
}

async function testOpenAI() {
  if (!OPENAI_KEY && !EMERGENT_KEY) {
    console.log("  ⏭️  OpenAI: skipped (no OPENAI_API_KEY or EMERGENT_LLM_KEY)");
    return;
  }

  try {
    const chat = new LlmChat({
      apiKey: OPENAI_KEY || EMERGENT_KEY,
      model: "gpt-4o-mini",
      systemMessage: "You are a test assistant. Reply with exactly: PONG",
      ...(EMERGENT_KEY && !OPENAI_KEY
        ? { baseUrl: "https://integrations.emergentagent.com" }
        : {}),
    });

    const res = await chat.chat("PING");
    log("OpenAI chat()", typeof res === "string" && res.length > 0, res.slice(0, 60));

    // Test multi-turn history
    const res2 = await chat.chat("What did I just say?");
    log("OpenAI multi-turn history", chat.history.length === 4, `history len: ${chat.history.length}`);

    // Test send() alias
    const chat3 = new LlmChat({
      apiKey: OPENAI_KEY || EMERGENT_KEY,
      model: "gpt-4o-mini",
      ...(EMERGENT_KEY && !OPENAI_KEY
        ? { baseUrl: "https://integrations.emergentagent.com" }
        : {}),
    });
    const res3 = await chat3.send(new UserMessage("Say exactly: OK"));
    log("OpenAI send() alias", typeof res3 === "string" && res3.length > 0, res3.slice(0, 40));

  } catch (e) {
    log("OpenAI live test", false, e.message);
  }
}

async function testGoogle() {
  if (!GOOGLE_KEY) {
    console.log("  ⏭️  Google: skipped (no GOOGLE_API_KEY)");
    return;
  }

  try {
    const chat = new LlmChat({
      apiKey: GOOGLE_KEY,
      model: "gemini-1.5-flash",
      systemMessage: "You are a test assistant. Reply with exactly: PONG",
    });

    const res = await chat.chat("PING");
    log("Google chat()", typeof res === "string" && res.length > 0, res.slice(0, 60));

  } catch (e) {
    log("Google live test", false, e.message);
  }
}

async function runLiveTests() {
  await testAnthropic();
  await testOpenAI();
  await testGoogle();

  console.log(`\n── Results ─────────────────────────────────`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total:  ${passed + failed}\n`);

  if (failed > 0) process.exit(1);
}

runLiveTests();
