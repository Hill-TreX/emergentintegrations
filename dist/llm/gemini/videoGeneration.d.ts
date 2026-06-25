export declare class GeminiVideoGeneration {
    private baseUrl;
    private headers;
    constructor(apiKey: string, customHeaders?: Record<string, string>);
    /**
     * Generate video from text prompt using Veo.
     *
     * @param prompt - Text description of the video to generate
     * @param maxWaitTime - Maximum time to wait in seconds (default: 600)
     * @param imagePath - Optional path to reference image
     * @param mimeType - MIME type of the image if provided
     * @returns Video bytes if successful, null otherwise
     */
    textToVideo(prompt: string, maxWaitTime?: number, imagePath?: string, mimeType?: string): Promise<Buffer | null>;
    /**
     * Alternative text-to-video generation wrapper (matches genai SDK style).
     * Calls textToVideo and optionally saves to file.
     */
    textToVideoGenaiSdk(prompt: string, maxWaitTime?: number, outputPath?: string, imagePath?: string, mimeType?: string): Promise<Buffer | null>;
    private _generateVideo;
    private _waitForCompletion;
    private _downloadVideoBytes;
    private _sleep;
}
//# sourceMappingURL=videoGeneration.d.ts.map