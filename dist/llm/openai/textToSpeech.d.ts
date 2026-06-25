export declare class OpenAITextToSpeech {
    /** Supported models */
    static MODELS: string[];
    /** Supported voices (9 voices for tts-1 and tts-1-hd) */
    static VOICES: string[];
    /** Supported formats (6 formats available) */
    static FORMATS: string[];
    private apiKey;
    private emergentProxyUrl;
    private customHeaders;
    constructor(apiKey: string, customHeaders?: Record<string, string>);
    private _isEmergentKey;
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
    generateSpeech(text: string, model?: string, voice?: string, speed?: number, responseFormat?: string): Promise<Buffer>;
    /**
     * Generate speech and return as base64 encoded string.
     * Useful for embedding audio in JSON responses.
     */
    generateSpeechBase64(text: string, model?: string, voice?: string, speed?: number, responseFormat?: string): Promise<string>;
}
//# sourceMappingURL=textToSpeech.d.ts.map