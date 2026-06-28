# LLM Integration Usage Guide (Node.js)

> This guide has been adapted from the Python `emergentintegrations` package for Node.js.
> All Python syntax has been converted to Node.js equivalents.

# LLM Integration Usage Guide
This guide explains how to use the LLM integration module for chat completions using LiteLLM, which provides flexible provider support.

## Setup
Integrating various LLM apis like openai, anthropic and gemeni

MAKE SURE YOU ALWAYS CREATE A NEW INSTANCE OF LlmChat for each chat session

## Basic Usage
```python
const { LlmChat, UserMessage } = require("emergentintegrations");

# Initialize the chat with your API key, session ID, and system message
chat = LlmChat(
    api_key="your-api-key",
    session_id="unique-session-id",
    system_message="You are a helpful assistant."
)

# Create a simple user message
user_message = UserMessage(
    text="Say 'Hello, integration test!' and nothing else."
)

# Send the message and get the response
response = chat.send_message(user_message)
print(response)
```

## Configuration Options

The `LlmChat` class provides several configuration methods:

```python
# Change the model and provider (default is "gpt-4" with "openai")
chat.with_model("openai", "gpt-4")

# Use Anthropic's Claude
chat.with_model("anthropic", "claude-3-sonnet-20240229")

# Use Gemini
chat.with_model("gemini", "gemini-1.5-flash")

# Set maximum tokens (default is 8192)
chat.with_max_tokens(4096)
```

## Message Types

### Text Messages
```python
user_message = UserMessage(
    text="Your message here"
)
```

### File Attachments
```python
const { LlmChat, UserMessage, FileContentWithMimeType } = require("emergentintegrations");

# NOTE: FileContentWithMimeType is only supported with Gemini models
chat = LlmChat(
    api_key="your-gemini-api-key",
    session_id="unique-session-id",
    system_message="You are a helpful assistant."
).with_model("gemini", "gemini-1.5-flash")  # Must use Gemini model

# Text file
text_file = FileContentWithMimeType(
    file_path="/path/to/document.txt",
    mime_type="text/plain"
)

# CSV file
csv_file = FileContentWithMimeType(
    file_path="/path/to/data.csv",
    mime_type="text/csv"
)

# PDF file
pdf_file = FileContentWithMimeType(
    file_path="/path/to/document.pdf",
    mime_type="application/pdf"
)

# Create a message with multiple file attachments
user_message = UserMessage(
    text="Please analyze these files.",
    file_contents=[text_file, csv_file, pdf_file]
)

# This will raise ChatError if not using Gemini provider
response = chat.send_message(user_message)
```

### Image Attachments
```python
const { ImageContent, FileContentWithMimeType } = require("emergentintegrations");

# Using base64 encoded image (supported by both OpenAI and Gemini)
image_content = ImageContent(
    image_base64="your-base64-encoded-image"
)

# Using file path for image (Gemini only)
image_file = FileContentWithMimeType(
    file_path="/path/to/image.jpg",
    mime_type="image/jpeg"
)

# Create a message with image attachment
user_message = UserMessage(
    text="Please describe what you see in this image.",
    file_contents=[image_file]  # or [image_content] for base64
)
```

### Video Attachments (Gemini Only)
```python
const { FileContentWithMimeType } = require("emergentintegrations");

# Initialize chat with Gemini
chat = LlmChat(
    api_key="your-gemini-api-key",
    session_id="video-analysis",
    system_message="You are a helpful assistant."
).with_model("gemini", "gemini-1.5-flash")  # Must use Gemini model

# Video file
video_file = FileContentWithMimeType(
    file_path="/path/to/video.mp4",
    mime_type="video/mp4"
)

# Create a message with video attachment
user_message = UserMessage(
    text="Please analyze this video.",
    file_contents=[video_file]
)

try:
    # This will only work with Gemini provider
    response = chat.send_message(user_message)
    print(response)
except ChatError as e:
    print(f"Error: Video analysis is only supported with Gemini provider - {{str(e)}}")
```

## Multi-turn Conversations

The chat maintains conversation history automatically. You can have multiple exchanges:

