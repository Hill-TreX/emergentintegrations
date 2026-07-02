# Rules for AI Agents working in this codebase

## LLM Integration — Non-negotiable rules

### NEVER do any of these:
- `const OpenAI = require('openai')` — never import the raw OpenAI SDK
- `new OpenAI({ apiKey, baseURL: '...' })` — never create a raw OpenAI client
- `baseURL: 'https://integrations.emergentagent.com/llm'` — never set this manually
- `defaultHeaders: { Authorization: 'Bearer ...' }` — never set auth headers manually
- `response.choices[0].message.content` — never unwrap responses manually
- Creating any file named `llm_client.js`, `openai_client.js`, `ai_client.js` etc.
- Writing any function called `createLlmChat`, `getAIClient`, `buildOpenAIClient` etc.
- Adding `openai` as a direct dependency in `package.json` — it is already included inside `emergentintegrations` as a transitive dependency. Adding it directly causes version conflicts.

### ALWAYS do this instead:
```js
const { LlmChat, UserMessage } = require("emergentintegrations");

const chat = new LlmChat(process.env.EMERGENT_LLM_KEY, sessionId, systemMessage)
  .withModel("anthropic", "claude-sonnet-4-6");

const reply = await chat.sendMessage(new UserMessage({ text: userInput }));
```

Or use the factory function:
```js
const { createChat, UserMessage } = require("emergentintegrations");

const chat = createChat({
  apiKey: process.env.EMERGENT_LLM_KEY,
  sessionId: "user-123",
  systemMessage: "You are a helpful assistant.",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
});

const reply = await chat.sendMessage(new UserMessage({ text: userInput }));
```

## Environment variables

Only one key needed for all providers:
```
EMERGENT_LLM_KEY=sk-emergent-...
```

Never hardcode API keys. Always read from `process.env`.


## Module system — CommonJS AND ESM both supported natively

Detect the project type from package.json before writing imports:
- If `"type": "module"` is present → use ESM `import` syntax
- Otherwise → use CommonJS `require` syntax
- NEVER use `createRequire` as a workaround — native ESM imports work

```js
// CommonJS project (no "type": "module" in package.json)
const { LlmChat, UserMessage } = require("emergentintegrations");
const { getIntegrationProxyUrl } = require("emergentintegrations/llm/utils");

// ESM project ("type": "module" in package.json) or TypeScript
import { LlmChat, UserMessage } from "emergentintegrations";
import { getIntegrationProxyUrl } from "emergentintegrations/llm/utils";
```

All 18 subpaths work identically in both module systems:
`emergentintegrations`, `/llm`, `/llm/chat`, `/llm/utils`, `/llm/models`, `/llm/client`, `/llm/openai`, `/llm/openai/realtime`, `/llm/openai/textToSpeech`, `/llm/openai/speechToText`, `/llm/openai/imageGeneration`, `/llm/openai/videoGeneration`, `/llm/gemini`, `/llm/gemini/imageGeneration`, `/llm/gemini/videoGeneration`, `/payments`, `/payments/stripe`, `/payments/stripe/checkout`

## Supported providers and models

```js
// OpenAI
.withModel("openai", "gpt-4o")
.withModel("openai", "gpt-4o-mini")

// Anthropic
.withModel("anthropic", "claude-sonnet-4-6")
.withModel("anthropic", "claude-opus-4-6")

// Google
.withModel("gemini", "gemini-1.5-pro")
.withModel("gemini", "gemini-1.5-flash")
```

## Streaming

```js
for await (const event of chat.streamMessage(new UserMessage({ text: input }))) {
  if (event.type === "text_delta") process.stdout.write(event.content);
  if (event.type === "stream_done") console.log("Done");
}
```

## Tool use

```js
chat.withTools([{
  type: "function",
  function: { name: "get_weather", description: "...", parameters: { ... } }
}]);

const response = await chat.sendMessageWithTools(new UserMessage({ text: "Weather in Lagos?" }));

while (response.tool_calls) {
  for (const tc of response.tool_calls) {
    const result = await myTool(tc.arguments);
    chat.addToolResult(tc.id, JSON.stringify(result));
  }
  response = await chat.sendMessageWithTools();
}
```

## Listing available models

```js
const { listModels } = require("emergentintegrations");
const models = await listModels({ apiKey: process.env.EMERGENT_LLM_KEY, provider: "all" });
```

## Package import paths

```js
// All from root
const { LlmChat, UserMessage, createChat } = require("emergentintegrations");

// Submodule paths also work
const { LlmChat } = require("emergentintegrations/llm/chat");
const { StripeCheckout } = require("emergentintegrations/payments/stripe");
```
