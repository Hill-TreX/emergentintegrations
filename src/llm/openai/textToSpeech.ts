/**
 * Text-to-Speech integration using OpenAI's TTS models.
 * Exact port of llm/openai/text_to_speech.py
 */
import OpenAI from "openai";

export class OpenAITextToSpeech {
  /** Supported models */
  static MODELS = ["tts-1", "tts-1-hd"];

  /** Supported voices (9 voices for tts-1 and tts-1-hd) */
  static VOICES = [
    "alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer",
  ];

  /** Supported formats (6 formats available) */
  static FORMATS = ["mp3", "opus", "aac", "flac", "wav", "pcm"];

  private apiKey: string;
  private emergentProxyUrl: string;
  private customHeaders: Record<string, string>;

  constructor(apiKey: string, customHeaders?: Record<string, string>) {
    this.apiKey = apiKey;
    const proxyUrl =
      process.env.INTEGRATION_PROXY_URL || "https://integrations.emergentagent.com";
    this.emergentProxyUrl = proxyUrl + "/llm";
    this.customHeaders = customHeaders || {};

    const appUrl = process.env.APP_URL;
    if (appUrl) {
      this.customHeaders["X-App-ID"] = appUrl;
    }
  }

  private _isEmergentKey(apiKey: string): boolean {
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
  async generateSpeech(
    text: string,
    model: string = "tts-1",
    voice: string = "alloy",
    speed: number = 1.0,
    responseFormat: string = "mp3"
  ): Promise<Buffer> {
    try {
      // Validate inputs
      if (!text || text.trim().length === 0) {
        throw new Error("Text cannot be empty");
      }
      if (text.length > 4096) {
        throw new Error("Text must be 4096 characters or less");
      }
      if (!OpenAITextToSpeech.MODELS.includes(model)) {
        throw new Error(
          `Invalid model: ${model}. Must be one of ${OpenAITextToSpeech.MODELS}`
        );
      }
      if (!OpenAITextToSpeech.VOICES.includes(voice)) {
        throw new Error(
          `Invalid voice: ${voice}. Must be one of ${OpenAITextToSpeech.VOICES}`
        );
      }
      if (speed < 0.25 || speed > 4.0) {
        throw new Error("Speed must be between 0.25 and 4.0");
      }
      if (!OpenAITextToSpeech.FORMATS.includes(responseFormat)) {
        throw new Error(
          `Invalid format: ${responseFormat}. Must be one of ${OpenAITextToSpeech.FORMATS}`
        );
      }

      // Build client
      const opts: any = { apiKey: this.apiKey };
      if (this._isEmergentKey(this.apiKey)) {
        opts.baseURL = this.emergentProxyUrl;
        if (Object.keys(this.customHeaders).length > 0) {
          opts.defaultHeaders = this.customHeaders;
        }
      }
      const client = new OpenAI(opts);

      // Prepare parameters
      const params: any = {
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
    } catch (e: any) {
      if (
        e.message.startsWith("Text") ||
        e.message.startsWith("Invalid") ||
        e.message.startsWith("Speed")
      ) {
        throw new Error(`Validation error: ${e.message}`);
      }
      throw new Error(`Failed to generate speech: ${e.message}`);
    }
  }

  /**
   * Generate speech and return as base64 encoded string.
   * Useful for embedding audio in JSON responses.
   */
  async generateSpeechBase64(
    text: string,
    model: string = "tts-1",
    voice: string = "alloy",
    speed: number = 1.0,
    responseFormat: string = "mp3"
  ): Promise<string> {
    const audioBytes = await this.generateSpeech(
      text,
      model,
      voice,
      speed,
      responseFormat
    );
    return audioBytes.toString("base64");
  }
}