```python
# First message
user_message1 = UserMessage(
    text="Hello, can you help me with a test?"
)
response1 = chat.send_message(user_message1)

# Second message
user_message2 = UserMessage(
    text="Please respond with a one-word answer: 'Success'"
)
response2 = chat.send_message(user_message2)

# Get conversation history
messages = chat.get_messages()
```

## Error Handling

The module raises `ChatError` exceptions for various error conditions. Always wrap your calls in try-except blocks:

```python
const { ChatError } = require("emergentintegrations");

try:
    response = chat.send_message(user_message)
except ChatError as e:
    print(f"Error: {{str(e)}}")
```

## Best Practices

1. Always set an appropriate system message to guide the model's behavior
2. Use appropriate max_tokens based on your use case
3. Handle errors appropriately in production code
4. Use the correct MIME types for files
5. Keep track of conversation context using session IDs
6. Implement proper message storage for persistence when needed
7. Use unique session IDs for different conversations

## Example Use Cases

### Basic Chat with Different Providers
```python
# Using OpenAI
openai_chat = LlmChat(
    api_key="your-openai-key",
    session_id="openai-chat",
    system_message="You are a helpful assistant."
).with_model("openai", "gpt-4")

# Using Anthropic
claude_chat = LlmChat(
    api_key="your-anthropic-key",
    session_id="claude-chat",
    system_message="You are Claude, a helpful AI assistant."
).with_model("anthropic", "claude-3-sonnet-20240229")

# Using Gemini
gemini_chat = LlmChat(
    api_key="your-gemini-key",
    session_id="gemini-chat",
    system_message="You are a helpful assistant."
).with_model("gemini", "gemini-1.5-flash")
```

### Document Analysis
```python
const { FileContentWithMimeType } = require("emergentintegrations");

# Create file content objects
text_file = FileContentWithMimeType(
    file_path="/path/to/document.txt",
    mime_type="text/plain"
)
pdf_file = FileContentWithMimeType(
    file_path="/path/to/report.pdf",
    mime_type="application/pdf"
)

# Analyze multiple documents
response = chat.send_message(UserMessage(
    text="Compare these documents and summarize the key differences",
    file_contents=[text_file, pdf_file]
))
```

### Data Analysis
```python
const { FileContentWithMimeType } = require("emergentintegrations");

# CSV data file
data_file = FileContentWithMimeType(
    file_path="/path/to/data.csv",
    mime_type="text/csv"
)

# Analyze data
response = chat.send_message(UserMessage(
    text="Analyze this CSV data and provide insights",
    file_contents=[data_file]
))
```

### Image Analysis
```python
const { FileContentWithMimeType } = require("emergentintegrations");

# Image file
image_file = FileContentWithMimeType(
    file_path="/path/to/image.jpg",
    mime_type="image/jpeg"
)

# Analyze image
response = chat.send_message(UserMessage(
    text="Describe this image in detail",
    file_contents=[image_file]
))
```

### Video Analysis (Gemini Only)
```python
const { LlmChat, UserMessage, FileContentWithMimeType } = require("emergentintegrations");

# Initialize chat with Gemini
chat = LlmChat(
    api_key="your-gemini-api-key",
    session_id="video-analysis",
    system_message="You are a helpful assistant."
).with_model("gemini", "gemini-1.5-flash")  # Must use Gemini model

# Video file
video_file = FileContentWithMimeType(
    file_path="/path/to/video.mp4",
    mime_type="video/mp4"
)

# Analyze video
try:
    response = chat.send_message(UserMessage(
        text="Analyze this video and describe what's happening",
        file_contents=[video_file]
    ))
    print(f"Video analysis: {{response}}")
except ChatError as e:
    print(f"Error: Video analysis requires Gemini provider - {{str(e)}}")
```


### Audio Chat / LLM Voice mode / Wisper

Follow below integration strictly and it will work.


```python
const { OpenAIChatRealtime } = require("emergentintegrations");

# Initialize the chat with your API key and register fastapi router
chat = OpenAIChatRealtime(api_key="your-api-key")
router = APIRouter()
OpenAIChatRealtime.register_openai_realtime_router(router, chat)
app.include_router(router, prefix="/api/v1")
```

