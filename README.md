# emergentintegrations (Node.js/TypeScript)

A Node.js/TypeScript library for various integrations including payments and LLM services. This is an exact port of the Python `emergentintegrations` v0.2.0 package.

## Installation

```bash
npm install emergentintegrations
# or from local zip:
npm install ./emergentintegrations-0.2.0.tgz
```

## Quick Start

### LLM Chat (OpenAI, Anthropic, Gemini)

```typescript
import { LlmChat } from "emergentintegrations";

const chat = new LlmChat(
  "sk-emergent-your-key",
  "session-123",
  "You are a helpful assistant."
);

// Use with OpenAI
chat.withModel("openai", "gpt-4o");
const response = await chat.sendMessage({ text: "Hello!" });
console.log(response);

// Use with Anthropic (via proxy)
chat.withModel("anthropic", "claude-sonnet-4-20250514");
const response2 = await chat.sendMessage({ text: "Hello!" });

// Use with Gemini
chat.withModel("gemini", "gemini-2.5-flash");
const response3 = await chat.sendMessage({ text: "Hello!" });
```

### Tool Calling

```typescript
import { LlmChat } from "emergentintegrations";

const chat = new LlmChat("sk-emergent-...", "session-1", "You are helpful.");
chat.withModel("openai", "gpt-4o");
chat.withTools([
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get weather for a city",
      parameters: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
    },
  },
]);

const result = await chat.sendMessageWithTools({ text: "What's the weather in NYC?" });
if (result.tool_calls) {
  // Execute tool and report back
  chat.addToolResult(result.tool_calls[0].id, JSON.stringify({ temp: "72F" }));
  const final = await chat.sendMessageWithTools();
  console.log(final.content);
}
```

### Streaming

```typescript
import { LlmChat } from "emergentintegrations";

const chat = new LlmChat("sk-emergent-...", "session-1", "You are helpful.");
chat.withModel("openai", "gpt-4o");

for await (const event of chat.streamMessage({ text: "Tell me a story" })) {
  if (event.type === "text_delta") {
    process.stdout.write(event.content);
  } else if (event.type === "stream_done") {
    console.log("\n\nDone! Tokens used:", event.usage.total_tokens);
  }
}
```

### Image Generation (OpenAI)

```typescript
import { OpenAIImageGeneration } from "emergentintegrations";

const imageGen = new OpenAIImageGeneration("sk-emergent-...");
const images = await imageGen.generateImages("A sunset over mountains", "gpt-image-1", 1, "medium");
// images[0] is a Buffer of the image bytes
```

### Image Generation (Gemini)

```typescript
import { GeminiImageGeneration } from "emergentintegrations";

const imageGen = new GeminiImageGeneration("your-gemini-key");
const images = await imageGen.generateImages("A cat in space", "imagen-3.0-generate-002", 4);
```

### Video Generation (OpenAI Sora)

```typescript
import { OpenAIVideoGeneration } from "emergentintegrations";

const videoGen = new OpenAIVideoGeneration("sk-emergent-...");
const videoBytes = await videoGen.textToVideo(
  "A drone flying over a forest",
  "sora-2",
  "1280x720",
  4
);
if (videoBytes) {
  videoGen.saveVideo(videoBytes, "output.mp4");
}
```

### Video Generation (Gemini Veo)

```typescript
import { GeminiVideoGeneration } from "emergentintegrations";

const videoGen = new GeminiVideoGeneration("sk-emergent-...");
const videoBytes = await videoGen.textToVideo("Ocean waves crashing", 600);
```

### Text-to-Speech

```typescript
import { OpenAITextToSpeech } from "emergentintegrations";

const tts = new OpenAITextToSpeech("sk-emergent-...");
const audioBytes = await tts.generateSpeech("Hello world!", "tts-1", "alloy");
// audioBytes is a Buffer of MP3 data
```

### Speech-to-Text

```typescript
import { OpenAISpeechToText } from "emergentintegrations";

const stt = new OpenAISpeechToText("sk-emergent-...");
const transcription = await stt.transcribe("./audio.mp3");
console.log(transcription.text);
```

### Realtime WebRTC

```typescript
import { OpenAIChatRealtime } from "emergentintegrations";

const realtime = new OpenAIChatRealtime("sk-your-openai-key");
const session = await realtime.createEphemeralSessionForAudioChat("verse");
const sdpAnswer = await realtime.negotiateConnection(sdpOffer);
```

### Stripe Payments

```typescript
import { StripeCheckout } from "emergentintegrations";

const checkout = new StripeCheckout("sk_test_emergent...", "whsec_...");

const session = await checkout.createCheckoutSession({
  amount: 29.99,
  currency: "usd",
  success_url: "https://example.com/success?session_id={CHECKOUT_SESSION_ID}",
  cancel_url: "https://example.com/cancel",
});
console.log(session.url); // Redirect customer here

// Check status
const status = await checkout.getCheckoutStatus(session.session_id);

// Handle webhook
const event = await checkout.handleWebhook(rawBody, signature);
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `INTEGRATION_PROXY_URL` | Emergent proxy URL | `https://integrations.emergentagent.com` |
| `APP_URL` | Application identifier for X-App-ID header | - |
| `REACT_APP_BACKEND_URL` | Fallback app identifier | - |

## Proxy Routing

When using an `sk-emergent-` API key:
- All LLM requests route through `{INTEGRATION_PROXY_URL}/llm`
- Stripe requests with `sk_test_emergent` route through `{INTEGRATION_PROXY_URL}/stripe`
- Gemini video requests route through `{INTEGRATION_PROXY_URL}/llm/gemini/v1beta`
- OpenAI video requests route through `{INTEGRATION_PROXY_URL}/llm/openai/v1`

## License

MIT
