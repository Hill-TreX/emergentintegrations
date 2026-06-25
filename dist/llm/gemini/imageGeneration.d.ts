export declare class GeminiImageGeneration {
    private client;
    constructor(apiKey: string);
    /**
     * Generates images using Gemini's image generation API.
     *
     * @param prompt - The prompt to generate images from
     * @param model - The model to use for generation (default: 'imagen-3.0-generate-002')
     * @param numberOfImages - Number of images to generate (default: 4)
     * @returns List of generated image bytes as Buffers
     */
    generateImages(prompt: string, model?: string, numberOfImages?: number): Promise<Buffer[]>;
}
//# sourceMappingURL=imageGeneration.d.ts.map