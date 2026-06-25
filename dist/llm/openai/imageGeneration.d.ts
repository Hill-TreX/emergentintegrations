export declare class OpenAIImageGeneration {
    private apiKey;
    private emergentProxyUrl;
    private customHeaders;
    constructor(apiKey: string, customHeaders?: Record<string, string>);
    private _isEmergentKey;
    /**
     * Generates images using OpenAI's image generation API.
     *
     * @param prompt - The prompt to generate images from
     * @param model - The model to use for generation (default: "gpt-image-1")
     * @param numberOfImages - Number of images to generate (default: 1)
     * @param quality - The quality of the image ("low", "medium", "standard", "high", "hd")
     * @returns List of generated image bytes as Buffers
     */
    generateImages(prompt: string, model?: string, numberOfImages?: number, quality?: string): Promise<Buffer[]>;
}
//# sourceMappingURL=imageGeneration.d.ts.map