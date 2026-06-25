export declare class OpenAIVideoGeneration {
    /** Supported models */
    static MODELS: string[];
    /** Supported video sizes */
    static SIZES: Record<string, {
        width: number;
        height: number;
    }>;
    /** Supported durations in seconds */
    static DURATIONS: number[];
    private baseUrl;
    private headers;
    constructor(apiKey: string, customHeaders?: Record<string, string>);
    /**
     * Generate video from text prompt.
     *
     * @param prompt - Text description of the video to generate
     * @param model - Model to use ("sora-2" or "sora-2-pro")
     * @param size - Video size (e.g., "1280x720")
     * @param duration - Video duration in seconds (4, 8, or 12)
     * @param maxWaitTime - Maximum time to wait in seconds (default: 600)
     * @param imagePath - Optional path to reference image
     * @param mimeType - MIME type of the image if provided
     * @returns Video bytes if successful, null otherwise
     */
    textToVideo(prompt: string, model?: string, size?: string, duration?: number, maxWaitTime?: number, imagePath?: string, mimeType?: string): Promise<Buffer | null>;
    private _generateVideo;
    private _waitForCompletion;
    private _downloadVideoBytes;
    /**
     * Save video bytes to a file.
     */
    saveVideo(videoBytes: Buffer, outputPath?: string): string;
    private _sleep;
}
//# sourceMappingURL=videoGeneration.d.ts.map