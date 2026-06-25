"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAISpeechToText = void 0;
/**
 * Speech-to-Text integration using OpenAI's transcription models.
 * Exact port of llm/openai/speech_to_text.py
 */
const openai_1 = __importDefault(require("openai"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class OpenAISpeechToText {
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
     * Validate audio file format and size.
     */
    _validateAudioFile(filePath) {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        // Check file size
        const stat = fs.statSync(filePath);
        if (stat.size > OpenAISpeechToText.MAX_FILE_SIZE) {
            throw new Error(`File size (${stat.size} bytes) exceeds maximum allowed size ` +
                `(${OpenAISpeechToText.MAX_FILE_SIZE} bytes / 25 MB)`);
        }
        // Check file format
        const ext = path.extname(filePath).slice(1).toLowerCase();
        if (!OpenAISpeechToText.FILE_FORMATS.includes(ext)) {
            throw new Error(`Unsupported file format: ${ext}. ` +
                `Supported formats: ${OpenAISpeechToText.FILE_FORMATS.join(", ")}`);
        }
    }
    /**
     * Transcribe audio into the language of the input audio.
     *
     * @param file - Audio file path (mp3, mp4, mpeg, mpga, m4a, wav, webm)
     * @param model - Model to use ('whisper-1')
     * @param responseFormat - Format of transcript output
     * @param prompt - Optional text to guide the model's style
     * @param language - Language of the input audio (ISO-639-1 format)
     * @param temperature - Sampling temperature between 0 and 1
     * @param timestampGranularities - Timestamp granularities (only for whisper-1 with verbose_json)
     * @returns Transcription response object
     */
    async transcribe(file, model = "whisper-1", responseFormat = "json", prompt, language, temperature, timestampGranularities) {
        try {
            // Validate file
            this._validateAudioFile(file);
            // Validate model
            if (!OpenAISpeechToText.MODELS.includes(model)) {
                throw new Error(`Invalid model: ${model}. Must be one of ${OpenAISpeechToText.MODELS}`);
            }
            // Validate response format for the model
            const validFormats = OpenAISpeechToText.RESPONSE_FORMATS[model] || [];
            if (!validFormats.includes(responseFormat)) {
                throw new Error(`Invalid response_format '${responseFormat}' for model '${model}'. ` +
                    `Supported formats: ${validFormats.join(", ")}`);
            }
            // Validate timestamp_granularities
            if (timestampGranularities && responseFormat !== "verbose_json") {
                throw new Error("timestamp_granularities requires response_format='verbose_json'");
            }
            // Validate temperature
            if (temperature !== undefined) {
                if (temperature < 0 || temperature > 1) {
                    throw new Error("Temperature must be between 0 and 1");
                }
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
                file: fs.createReadStream(file),
                response_format: responseFormat,
            };
            if (prompt)
                params.prompt = prompt;
            if (language)
                params.language = language;
            if (temperature !== undefined)
                params.temperature = temperature;
            if (timestampGranularities) {
                params.timestamp_granularities = timestampGranularities;
            }
            // Transcribe
            const response = await client.audio.transcriptions.create(params);
            return response;
        }
        catch (e) {
            if (e.message.startsWith("Validation error:") || e.message.startsWith("Invalid") || e.message.startsWith("File") || e.message.startsWith("Unsupported") || e.message.startsWith("Temperature")) {
                throw new Error(`Validation error: ${e.message}`);
            }
            throw new Error(`Failed to transcribe audio: ${e.message}`);
        }
    }
}
exports.OpenAISpeechToText = OpenAISpeechToText;
/** Supported models */
OpenAISpeechToText.MODELS = ["whisper-1"];
/** Supported response formats per model */
OpenAISpeechToText.RESPONSE_FORMATS = {
    "whisper-1": ["json", "text", "srt", "verbose_json", "vtt"],
};
/** Supported file formats */
OpenAISpeechToText.FILE_FORMATS = ["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"];
/** Maximum file size in bytes (25 MB) */
OpenAISpeechToText.MAX_FILE_SIZE = 25 * 1024 * 1024;
//# sourceMappingURL=speechToText.js.map