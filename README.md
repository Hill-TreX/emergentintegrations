# emergentintegrations

A small async chat client for Node.js, built on top of the [OpenAI SDK](https://github.com/openai/openai-node). Works with any OpenAI-compatible endpoint, and routes through the Emergent integration proxy when given an `sk-emergent-*` key.

## Install

```bash
npm install github:Hill-TreX/emergentintegrations
```

Or install locally:

```bash
npm install ./emergentintegrations
```

## Quick start

```js
import { LlmChat, UserMessage, ImageContent } from "emergentintegrations";

const chat = new LlmChat({
  apiKey: "sk-...",           // OpenAI key, or sk-emergent-* for proxy routing
  sessionId: "abc-123",
  systemMessage: "You are a concise assistant.",
})
  .withModel("openai", "gpt-4o-mini")
  .withParams({ temperature: 0.3 });

const reply = await chat.sendMessage(new UserMessage({ text: "Give me a haiku about JavaScript." }));
console.log(reply);

// With an image attachment
const withImage = new UserMessage({
  text: "What is in this picture?",
  fileContents: [new ImageContent("/9j/4AAQSkZJRg...")],   // JPEG base64
});
const reply2 = await chat.sendMessage(withImage);
console.log(reply2);
```

## How routing works

- **Plain key** (`sk-...`, or any OpenAI-compatible provider key) — the SDK talks directly to the OpenAI API (or to whatever endpoint you pass via `baseUrl`).
- **Emergent key** (`sk-emergent-*`) — the SDK sets `baseURL` to `${INTEGRATION_PROXY_URL:-https://integrations.emergentagent.com}/llm` and lets the Emergent proxy dispatch to the underlying model.
- If `APP_URL` or `REACT_APP_BACKEND_URL` is set, an `X-App-ID` header is added automatically so the proxy can attribute the call.

Environment variables, all optional:

| Name | Purpose |
| --- | --- |
| `INTEGRATION_PROXY_URL` | Override the default Emergent proxy endpoint. |
| `APP_URL` | App identifier forwarded as `X-App-ID`. |
| `REACT_APP_BACKEND_URL` | Fallback when `APP_URL` is unset. |

## API surface

### `new LlmChat(options)`

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | ✅ | Provider key or `sk-emergent-*` for proxy routing |
| `sessionId` | `string` | ✅ | Session identifier for conversation tracking |
| `systemMessage` | `string` | — | System prompt |
| `initialMessages` | `UserMessage[]` | — | Seed conversation history |
| `customHeaders` | `object` | — | Extra HTTP headers |
| `baseUrl` | `string` | — | Override base URL entirely |

### `.withModel(provider, model)` → chainable

Sets the target model string.

```js
chat.withModel("openai", "gpt-4o-mini")
chat.withModel("anthropic", "claude-sonnet-4-6")   // via Emergent proxy
chat.withModel("google", "gemini-1.5-pro")          // via Emergent proxy
```

### `.withParams(params)` → chainable

Extra kwargs forwarded to `chat.completions.create`.

```js
chat.withParams({ temperature: 0.3, max_tokens: 512 })
```

### `.sendMessage(userMessage)` → `Promise<string>`

Async. Sends a message and returns assistant text. Conversation history is maintained automatically.

```js
const reply = await chat.sendMessage(new UserMessage({ text: "Hello!" }));
```

### `.sendMessageMultimodalResponse(userMessage)` → `Promise<[string, images]>`

Async. Returns `[text, images]` where `images` is a list of `{ mimeType, data }` when the upstream response carries generated images (e.g. via Gemini through the Emergent proxy).

```js
const [text, images] = await chat.sendMessageMultimodalResponse(userMessage);
```

### `.stream(userMessage)` → `AsyncGenerator<string>`

Streams the response as it arrives, yielding string chunks.

```js
for await (const chunk of chat.stream(new UserMessage({ text: "Tell me a story" }))) {
  process.stdout.write(chunk);
}
```

### `chat.sessionHistory`

Getter. Returns the full conversation history as an array of plain objects.

```js
console.log(chat.sessionHistory);
// [{ role: "user", content: "..." }, { role: "assistant", content: "..." }]
```

### `chat.clearHistory()`

Resets session history.

---

### `new UserMessage({ text, fileContents? })`

A user message, optionally with file or image attachments.

```js
// Text only
new UserMessage({ text: "Hello" })
new UserMessage("Hello")   // shorthand string

// With image
new UserMessage({
  text: "What's in this image?",
  fileContents: [new ImageContent(base64String)],
})

// With file
new UserMessage({
  text: "Summarize this document",
  fileContents: [new FileContentWithMimeType("application/pdf", "./doc.pdf")],
})
```

### `new ImageContent(imageBase64)`

Built from a base64 string. Infers mime type from the base64 header (PNG/JPEG/GIF/WEBP).

```js
new ImageContent("/9j/4AAQSkZJRg...")   // JPEG
new ImageContent("iVBORw0KGgo...")      // PNG
```

### `new FileContentWithMimeType(mimeType, filePath)`

Reads a file from disk and packages it with an explicit mime type.

```js
new FileContentWithMimeType("image/png", "./screenshot.png")
new FileContentWithMimeType("application/pdf", "./report.pdf")
```

All of the above are importable from either `emergentintegrations` or `emergentintegrations/llm`:

```js
import { LlmChat, UserMessage, ImageContent, FileContentWithMimeType } from "emergentintegrations";
import { LlmChat, UserMessage } from "emergentintegrations/llm";
```

---

## Examples

### Express API route

```js
import express from "express";
import { LlmChat, UserMessage } from "emergentintegrations";

const app = express();
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  const { message, sessionId } = req.body;

  const chat = new LlmChat({
    apiKey: process.env.EMERGENT_LLM_KEY,
    sessionId,
    systemMessage: "You are a helpful assistant.",
  }).withModel("openai", "gpt-4o-mini");

  const reply = await chat.sendMessage(new UserMessage({ text: message }));
  res.json({ reply });
});
```

### Streaming in Express

```js
app.post("/api/chat/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");

  const chat = new LlmChat({
    apiKey: process.env.EMERGENT_LLM_KEY,
    sessionId: req.body.sessionId,
    systemMessage: "You are a helpful assistant.",
  }).withModel("openai", "gpt-4o-mini");

  for await (const chunk of chat.stream(new UserMessage({ text: req.body.message }))) {
    res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
  }

  res.end();
});
```

### Vision / image analysis

```js
import { LlmChat, UserMessage, ImageContent } from "emergentintegrations";
import fs from "fs";

const imageBase64 = fs.readFileSync("./photo.jpg").toString("base64");

const chat = new LlmChat({
  apiKey: process.env.OPENAI_API_KEY,
  sessionId: "vision-session",
}).withModel("openai", "gpt-4o");

const reply = await chat.sendMessage(
  new UserMessage({
    text: "Describe what you see in this image.",
    fileContents: [new ImageContent(imageBase64)],
  })
);

console.log(reply);
```

### Multi-turn conversation

```js
const chat = new LlmChat({
  apiKey: process.env.OPENAI_API_KEY,
  sessionId: "convo-001",
}).withModel("openai", "gpt-4o-mini");

await chat.sendMessage(new UserMessage({ text: "My name is Hilton." }));
await chat.sendMessage(new UserMessage({ text: "I run two SaaS products." }));
const summary = await chat.sendMessage(new UserMessage({ text: "What do you know about me?" }));
// → "Your name is Hilton and you run two SaaS products."
```

### Using Claude or Gemini via Emergent proxy

```js
// Claude via Emergent proxy
const claudeChat = new LlmChat({
  apiKey: process.env.EMERGENT_LLM_KEY,   // must be sk-emergent-* key
  sessionId: "claude-session",
  systemMessage: "You are a helpful assistant.",
}).withModel("anthropic", "claude-sonnet-4-6");

// Gemini via Emergent proxy
const geminiChat = new LlmChat({
  apiKey: process.env.EMERGENT_LLM_KEY,
  sessionId: "gemini-session",
}).withModel("google", "gemini-1.5-pro");
```

---

## Migrating from Python

This package mirrors the Python `emergentintegrations` API exactly.

| Python | Node.js |
|---|---|
| `from emergentintegrations import LlmChat, UserMessage, ImageContent` | `import { LlmChat, UserMessage, ImageContent } from "emergentintegrations"` |
| `LlmChat(api_key=k, session_id=s, system_message=m)` | `new LlmChat({ apiKey: k, sessionId: s, systemMessage: m })` |
| `.with_model("openai", "gpt-4o-mini")` | `.withModel("openai", "gpt-4o-mini")` |
| `.with_params(temperature=0.3)` | `.withParams({ temperature: 0.3 })` |
| `await chat.send_message(UserMessage(text="hi"))` | `await chat.sendMessage(new UserMessage({ text: "hi" }))` |
| `await chat.send_message_multimodal_response(msg)` | `await chat.sendMessageMultimodalResponse(msg)` |
| `ImageContent(base64_string)` | `new ImageContent(base64String)` |
| `FileContentWithMimeType(mime, path)` | `new FileContentWithMimeType(mime, path)` |
| `chat.session_history` | `chat.sessionHistory` |

---

## Development

```bash
git clone https://github.com/Hill-TreX/emergentintegrations
cd emergentintegrations
npm install
node tests/test.js

# With live API tests
OPENAI_API_KEY=sk-... node tests/test.js
EMERGENT_LLM_KEY=sk-emergent-... node tests/test.js
```

## License

MIT
