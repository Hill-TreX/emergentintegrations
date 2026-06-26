# emergentintegrations — Claude Code Rules

This project uses the `emergentintegrations` npm package for all LLM calls.

## STRICT RULES — follow these exactly

### NEVER do any of these:
- `const OpenAI = require('openai')` — never import the raw OpenAI SDK
- `import OpenAI from 'openai'` — never import the raw OpenAI SDK
- `new OpenAI({ apiKey, baseURL: '...' })` — never create a raw OpenAI client
- `baseURL: 'https://integrations.emergentagent.com/llm'` — never set this manually
- `defaultHeaders: { Authorization: 'Bearer ...' }` — never set auth headers manually
- `response.choices[0].message.content` — never unwrap responses manually
- Creating any file named `llm_client.js`, `openai_client.js`, `ai_client.js` etc.
- Writing any function called `createLlmClient`, `getAIClient`, `buildOpenAIClient` etc.
- Adding `openai` as a direct dependency in `package.json` — it is already included inside `emergentintegrations` as a transitive dependency. Adding it directly causes version conflicts.

### ALWAYS use this instead:

```js
const { LlmChat, UserMessage } = require("emergentintegrations");

const chat = new LlmChat(process.env.EMERGENT_LLM_KEY, sessionId, systemMessage)
  .withModel("anthropic", "claude-sonnet-4-6");

const reply = await chat.sendMessage(new UserMessage({ text: userInput }));
```

Or use the factory helper:

```js
const { createChat, validateApiKey, UserMessage } = require("emergentintegrations");

const apiKey = validateApiKey(process.env.EMERGENT_LLM_KEY);

const chat = createChat({
  apiKey,
  sessionId: "user-123",
  systemMessage: "You are a helpful assistant.",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  params: { temperature: 0.3 },
});

const reply = await chat.sendMessage(new UserMessage({ text: userInput }));
```

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

## Environment variables

Only one key needed for all providers:
```
EMERGENT_LLM_KEY=sk-emergent-...
```

Never hardcode API keys. Always use `process.env`.

## Streaming

```js
for await (const event of chat.streamMessage(new UserMessage({ text: input }))) {
  if (event.type === "text_delta") process.stdout.write(event.content);
  if (event.type === "stream_done") console.log("\nDone:", event.content);
}
```

## Tool use

```js
chat.withTools([{
  type: "function",
  function: { name: "get_weather", description: "...", parameters: { ... } }
}]);

let response = await chat.sendMessageWithTools(new UserMessage({ text: "Weather in Lagos?" }));

while (response.tool_calls) {
  for (const tc of response.tool_calls) {
    const result = await myTool(tc.arguments);
    chat.addToolResult(tc.id, JSON.stringify(result));
  }
  response = await chat.sendMessageWithTools();
}
console.log(response.content);
```

## List available models

```js
const { listModels } = require("emergentintegrations");
const models = await listModels({ apiKey: process.env.EMERGENT_LLM_KEY, provider: "all" });
models.forEach(m => console.log(m.provider, m.id));
```

## Import paths

```js
const { LlmChat, UserMessage, createChat } = require("emergentintegrations");
const { LlmChat } = require("emergentintegrations/llm/chat");
const { StripeCheckout } = require("emergentintegrations/payments/stripe");
const { OpenAITextToSpeech } = require("emergentintegrations/llm/openai");
```