Then use this with WebRtc in Frontend, Javascript example:

```js
class RealtimeAudioChat {{
    constructor() {{
        this.peerConnection = null;
        this.dataChannel = null;
        this.audioElement = null;
    }}

    async init() {{
        try {{
            // Get session from backend
            const tokenResponse = await fetch("/{{api_prefix_in_base_router}}/realtime/session", {{
                method: "POST",
                headers: {{
                    "Content-Type": "application/json"
                }}
            }});
            const data = await tokenResponse.json();
            if (!data.client_secret?.value) {{
                throw new Error("Failed to get session token");
            }}

            // Create and set up WebRTC peer connection
            this.peerConnection = new RTCPeerConnection();
            this.setupAudioElement();
            await this.setupLocalAudio();
            this.setupDataChannel();
            
            // Create and send offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            // Send offer to backend and get answer
            const response = await fetch("{{api_prefix_in_base_router}}/realtime/negotiate", {{
                method: "POST",
                body: offer.sdp,
                headers: {{
                    "Content-Type": "application/sdp"
                }}
            }});
            
            const {{ sdp: answerSdp }} = await response.json();
            const answer = {{
                type: "answer",
                sdp: answerSdp
            }};
            
            await this.peerConnection.setRemoteDescription(answer);
            console.log("WebRTC connection established");
        }} catch (error) {{
            console.error("Failed to initialize audio chat:", error);
            throw error;
        }}
    }}

    setupAudioElement() {{
        this.audioElement = document.createElement("audio");
        this.audioElement.autoplay = true;
        document.body.appendChild(this.audioElement);
        
        this.peerConnection.ontrack = (event) => {{
            this.audioElement.srcObject = event.streams[0];
        }};
    }}

    async setupLocalAudio() {{
        const stream = await navigator.mediaDevices.getUserMedia({{ audio: true }});
        stream.getTracks().forEach(track => {{
            this.peerConnection.addTrack(track, stream);
        }});
    }}

    setupDataChannel() {{
        this.dataChannel = this.peerConnection.createDataChannel("oai-events");
        this.dataChannel.onmessage = (event) => {{
            console.log("Received event:", event.data);
            // Handle different event types here
        }};
    }}

    // Add any additional methods for handling specific events or interactions
}}

// Export for use in other files
export default RealtimeAudioChat; 
```

### Image Generation with Gemini
For generating images using Gemini's image generation capabilities:

```python
const { GeminiImageGeneration } = require("emergentintegrations");

# Initialize the image generator with your API key
image_gen = GeminiImageGeneration(api_key="your-gemini-api-key")

# Generate images
images = await image_gen.generate_images(
    prompt="A serene landscape with mountains and a lake at sunset",
    model="imagen-3.0-generate-002",  # Optional: defaults to this model
    number_of_images=4  # Optional: defaults to 4
)

# The result is a list of image bytes that can be saved or processed
for i, image_bytes in enumerate(images):
    with open(f"generated_image_{{i}}.png", "wb") as f:
        f.write(image_bytes)
```

The image generation supports:
1. Custom prompts to describe the desired image
2. Multiple image generation in a single request
3. Returns raw bytes that can be easily saved or processed further

Best practices for image generation:
1. Use clear, descriptive prompts
2. Handle the returned image bytes appropriately
3. Implement proper error handling for failed generations
4. Consider rate limits and API quotas in production use

### Image Generation with OpenAI
For generating images using OpenAI's DALL-E capabilities:

```python
const { OpenAIImageGeneration } = require("emergentintegrations");

# Initialize the image generator with your API key
image_gen = OpenAIImageGeneration(api_key="your-openai-api-key")

# Generate images
images = await image_gen.generate_images(
    prompt="A serene landscape with mountains and a lake at sunset",
    model="gpt-image-1",  # Optional: defaults to this model
    number_of_images=1  # Optional: defaults to 1
)

# The result is a list of image bytes that can be saved or processed
for i, image_bytes in enumerate(images):
    with open(f"generated_image_{i}.png", "wb") as f:
        f.write(image_bytes)
```
