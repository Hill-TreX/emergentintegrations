# emergentintegrations

A small async chat client for Node.js, built on top of the [OpenAI SDK](https://github.com/openai/openai-node). Works with any OpenAI-compatible endpoint, and routes through the Emergent integration proxy when given an `sk-emergent-*` key.

Node.js replica of the Python [`emergentintegrations`](https://github.com/emergentbase/emergentintegrations) package — identical API, identical behaviour.

## Install

```bash
npm install github:Hill-TreX/emergentintegrations
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
  file_contents: [new ImageContent("/9j/4AAQSkZJRg...")],   // JPEG base64
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

### `new LlmChat({ apiKey, sessionId, systemMessage, initialMessages?, customHeaders?, baseUrl? })`

- **`apiKey`** *(required)* — Provider key or `sk-emergent-*` for proxy routing.
- **`sessionId`** *(required)* — Session identifier for conversation tracking.
- **`systemMessage`** *(required)* — System prompt prepended to every conversation.
- **`initialMessages`** — Seed conversation history (replaces the default system message entry).
- **`customHeaders`** — Extra HTTP headers sent with every request.
- **`baseUrl`** — Override the base URL entirely.

### `.withModel(provider, model)` → chainable

Sets the target model string. `provider` is accepted for backwards compatibility — dispatching happens at the proxy or via `baseUrl`.

```js
chat.withModel("openai", "gpt-4o-mini")
chat.withModel("anthropic", "claude-sonnet-4-6")   // via sk-emergent-* proxy
chat.withModel("google", "gemini-1.5-pro")          // via sk-emergent-* proxy
```

### `.withParams(params)` → chainable

Extra kwargs forwarded to `chat.completions.create`.

```js
chat.withParams({ temperature: 0.3, max_tokens: 512 })
```

### `async .sendMessage(userMessage)` → `string`

Sends a message and returns assistant text. Conversation history (`this.messages`) is updated automatically. Throws `ChatError` on failure.

```js
const reply = await chat.sendMessage(new UserMessage({ text: "Hello!" }));
```

### `async .sendMessageMultimodalResponse(userMessage)` → `[text, images]`

Returns `[text, images]` where `images` is a list of `{ mime_type, data }` when the upstream response carries generated images (e.g. via Gemini through the Emergent proxy). For plain OpenAI completions, `images` is always `[]`.

```js
const [text, images] = await chat.sendMessageMultimodalResponse(userMessage);
```

### `async* .stream(userMessage)` → `AsyncGenerator<string>`

Streams the response as it arrives, yielding string chunks. History is updated after the stream completes.

```js
for await (const chunk of chat.stream(new UserMessage({ text: "Tell me a story" }))) {
  process.stdout.write(chunk);
}
```

### `async .getMessages()` → `object[]`

Returns the full conversation history.

```js
const history = await chat.getMessages();
```

### `chat.messages`

Public property. The raw conversation history array, same as in Python.

---

### `new UserMessage({ text?, file_contents? })`

A user message with optional file or image attachments.

```js
new UserMessage({ text: "Hello" })
new UserMessage({ text: "What's in this image?", file_contents: [new ImageContent(base64)] })
new UserMessage({ text: "Summarize this", file_contents: [new FileContentWithMimeType("application/pdf", "./doc.pdf")] })
```

### `new ImageContent(imageBase64)`

Extends `FileContent`. Infers mime type from the base64 header (PNG/JPEG/GIF/WEBP).

```js
new ImageContent("/9j/4AAQSkZJRg...")   // JPEG — inferred automatically
new ImageContent("iVBORw0KGgo...")      // PNG  — inferred automatically
```

**Static method:** `ImageContent.getMimeType(base64)` — returns the inferred mime type string.

### `new FileContentWithMimeType(mimeType, filePath)`

Extends `FileContent`. Reads a file from disk and packages it with an explicit mime type.

```js
new FileContentWithMimeType("image/png", "./screenshot.png")
new FileContentWithMimeType("application/pdf", "./report.pdf")
```

### `class FileContent`

Base class for all file attachments. Has `content_type` and `file_content_base64` properties.

### `class ChatError extends Error`

Thrown by `sendMessage()` and `sendMessageMultimodalResponse()` when the API call fails or returns a malformed response.

All of the above are importable from any of these paths (all equivalent):

```js
import { LlmChat, UserMessage, ImageContent, FileContent, FileContentWithMimeType, ChatError } from "emergentintegrations";
import { LlmChat, UserMessage } from "emergentintegrations/llm";
import { LlmChat, UserMessage } from "emergentintegrations/llm/chat";
import { LlmChat, UserMessage } from "emergentintegrations/llm/openai";  // legacy compat shim
```

---

## Examples

### Multi-turn conversation

```js
const chat = new LlmChat({
  apiKey: process.env.OPENAI_API_KEY,
  sessionId: "convo-001",
  systemMessage: "You are a helpful assistant.",
}).withModel("openai", "gpt-4o-mini");

await chat.sendMessage(new UserMessage({ text: "My name is Hilton." }));
await chat.sendMessage(new UserMessage({ text: "I run two SaaS products." }));
const reply = await chat.sendMessage(new UserMessage({ text: "What do you know about me?" }));
```

### Vision / image analysis

```js
import { LlmChat, UserMessage, ImageContent } from "emergentintegrations";
import fs from "fs";

const b64 = fs.readFileSync("./photo.jpg").toString("base64");

const chat = new LlmChat({
  apiKey: process.env.OPENAI_API_KEY,
  sessionId: "vision-001",
  systemMessage: "Describe images concisely.",
}).withModel("openai", "gpt-4o");

const reply = await chat.sendMessage(new UserMessage({
  text: "What do you see?",
  file_contents: [new ImageContent(b64)],
}));
```

### Express API route with streaming

```js
import express from "express";
import { LlmChat, UserMessage } from "emergentintegrations";

const app = express();
app.use(express.json());

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

  res.write("data: [DONE]\n\n");
  res.end();
});
```

### Claude or Gemini via Emergent proxy

```js
// Claude
const claudeChat = new LlmChat({
  apiKey: process.env.EMERGENT_LLM_KEY,
  sessionId: "claude-001",
  systemMessage: "You are a helpful assistant.",
}).withModel("anthropic", "claude-sonnet-4-6");

