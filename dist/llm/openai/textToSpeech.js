"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAITextToSpeech = void 0;
/**
 * Text-to-Speech integration using OpenAI's TTS models.
 * Exact port of llm/openai/text_to_speech.py
 */
const openai_1 = __importDefault(require("openai"));
class OpenAITextToSpeech {
    constructor(apiKey, customHeaders) {
        this.apiKey = apiKey;
        const proxyUrl = process.env.INTEGRATION_PROXY_URL || "https://integrations.emergentagent.com";
        this.emergentProxyUrl = proxyUrl + "/llm";
        this.customHeaders = customHeaders || {};
        const appUrl = process.env.APP_URL;
        if (appUrl) {
            this.customHeaders["X-App-ID"] = appUrl;
        }
    }
    _isEmergentKey(apiKey) {
        return apiKey.startsWith("sk-emergent-");
    }
    /**
     * Generate speech audio from text using OpenAI's TTS models.
     *
     * @param text - The text to convert to speech (max 4096 characters)
     * @param model - The TTS model to use ('tts-1' or 'tts-1-hd')
     * @param voice - The voice to use
     * @param speed - Speed of the generated audio (0.25 to 4.0)
     * @param responseFormat - Audio format (mp3, opus, aac, flac, wav, pcm)
     * @returns Generated audio data as Buffer
     */
    async generateSpeech(text, model = "tts-1", voice = "alloy", speed = 1.0, responseFormat = "mp3") {
        try {
            // Validate inputs
            if (!text || text.trim().length === 0) {
                throw new Error("Text cannot be empty");
            }
            if (text.length > 4096) {
                throw new Error("Text must be 4096 characters or less");
            }
            if (!OpenAITextToSpeech.MODELS.includes(model)) {
                throw new Error(`Invalid model: ${model}. Must be one of ${OpenAITextToSpeech.MODELS}`);
            }
            if (!OpenAITextToSpeech.VOICES.includes(voice)) {
                throw new Error(`Invalid voice: ${voice}. Must be one of ${OpenAITextToSpeech.VOICES}`);
            }
            if (speed < 0.25 || speed > 4.0) {
                throw new Error("Speed must be between 0.25 and 4.0");
            }
            if (!OpenAITextToSpeech.FORMATS.includes(responseFormat)) {
                throw new Error(`Invalid format: ${responseFormat}. Must be one of ${OpenAITextToSpeech.FORMATS}`);
            }
            // Build client
            const opts = { apiKey: this.apiKey };
            if (this._isEmergentKey(this.apiKey)) {
                opts.baseURL = this.emergentProxyUrl;
                if (Object.keys(this.customHeaders).length > 0) {
                    opts.defaultHeaders = this.customHeaders;
                }
            }
            const client = new openai_1.default(opts);
            // Prepare parameters
            const params = {
                model,
                input: text,
                voice,
            };
            if (speed !== 1.0) {
                params.speed = speed;
            }
            if (responseFormat !== "mp3") {
                params.response_format = responseFormat;
            }
            // Generate speech
            const response = await client.audio.speech.create(params);
            // Convert response to Buffer
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }
        catch (e) {
            if (e.message.startsWith("Text") ||
                e.message.startsWith("Invalid") ||
                e.message.startsWith("Speed")) {
                throw new Error(`Validation error: ${e.message}`);
            }
            throw new Error(`Failed to generate speech: ${e.message}`);
        }
    }
    /**
     * Generate speech and return as base64 encoded string.
     * Useful for embedding audio in JSON responses.
     */
    async generateSpeechBase64(text, model = "tts-1", voice = "alloy", speed = 1.0, responseFormat = "mp3") {
        const audioBytes = await this.generateSpeech(text, model, voice, speed, responseFormat);
        return audioBytes.toString("base64");
    }
}
exports.OpenAITextToSpeech = OpenAITextToSpeech;
/** Supported models */
OpenAITextToSpeech.MODELS = ["tts-1", "tts-1-hd"];
/** Supported voices (9 voices for tts-1 and tts-1-hd) */
OpenAITextToSpeech.VOICES = [
    "alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer",
];
/** Supported formats (6 formats available) */
OpenAITextToSpeech.FORMATS = ["mp3", "opus", "aac", "flac", "wav", "pcm"];
//# sourceMappingURL=textToSpeech.js.map