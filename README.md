# emergentintegrations

<p align="center">
  <b>Unified LLM client for Node.js — OpenAI, Anthropic, and Google through one consistent API</b>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/emergentintegrations"><img src="https://img.shields.io/npm/v/emergentintegrations.svg" alt="npm version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="Node.js >= 18">
</p>

---

Node.js replica of the Python `emergentintegrations` package used by [Emergent](https://emergentagent.com). Drop-in replacement for projects migrating from Python to Node.js, or for any Node/Express/Fastify backend that needs a clean, unified LLM interface.

## Features

- **One class, three providers** — `LlmChat` auto-detects whether to use Anthropic, OpenAI, or Google from the model name
- **Single key support** — works with `EMERGENT_LLM_KEY` (routes to all providers) or direct provider keys
- **Conversation history** — maintained automatically across `.chat()` calls
- **Streaming** — first-class async generator streaming via `.stream()`
- **Python API parity** — same class names, same method names (`.send()`, `UserMessage`, `AssistantMessage`)
- **TypeScript** — full `.d.ts` types included
- **Zero config** — no setup, no wrappers, just instantiate and call

## Installation

```bash
# From npm (once published)
npm install emergentintegrations

# Or directly from this repo
npm install github:Hill-TreX/emergentintegrations
```

Install peer dependencies (providers you plan to use):

```bash
npm install @anthropic-ai/sdk openai @google/generative-ai
```

## Quick Start

```js
import { LlmChat, UserMessage } from "emergentintegrations";

const chat = new LlmChat({
  apiKey: process.env.EMERGENT_LLM_KEY,
  model: "claude-sonnet-4-6",
  systemMessage: "You are a helpful assistant.",
});

const response = await chat.chat("Hello!");
console.log(response);
```

## Usage

### Constructor

```js
const chat = new LlmChat({
  apiKey: "your-key",           // required — EMERGENT_LLM_KEY or provider key
  model: "claude-sonnet-4-6",  // required — provider auto-detected from model name
  systemMessage: "...",         // optional — system prompt
  baseUrl: "https://...",       // optional — custom base URL / proxy endpoint
  defaultParams: {},            // optional — { temperature, max_tokens, ... }
  history: [],                  // optional — seed conversation history
});
```

**Provider auto-detection from model name:**

| Model prefix | Provider |
|---|---|
| `claude-*` | Anthropic |
| `gpt-*`, `o1-*`, `o3-*`, `o4-*` | OpenAI |
| `gemini-*` | Google |

### `.chat(input, params?)`

Send a message and get a full response string back. Conversation history is maintained automatically.

```js
// Plain string
const res = await chat.chat("What is 2 + 2?");

// UserMessage object — mirrors Python API exactly
const res = await chat.chat(new UserMessage("What is 2 + 2?"));

// Array of messages
const res = await chat.chat([
  new UserMessage("My name is Hilton."),
  new UserMessage("What is my name?"),
]);
```

### `.send(input, params?)`

Alias for `.chat()`. Mirrors the Python package's `.send()` method name exactly.

```js
// Python: await chat.send(UserMessage(content="Hello"))
// Node:
const res = await chat.send(new UserMessage("Hello"));
```

### `.stream(input, params?)`

Stream the response as it arrives. Returns an async generator yielding string chunks.

```js
for await (const chunk of chat.stream("Tell me a long story")) {
  process.stdout.write(chunk);
}
```

### `.clearHistory()`

Reset conversation history.

```js
chat.clearHistory();
```

### `.getHistory()`

Returns history as plain objects.

```js
const history = chat.getHistory();
// [{ role: "user", content: "..." }, { role: "assistant", content: "..." }]
```

## Examples

### Anthropic (Claude)

```js
import { LlmChat, UserMessage } from "emergentintegrations";

const chat = new LlmChat({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-sonnet-4-6",
  systemMessage: "You are a helpful assistant.",
});

const response = await chat.chat("Explain async/await in JavaScript.");
console.log(response);
```

### OpenAI (GPT)

```js
const chat = new LlmChat({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o",
  systemMessage: "You are a helpful assistant.",
});

const response = await chat.chat("What is the capital of France?");
console.log(response);
```

### Google (Gemini)

```js
const chat = new LlmChat({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-1.5-pro",
  systemMessage: "You are a helpful assistant.",
});

const response = await chat.chat("Summarize the theory of relativity.");
console.log(response);
```

### With Emergent Universal Key (all providers, one key)

```js
// Anthropic via Emergent proxy
const claudeChat = new LlmChat({
  apiKey: process.env.EMERGENT_LLM_KEY,
  model: "claude-sonnet-4-6",
  baseUrl: "https://integrations.emergentagent.com",
  systemMessage: "You are a helpful assistant.",
});

// OpenAI via Emergent proxy
const gptChat = new LlmChat({
  apiKey: process.env.EMERGENT_LLM_KEY,
  model: "gpt-4o",
  baseUrl: "https://integrations.emergentagent.com",
});

// Google via Emergent proxy
const geminiChat = new LlmChat({
  apiKey: process.env.EMERGENT_LLM_KEY,
  model: "gemini-1.5-pro",
  baseUrl: "https://integrations.emergentagent.com",
});
```

### Multi-turn conversation

```js
const chat = new LlmChat({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-sonnet-4-6",
});

await chat.chat("My name is Hilton.");
await chat.chat("I run two SaaS products.");
const summary = await chat.chat("What do you know about me?");
// → "Your name is Hilton and you run two SaaS products."
```

### Streaming in Express

```js
import express from "express";
import { LlmChat } from "emergentintegrations";

const app = express();
app.use(express.json());

app.post("/api/chat/stream", async (req, res) => {
  const { message } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");

  const chat = new LlmChat({
    apiKey: process.env.EMERGENT_LLM_KEY,
    model: "claude-sonnet-4-6",
    baseUrl: "https://integrations.emergentagent.com",
    systemMessage: "You are a helpful assistant.",
  });

  for await (const chunk of chat.stream(message)) {
    res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
  }

  res.end();
});
```

### Custom parameters per call

```js
const chat = new LlmChat({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o",
  defaultParams: { temperature: 0.3 },
});

// Override temperature for this call only
const creative = await chat.chat("Write a poem", { temperature: 0.95 });
```

## Migrating from Python

This package is a direct replica of the Python `emergentintegrations` package. Migration is line-for-line:

| Python | Node.js |
|---|---|
| `from emergentintegrations.llm.chat import LlmChat, UserMessage` | `import { LlmChat, UserMessage } from "emergentintegrations"` |
| `LlmChat(api_key=k, model=m, system_message=s)` | `new LlmChat({ apiKey: k, model: m, systemMessage: s })` |
| `await chat.send(UserMessage(content="hi"))` | `await chat.send(new UserMessage("hi"))` |
| `await chat.send(UserMessage(content="hi"))` | `await chat.chat("hi")` |
| `chat.session_history` | `chat.getHistory()` |

## Environment Variables

```bash
# Emergent Universal Key — routes to all providers
EMERGENT_LLM_KEY=your_emergent_key

# Or use direct provider keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AIza...
```

## Running Tests

```bash
# Unit tests only — no API key needed
node tests/test.js

# With live API tests
ANTHROPIC_API_KEY=sk-ant-... node tests/test.js
OPENAI_API_KEY=sk-... node tests/test.js
EMERGENT_LLM_KEY=your-key node tests/test.js
```

## Project Structure

```
emergentintegrations/
├── src/
│   ├── index.js          # Main entry point
│   ├── index.d.ts        # TypeScript definitions
│   └── llm/
│       ├── chat.js       # LlmChat, UserMessage, AssistantMessage
│       └── index.js      # LLM submodule exports
├── tests/
│   └── test.js           # Unit + live API tests
├── package.json
└── README.md
```

## License

MIT
