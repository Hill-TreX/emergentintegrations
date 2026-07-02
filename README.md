# emergentintegrations

Node.js client for [Emergent](https://emergentagent.com)'s LLM proxy and platform integrations. Chat with OpenAI, Anthropic, and Google models through one Emergent key, no manual proxy wiring, plus image generation, video generation, text-to-speech, speech-to-text, realtime audio, and Stripe payments.

```js
// Same code, any provider — just change the model. Requires an Emergent API key.
chat.withModel("openai", "gpt-4o")
chat.withModel("anthropic", "claude-sonnet-4-6")
chat.withModel("gemini", "gemini-1.5-pro")
```

**Key requirements are not the same for every feature.** `LlmChat` requires an Emergent API key (`sk-emergent-*`) and always routes through Emergent's proxy — it does not accept direct OpenAI, Anthropic, or Google keys. `OpenAITextToSpeech`, `OpenAISpeechToText`, and `OpenAIImageGeneration` accept either an Emergent key or a direct OpenAI key. `GeminiImageGeneration` always talks directly to Google and requires a real Google API key. `GeminiVideoGeneration` always routes through the Emergent proxy. `OpenAIChatRealtime` always talks directly to OpenAI and requires a real OpenAI key, there is no proxy path for realtime audio. This isn't a Node-specific limitation, it mirrors the official Python package's actual per-module design exactly.

- **Framework agnostic** — works with Express, Fastify, Hono, plain Node, serverless, anywhere
- **Dual ESM + CommonJS** — native `import` and `require`, no workarounds
- **AI-agent ready** — ships rule files (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`) that stop coding agents from bypassing the package or assuming key requirements that don't hold
- **Verified against the official Python package** — audited file by file, not assumed

## Install

```bash
npm install emergentintegrations
```

Or install directly from GitHub:

```bash
npm install github:Hill-TreX/emergentintegrations
```

If you use Stripe payments, also install:

```bash
npm install stripe
```

Works natively in both CommonJS and ESM projects:

```js
// CommonJS
const { LlmChat, UserMessage } = require("emergentintegrations");

// ESM — no createRequire workaround needed
import { LlmChat, UserMessage } from "emergentintegrations";
```

### Set up AI agent rules (optional but recommended)

If you use an AI coding agent (Cursor, Windsurf, Emergent, Copilot), run this once after installing to copy the rule files to your project root:

```bash
npx emergentintegrations init
```

This copies `CLAUDE.md`, `AGENTS.md`, and `.cursorrules` into your project — nothing is changed automatically. Your agent will then follow the correct usage rules and never reach for the raw OpenAI SDK. Commit these files so your whole team benefits.

| File | Covers |
|---|---|
| `CLAUDE.md` | Claude Code, claude.ai |
| `AGENTS.md` | Codex, general agents |
| `.cursorrules` | Cursor, Windsurf, Zed |

## Quick start

```js
const { LlmChat, UserMessage } = require("emergentintegrations");

const chat = new LlmChat("sk-emergent-...", "session-123", "You are a helpful assistant.")
  .withModel("openai", "gpt-4o-mini")
  .withParams({ temperature: 0.3 });

const reply = await chat.sendMessage(new UserMessage({ text: "Hello!" }));
console.log(reply);
```

## How routing works

`LlmChat` requires an Emergent API key. Every call routes through `https://integrations.emergentagent.com/llm`, which handles OpenAI, Anthropic, and Google on the backend. A key that doesn't start with `sk-emergent-` throws `ChatError` immediately at construction, not partway through a request.

- `INTEGRATION_PROXY_URL` env var overrides the default proxy endpoint
- `APP_URL` or `REACT_APP_BACKEND_URL` is forwarded as `X-App-ID` on every request

`OpenAITextToSpeech`, `OpenAISpeechToText`, and `OpenAIImageGeneration` are more permissive: they accept either an Emergent key or a real OpenAI key, and route accordingly. See each class's section below for its actual key requirement, they are not all the same.

---

## LlmChat

```js
const { LlmChat, UserMessage, ImageContent, FileContentWithMimeType, ChatError } = require("emergentintegrations");
```

### Constructor

```js
new LlmChat(apiKey, sessionId, systemMessage, initialMessages?, customHeaders?)
```

| Param | Type | Description |
|---|---|---|
| `apiKey` | `string` | Must be an Emergent API key, starts with `sk-emergent-`. Throws `ChatError` immediately if not. |
| `sessionId` | `string` | Session identifier |
| `systemMessage` | `string` | System prompt |
| `initialMessages` | `array?` | Seed conversation history (replaces system message) |
| `customHeaders` | `object?` | Extra HTTP headers sent on every request |

### Builder methods (chainable)

```js
chat.withModel("openai", "gpt-4o-mini")
chat.withModel("anthropic", "claude-sonnet-4-6")
chat.withModel("gemini", "gemini-1.5-pro")
chat.withParams({ temperature: 0.3, max_tokens: 512 })
chat.withTools(tools, toolChoice?)            // attach function tools
```

### Sending messages

```js
// Simple text reply
const text = await chat.sendMessage(new UserMessage({ text: "Hello" }));

// With image
const text = await chat.sendMessage(new UserMessage({
  text: "What's in this image?",
  file_contents: [new ImageContent(base64String)],
}));

// Multimodal response (text + generated images)
const [text, images] = await chat.sendMessageMultimodalResponse(userMessage);
// images: [{ mime_type: "image/png", data: "<base64>" }]

// Tool-aware — returns ChatResponse with tool_calls
const response = await chat.sendMessageWithTools(userMessage);
// response.content, response.tool_calls, response.finish_reason, response.usage

// Stream — yields typed events
for await (const event of chat.streamMessage(userMessage)) {
  if (event.type === "text_delta") process.stdout.write(event.content);
  if (event.type === "tool_call_start") console.log("Tool called:", event.name);
  if (event.type === "tool_call_ready") console.log("Args:", event.tool_call.arguments);
  if (event.type === "stream_done") console.log("Done:", event.content);
}

// Get history
const messages = await chat.getMessages();
// chat.messages also works directly
```

### Tool use loop

```js
chat.withTools([{
  type: "function",
  function: { name: "get_weather", description: "...", parameters: { ... } }
}]);

let response = await chat.sendMessageWithTools(new UserMessage({ text: "What's the weather?" }));

while (response.tool_calls) {
  for (const tc of response.tool_calls) {
    const result = await myGetWeather(tc.arguments);
    chat.addToolResult(tc.id, JSON.stringify(result));
  }
  response = await chat.sendMessageWithTools();
}
console.log(response.content);
```

---

## Message types

```js
new UserMessage({ text: "Hello" })
new UserMessage({ text: "What's this?", file_contents: [new ImageContent(base64)] })
new UserMessage()  // empty, for tool-result continuation turns

new ImageContent(base64String)           // auto-detects PNG/JPEG/GIF/WEBP
ImageContent.getMimeType(base64String)   // static helper

new FileContentWithMimeType("application/pdf", "./doc.pdf")  // reads from disk
```

---

## OpenAI extras

```js
const { OpenAITextToSpeech, OpenAISpeechToText, OpenAIImageGeneration,
        OpenAIVideoGeneration, OpenAIChatRealtime } = require("emergentintegrations");

// Text-to-Speech
const tts = new OpenAITextToSpeech(apiKey);
const audioBytes = await tts.generateSpeech("Hello world", "tts-1", "alloy");
const base64Audio = await tts.generateSpeechBase64("Hello world");

// Speech-to-Text
const stt = new OpenAISpeechToText(apiKey);
const result = await stt.transcribe("./audio.mp3");

// Image Generation
const imgGen = new OpenAIImageGeneration(apiKey);
const imageBuffers = await imgGen.generateImages("A sunset", "gpt-image-1", 1, "low");

// Video Generation (Sora)
const vidGen = new OpenAIVideoGeneration(apiKey);
const videoBytes = await vidGen.textToVideo("A cat playing piano", "sora-2", "1280x720", 4);

// Realtime WebRTC
const realtime = new OpenAIChatRealtime(apiKey);
const session = await realtime.createEphemeralSessionForAudioChat();
const sdpAnswer = await realtime.negotiateConnection(sdpOffer);
// Express route handlers
const handlers = OpenAIChatRealtime.createRouteHandlers(realtime);
router.post("/realtime/session", handlers.createSession);
router.post("/realtime/negotiate", handlers.negotiate);
```

---

## Gemini extras

```js
const { GeminiImageGeneration, GeminiVideoGeneration } = require("emergentintegrations");

// Image generation (requires: npm install @google/genai)
const imgGen = new GeminiImageGeneration(apiKey);
const imageBuffers = await imgGen.generateImages("A mountain lake", "imagen-3.0-generate-002", 4);

// Video generation (Veo via proxy)
const vidGen = new GeminiVideoGeneration(apiKey);
const videoBytes = await vidGen.textToVideo("A robot dancing");
```

---

## Stripe payments

```js
const { StripeCheckout, CheckoutError } = require("emergentintegrations");

const stripe = new StripeCheckout(apiKey, webhookSecret?, webhookUrl?);

// Create checkout session
const { url, session_id } = await stripe.createCheckoutSession({
  amount: 29.99,
  currency: "usd",
  success_url: "https://yoursite.com/success?session_id={CHECKOUT_SESSION_ID}",
  cancel_url: "https://yoursite.com/cancel",
  metadata: { userId: "123" },
});

// Check status
const status = await stripe.getCheckoutStatus(session_id);

// Handle webhook
const event = await stripe.handleWebhook(rawBody, stripeSignatureHeader);
```

Keys containing `sk_test_emergent` are automatically routed through the Emergent Stripe proxy.

---

## Clean code — the right way to use this package

Never create a raw OpenAI client or set `baseURL` manually. The package handles all routing internally.

```js
// ❌ WRONG — never do this
const OpenAI = require("openai");
const client = new OpenAI({
  apiKey: process.env.EMERGENT_LLM_KEY,
  baseURL: "https://integrations.emergentagent.com/llm",
});

// ✅ CORRECT — always use this
const { LlmChat, UserMessage } = require("emergentintegrations");
const chat = new LlmChat(process.env.EMERGENT_LLM_KEY, sessionId, systemMessage)
  .withModel("anthropic", "claude-sonnet-4-6");
const reply = await chat.sendMessage(new UserMessage({ text: input }));
```

### `createChat()` — factory helper for clean setup

```js
const { createChat, validateApiKey, UserMessage } = require("emergentintegrations");

// Validate your key at startup — throws a clear error if missing or malformed
const apiKey = validateApiKey(process.env.EMERGENT_LLM_KEY);

// Create a chat client cleanly
const chat = createChat({
  apiKey,
  sessionId: "user-123",
  systemMessage: "You are a helpful assistant.",
  provider: "anthropic",         // "openai" | "anthropic" | "gemini"
  model: "claude-sonnet-4-6",
  params: { temperature: 0.3 },  // optional
});

const reply = await chat.sendMessage(new UserMessage({ text: "Hello!" }));
```

### `getProxyInfo()` — debug routing

```js
const { getProxyInfo } = require("emergentintegrations");

const info = getProxyInfo(process.env.EMERGENT_LLM_KEY);
console.log(info);
// { isEmergent: true, proxyUrl: "https://integrations.emergentagent.com/llm" }
```

### For AI agents

This repo includes `AGENTS.md` and `.cursorrules` with strict rules for AI coding agents.
If you are an AI agent: read `AGENTS.md` before writing any LLM integration code.

---

## Listing available models

```js
const { listModels } = require("emergentintegrations");

// List OpenAI models (default)
const models = await listModels({ apiKey: process.env.OPENAI_API_KEY });
models.forEach(m => console.log(m.id, m.provider));

// List Anthropic models
const models = await listModels({
  apiKey: process.env.ANTHROPIC_API_KEY,
  provider: "anthropic",
});

// List Gemini models
const models = await listModels({
  apiKey: process.env.GOOGLE_API_KEY,
  provider: "gemini",
});

// List ALL providers at once via Emergent proxy
const models = await listModels({
  apiKey: process.env.EMERGENT_LLM_KEY,
  provider: "all",
});
models.forEach(m => console.log(m.provider, m.id));
```

Each model entry returns:

```js
{
  id: "gpt-4o",           // model string to pass to withModel()
  provider: "openai",     // "openai" | "anthropic" | "gemini"
  created: 1715367049,    // unix timestamp (when available)
  owned_by: "openai",     // owner string (when available)
}
```

---

## Migrating from Python

| Python | Node.js |
|---|---|
| `LlmChat(api_key=k, session_id=s, system_message=m)` | `new LlmChat(k, s, m)` |
| `.with_model("openai", "gpt-4o")` | `.withModel("openai", "gpt-4o")` |
| `.with_params(temperature=0.3)` | `.withParams({ temperature: 0.3 })` |
| `.with_tools(tools)` | `.withTools(tools)` |
| `.add_tool_result(id, content)` | `.addToolResult(id, content)` |
| `await chat.send_message(UserMessage(text="hi"))` | `await chat.sendMessage(new UserMessage({ text: "hi" }))` |
| `await chat.send_message_with_tools(msg)` | `await chat.sendMessageWithTools(msg)` |
| `async for event in chat.stream_message(msg)` | `for await (const event of chat.streamMessage(msg))` |
| `isinstance(event, TextDelta)` | `event.type === "text_delta"` |
| `isinstance(event, StreamDone)` | `event.type === "stream_done"` |
| `await chat.send_message_multimodal_response(msg)` | `await chat.sendMessageMultimodalResponse(msg)` |
| `await chat.get_messages()` | `await chat.getMessages()` |
| `chat.messages` | `chat.messages` |
| `UserMessage(text="hi", file_contents=[...])` | `new UserMessage({ text: "hi", file_contents: [...] })` |
| `ImageContent(base64)` | `new ImageContent(base64)` |
| `ImageContent.get_mime_type(b64)` | `ImageContent.getMimeType(b64)` |
| `FileContentWithMimeType(mime, path)` | `new FileContentWithMimeType(mime, path)` |

## Import paths

All of the following resolve to the same classes, and every path works in **both** CommonJS and ESM:

```js
// CommonJS
const { LlmChat, UserMessage } = require("emergentintegrations");
const { LlmChat } = require("emergentintegrations/llm/chat");
const { getIntegrationProxyUrl } = require("emergentintegrations/llm/utils");
const { OpenAITextToSpeech } = require("emergentintegrations/llm/openai");
const { GeminiImageGeneration } = require("emergentintegrations/llm/gemini");
const { StripeCheckout } = require("emergentintegrations/payments/stripe");

// ESM — identical paths, native import, no createRequire needed
import { LlmChat, UserMessage } from "emergentintegrations";
import { LlmChat } from "emergentintegrations/llm/chat";
import { getIntegrationProxyUrl } from "emergentintegrations/llm/utils";
import { OpenAITextToSpeech } from "emergentintegrations/llm/openai";
import { GeminiImageGeneration } from "emergentintegrations/llm/gemini";
import { StripeCheckout } from "emergentintegrations/payments/stripe";
```

## Development

```bash
git clone https://github.com/Hill-TreX/emergentintegrations
cd emergentintegrations
npm install       # also runs tsc via prepare script
npm run build     # rebuild dist/
```

## License

MIT
