# emergentintegrations — Node.js Usage Guide

Complete reference for the `emergentintegrations` npm package.

---

## Setup

```bash
npm install emergentintegrations
```

Add your key to `.env`:

```
EMERGENT_LLM_KEY=sk-emergent-...
```

> Always create a **new `LlmChat` instance per session**. Never reuse across users.

---

## Basic chat

```js
const { LlmChat, UserMessage } = require("emergentintegrations");

const chat = new LlmChat(process.env.EMERGENT_LLM_KEY, "session-123", "You are a helpful assistant.")
  .withModel("openai", "gpt-4o");

const reply = await chat.sendMessage(new UserMessage({ text: "Hello!" }));
console.log(reply);
```

---

## Switching providers

```js
// OpenAI
chat.withModel("openai", "gpt-4o")
chat.withModel("openai", "gpt-4o-mini")

// Anthropic
chat.withModel("anthropic", "claude-sonnet-4-6")
chat.withModel("anthropic", "claude-opus-4-6")

// Google
chat.withModel("gemini", "gemini-1.5-pro")
chat.withModel("gemini", "gemini-1.5-flash")
```

---

## Images in messages

```js
const { LlmChat, UserMessage, ImageContent } = require("emergentintegrations");
const fs = require("fs");

const b64 = fs.readFileSync("./photo.jpg").toString("base64");

const chat = new LlmChat(process.env.EMERGENT_LLM_KEY, "session-123", "Describe images concisely.")
  .withModel("openai", "gpt-4o");

const reply = await chat.sendMessage(new UserMessage({
  text: "What do you see in this image?",
  file_contents: [new ImageContent(b64)],
}));
```

---

## File attachments (Gemini only)

```js
const { LlmChat, UserMessage, FileContentWithMimeType } = require("emergentintegrations");

const chat = new LlmChat(process.env.EMERGENT_LLM_KEY, "session-123", "You are a helpful assistant.")
  .withModel("gemini", "gemini-1.5-flash");

// PDF
const pdf = new FileContentWithMimeType("application/pdf", "./report.pdf");

// CSV
const csv = new FileContentWithMimeType("text/csv", "./data.csv");

// Video
const video = new FileContentWithMimeType("video/mp4", "./clip.mp4");

const reply = await chat.sendMessage(new UserMessage({
  text: "Analyze this document.",
  file_contents: [pdf],
}));
```

> `FileContentWithMimeType` only works with Gemini. Passing it to OpenAI or Anthropic throws `ChatError`.

---

## Multi-turn conversation

History is maintained automatically on each `LlmChat` instance.

```js
const chat = new LlmChat(process.env.EMERGENT_LLM_KEY, "session-123", "You are helpful.")
  .withModel("openai", "gpt-4o-mini");

await chat.sendMessage(new UserMessage({ text: "My name is Hilton." }));
await chat.sendMessage(new UserMessage({ text: "I run two SaaS products." }));
const reply = await chat.sendMessage(new UserMessage({ text: "What do you know about me?" }));
// → "Your name is Hilton and you run two SaaS products."

// Access full history
const history = await chat.getMessages();
// or: chat.messages
```

---

## Streaming

```js
const { TextDelta, StreamDone } = require("emergentintegrations");

for await (const event of chat.streamMessage(new UserMessage({ text: "Tell me a story" }))) {
  if (event.type === "text_delta") process.stdout.write(event.content);
  if (event.type === "stream_done") {
    console.log("\nDone. Tokens used:", event.usage.total_tokens);
  }
}
```

---

## Tool use

```js
const { LlmChat, UserMessage } = require("emergentintegrations");

const chat = new LlmChat(process.env.EMERGENT_LLM_KEY, "session-123", "You are helpful.")
  .withModel("openai", "gpt-4o")
  .withTools([{
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current weather for a city",
      parameters: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
    },
  }]);

let response = await chat.sendMessageWithTools(new UserMessage({ text: "What is the weather in Lagos?" }));

while (response.tool_calls) {
  for (const tc of response.tool_calls) {
    const result = await getWeather(tc.arguments.city); // your function
    chat.addToolResult(tc.id, JSON.stringify(result));
  }
  response = await chat.sendMessageWithTools();
}

console.log(response.content);
```

---

## Streaming with Express (SSE)

```js
const express = require("express");
const { LlmChat, UserMessage } = require("emergentintegrations");

const app = express();
app.use(express.json());

app.post("/api/chat/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const chat = new LlmChat(process.env.EMERGENT_LLM_KEY, req.body.sessionId, "You are helpful.")
    .withModel("anthropic", "claude-sonnet-4-6");

  for await (const event of chat.streamMessage(new UserMessage({ text: req.body.message }))) {
    if (event.type === "text_delta") {
      res.write(`data: ${JSON.stringify({ chunk: event.content })}\n\n`);
    }
    if (event.type === "stream_done") {
      res.write("data: [DONE]\n\n");
    }
  }

  res.end();
});
```

---

## Text-to-Speech

```js
const { OpenAITextToSpeech } = require("emergentintegrations");
const fs = require("fs");

const tts = new OpenAITextToSpeech(process.env.EMERGENT_LLM_KEY);

// Returns Buffer
const audioBytes = await tts.generateSpeech("Hello, this is a test.", {
  model: "tts-1",
  voice: "alloy",
});
fs.writeFileSync("output.mp3", audioBytes);

// Or as base64
const base64Audio = await tts.generateSpeechBase64("Hello world");
```

Supported voices: `alloy`, `ash`, `coral`, `echo`, `fable`, `nova`, `onyx`, `sage`, `shimmer`

---

