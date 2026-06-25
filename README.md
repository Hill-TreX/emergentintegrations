# emergentintegrations

Node.js/TypeScript port of the Python [`emergentintegrations`](https://github.com/emergentbase/emergentintegrations) package (v0.2.0). Unified interface for LLM chat, image generation, video generation, text-to-speech, speech-to-text, and Stripe payments — with built-in Emergent proxy support.

## Install

```bash
npm install github:Hill-TreX/emergentintegrations
```

Dependencies are installed automatically. If you use Gemini image generation, also run:

```bash
npm install @google/genai
```

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

- **`sk-emergent-*` key** → routes through `https://integrations.emergentagent.com/llm` (proxy handles Anthropic, Google, OpenAI)
- **Any other key** → talks directly to the OpenAI API (or your custom `baseURL`)
- `INTEGRATION_PROXY_URL` env var overrides the default proxy endpoint
- `APP_URL` or `REACT_APP_BACKEND_URL` is forwarded as `X-App-ID` on every request

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
| `apiKey` | `string` | Provider key or `sk-emergent-*` for proxy routing |
| `sessionId` | `string` | Session identifier |
| `systemMessage` | `string` | System prompt |
| `initialMessages` | `array?` | Seed conversation history (replaces system message) |
| `customHeaders` | `object?` | Extra HTTP headers sent on every request |

### Builder methods (chainable)

```js
chat.withModel("openai", "gpt-4o-mini")      // provider + model
chat.withModel("anthropic", "claude-sonnet-4-6") // via sk-emergent-* proxy
chat.withModel("gemini", "gemini-1.5-pro")    // via sk-emergent-* proxy
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

All of the following resolve to the same classes:

```js
// Root
const { LlmChat, UserMessage } = require("emergentintegrations");

// LLM submodule
const { LlmChat, UserMessage } = require("emergentintegrations/llm");
const { LlmChat, UserMessage } = require("emergentintegrations/llm/chat");

// OpenAI compat path (mirrors Python's llm.openai import)
const { LlmChat, UserMessage, OpenAITextToSpeech } = require("emergentintegrations/llm/openai");

// Gemini
const { GeminiImageGeneration } = require("emergentintegrations/llm/gemini");

// Payments
const { StripeCheckout } = require("emergentintegrations/payments/stripe");
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
