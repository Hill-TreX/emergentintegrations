/**
 * Speech-to-Text integration using OpenAI's transcription models.
 * Exact port of llm/openai/speech_to_text.py
 */
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

export class OpenAISpeechToText {
  /** Supported models */
  static MODELS = ["whisper-1"];

  /** Supported response formats per model */
  static RESPONSE_FORMATS: Record<string, string[]> = {
    "whisper-1": ["json", "text", "srt", "verbose_json", "vtt"],
  };

  /** Supported file formats */
  static FILE_FORMATS = ["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"];

  /** Maximum file size in bytes (25 MB) */
  static MAX_FILE_SIZE = 25 * 1024 * 1024;

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
   * Validate audio file format and size.
   */
  private _validateAudioFile(filePath: string): void {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Check file size
    const stat = fs.statSync(filePath);
    if (stat.size > OpenAISpeechToText.MAX_FILE_SIZE) {
      throw new Error(
        `File size (${stat.size} bytes) exceeds maximum allowed size ` +
          `(${OpenAISpeechToText.MAX_FILE_SIZE} bytes / 25 MB)`
      );
    }

    // Check file format
    const ext = path.extname(filePath).slice(1).toLowerCase();
    if (!OpenAISpeechToText.FILE_FORMATS.includes(ext)) {
      throw new Error(
        `Unsupported file format: ${ext}. ` +
          `Supported formats: ${OpenAISpeechToText.FILE_FORMATS.join(", ")}`
      );
    }
  }

  /**
   * Transcribe audio into the language of the input audio.
   *
   * @param file - Audio file path (mp3, mp4, mpeg, mpga, m4a, wav, webm).
   *   Node only accepts a path string. Python's version also accepts an
   *   already-open file-like object; that input shape is not supported here.
   *   Write your buffer to a temp file first if you don't already have a path.
   * @param model - Model to use ('whisper-1')
   * @param responseFormat - Format of transcript output
   * @param prompt - Optional text to guide the model's style
   * @param language - Language of the input audio (ISO-639-1 format)
   * @param temperature - Sampling temperature between 0 and 1
   * @param timestampGranularities - Timestamp granularities (only for whisper-1 with verbose_json)
   * @returns Transcription response object
   */
  async transcribe(
    file: string,
    model: string = "whisper-1",
    responseFormat: string = "json",
    prompt?: string,
    language?: string,
    temperature?: number,
    timestampGranularities?: string[]
  ): Promise<any> {
    try {
      // Validate file
      this._validateAudioFile(file);

      // Validate model
      if (!OpenAISpeechToText.MODELS.includes(model)) {
        throw new Error(
          `Invalid model: ${model}. Must be one of ${OpenAISpeechToText.MODELS}`
        );
      }

      // Validate response format for the model
      const validFormats = OpenAISpeechToText.RESPONSE_FORMATS[model] || [];
      if (!validFormats.includes(responseFormat)) {
        throw new Error(
          `Invalid response_format '${responseFormat}' for model '${model}'. ` +
            `Supported formats: ${validFormats.join(", ")}`
        );
      }

      // Validate timestamp_granularities
      if (timestampGranularities && responseFormat !== "verbose_json") {
        throw new Error(
          "timestamp_granularities requires response_format='verbose_json'"
        );
      }

      // Validate temperature
      if (temperature !== undefined) {
        if (temperature < 0 || temperature > 1) {
          throw new Error("Temperature must be between 0 and 1");
        }
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
        file: fs.createReadStream(file),
        response_format: responseFormat,
      };

      if (prompt) params.prompt = prompt;
      if (language) params.language = language;
      if (temperature !== undefined) params.temperature = temperature;
      if (timestampGranularities) {
        params.timestamp_granularities = timestampGranularities;
      }

      // Transcribe
      const response = await client.audio.transcriptions.create(params);
      return response;
    } catch (e: any) {
      if (e.message.startsWith("Validation error:") || e.message.startsWith("Invalid") || e.message.startsWith("File") || e.message.startsWith("Unsupported") || e.message.startsWith("Temperature")) {
        throw new Error(`Validation error: ${e.message}`);
      }
      throw new Error(`Failed to transcribe audio: ${e.message}`);
    }
  }
}