## Speech-to-Text

```js
const { OpenAISpeechToText } = require("emergentintegrations");

const stt = new OpenAISpeechToText(process.env.EMERGENT_LLM_KEY);

const result = await stt.transcribe("./audio.mp3");
console.log(result.text);

// With options
const result = await stt.transcribe("./audio.mp3", {
  model: "whisper-1",
  responseFormat: "json",
  language: "en",
});
```

---

## OpenAI Image Generation

```js
const { OpenAIImageGeneration } = require("emergentintegrations");
const fs = require("fs");

const imgGen = new OpenAIImageGeneration(process.env.EMERGENT_LLM_KEY);

const images = await imgGen.generateImages("A sunset over Lagos", {
  model: "gpt-image-1",
  numberOfImages: 1,
  quality: "low",
});

fs.writeFileSync("image.png", images[0]);
```

---

## Gemini Image Generation

```js
const { GeminiImageGeneration } = require("emergentintegrations");
const fs = require("fs");

const imgGen = new GeminiImageGeneration(process.env.GOOGLE_API_KEY);

const images = await imgGen.generateImages("A mountain lake at dawn", {
  model: "imagen-3.0-generate-002",
  numberOfImages: 4,
});

images.forEach((bytes, i) => fs.writeFileSync(`image_${i}.png`, bytes));
```

---

## OpenAI Video Generation (Sora)

```js
const { OpenAIVideoGeneration } = require("emergentintegrations");
const fs = require("fs");

const vidGen = new OpenAIVideoGeneration(process.env.EMERGENT_LLM_KEY);

const videoBytes = await vidGen.textToVideo("A cat playing piano", {
  model: "sora-2",
  size: "1280x720",
  duration: 4,
});

if (videoBytes) {
  fs.writeFileSync("video.mp4", videoBytes);
}
```

---

## Gemini Video Generation (Veo)

```js
const { GeminiVideoGeneration } = require("emergentintegrations");
const fs = require("fs");

const vidGen = new GeminiVideoGeneration(process.env.EMERGENT_LLM_KEY);

const videoBytes = await vidGen.textToVideo("A robot dancing in the rain");

if (videoBytes) {
  fs.writeFileSync("video.mp4", videoBytes);
}
```

---

## Realtime Audio (WebRTC)

### Backend (Node.js/Express)

```js
const { OpenAIChatRealtime } = require("emergentintegrations");
const express = require("express");

const app = express();
const realtime = new OpenAIChatRealtime(process.env.OPENAI_API_KEY);
const handlers = OpenAIChatRealtime.createRouteHandlers(realtime);

app.post("/api/realtime/session", handlers.createSession);
app.post("/api/realtime/negotiate", handlers.negotiate);
```

### Frontend (JavaScript)

```js
class RealtimeAudioChat {
  constructor() {
    this.peerConnection = null;
    this.dataChannel = null;
    this.audioElement = null;
  }

  async init() {
    const tokenResponse = await fetch("/api/realtime/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await tokenResponse.json();

    this.peerConnection = new RTCPeerConnection();
    this.setupAudioElement();
    await this.setupLocalAudio();
    this.setupDataChannel();

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    const response = await fetch("/api/realtime/negotiate", {
      method: "POST",
      body: offer.sdp,
      headers: { "Content-Type": "application/sdp" },
    });

    const { sdp: answerSdp } = await response.json();
    await this.peerConnection.setRemoteDescription({ type: "answer", sdp: answerSdp });
  }

  setupAudioElement() {
    this.audioElement = document.createElement("audio");
    this.audioElement.autoplay = true;
    document.body.appendChild(this.audioElement);
    this.peerConnection.ontrack = (event) => {
      this.audioElement.srcObject = event.streams[0];
    };
  }

  async setupLocalAudio() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => this.peerConnection.addTrack(track, stream));
  }

  setupDataChannel() {
    this.dataChannel = this.peerConnection.createDataChannel("oai-events");
    this.dataChannel.onmessage = (event) => {
      console.log("Received event:", event.data);
    };
  }
}

export default RealtimeAudioChat;
```

---

## Stripe Payments

```js
const { StripeCheckout, CheckoutError } = require("emergentintegrations");

const stripe = new StripeCheckout(process.env.STRIPE_API_KEY, webhookSecret, webhookUrl);

// Create a checkout session
const { url, session_id } = await stripe.createCheckoutSession({
  amount: 29.99,
  currency: "usd",
  success_url: "https://yoursite.com/success?session_id={CHECKOUT_SESSION_ID}",
  cancel_url: "https://yoursite.com/cancel",
  metadata: { userId: "user-123" },
});

// Redirect user to `url`

// Check payment status
const status = await stripe.getCheckoutStatus(session_id);
console.log(status.payment_status); // "paid" | "unpaid"

// Handle webhook (Express)
app.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  try {
    const event = await stripe.handleWebhook(req.body, sig);
    console.log(event.event_type, event.session_id, event.payment_status);
    res.json({ received: true });
  } catch (e) {
    res.status(400).send(`Webhook Error: ${e.message}`);
  }
});
```

---

## List available models

```js
const { listModels } = require("emergentintegrations");

const models = await listModels({ apiKey: process.env.EMERGENT_LLM_KEY, provider: "all" });
models.forEach(m => console.log(`${m.provider}: ${m.id}`));
```

---

## Error handling

```js
const { ChatError, CheckoutError } = require("emergentintegrations");

try {
  const reply = await chat.sendMessage(new UserMessage({ text: "Hello" }));
} catch (e) {
  if (e instanceof ChatError) {
    console.error("LLM error:", e.message);
  }
}
```