// Gemini
const geminiChat = new LlmChat({
  apiKey: process.env.EMERGENT_LLM_KEY,
  sessionId: "gemini-001",
  systemMessage: "You are a helpful assistant.",
}).withModel("google", "gemini-1.5-pro");
```

---

## Migrating from Python

This package is a 1:1 replica of the Python `emergentintegrations` package.

| Python | Node.js |
|---|---|
| `from emergentintegrations import LlmChat, UserMessage, ImageContent` | `import { LlmChat, UserMessage, ImageContent } from "emergentintegrations"` |
| `from emergentintegrations.llm.chat import LlmChat` | `import { LlmChat } from "emergentintegrations/llm/chat"` |
| `from emergentintegrations.llm.openai import LlmChat` | `import { LlmChat } from "emergentintegrations/llm/openai"` |
| `LlmChat(api_key=k, session_id=s, system_message=m)` | `new LlmChat({ apiKey: k, sessionId: s, systemMessage: m })` |
| `.with_model("openai", "gpt-4o")` | `.withModel("openai", "gpt-4o")` |
| `.with_params(temperature=0.3)` | `.withParams({ temperature: 0.3 })` |
| `await chat.send_message(UserMessage(text="hi"))` | `await chat.sendMessage(new UserMessage({ text: "hi" }))` |
| `await chat.send_message_multimodal_response(msg)` | `await chat.sendMessageMultimodalResponse(msg)` |
| `await chat.get_messages()` | `await chat.getMessages()` |
| `chat.messages` | `chat.messages` |
| `ImageContent(base64)` | `new ImageContent(base64)` |
| `ImageContent.get_mime_type(b64)` | `ImageContent.getMimeType(b64)` |
| `FileContentWithMimeType(mime, path)` | `new FileContentWithMimeType(mime, path)` |
| `UserMessage(text="hi", file_contents=[...])` | `new UserMessage({ text: "hi", file_contents: [...] })` |
| `ChatError` | `ChatError` |

---

## Development

```bash
git clone https://github.com/Hill-TreX/emergentintegrations
cd emergentintegrations
npm install

# Unit tests (no API key needed)
node tests/test.js

# With live API tests
OPENAI_API_KEY=sk-... node tests/test.js
EMERGENT_LLM_KEY=sk-emergent-... node tests/test.js
```

## License

MIT
