export declare class OpenAISpeechToText {
    /** Supported models */
    static MODELS: string[];
    /** Supported response formats per model */
    static RESPONSE_FORMATS: Record<string, string[]>;
    /** Supported file formats */
    static FILE_FORMATS: string[];
    /** Maximum file size in bytes (25 MB) */
    static MAX_FILE_SIZE: number;
    private apiKey;
    private emergentProxyUrl;
    private customHeaders;
    constructor(apiKey: string, customHeaders?: Record<string, string>);
    private _isEmergentKey;
    /**
     * Validate audio file format and size.
     */
    private _validateAudioFile;
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
    transcribe(file: string, model?: string, responseFormat?: string, prompt?: string, language?: string, temperature?: number, timestampGranularities?: string[]): Promise<any>;
}
//# sourceMappingURL=speechToText.d.ts.map