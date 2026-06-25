"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiImageGeneration = void 0;
/**
 * Gemini Image Generation using the official google-genai SDK.
 * Exact port of llm/gemeni/image_generation.py
 */
const genai_1 = require("@google/genai");
class GeminiImageGeneration {
    constructor(apiKey) {
        this.client = new genai_1.GoogleGenAI({ apiKey });
    }
    /**
     * Generates images using Gemini's image generation API.
     *
     * @param prompt - The prompt to generate images from
     * @param model - The model to use for generation (default: 'imagen-3.0-generate-002')
     * @param numberOfImages - Number of images to generate (default: 4)
     * @returns List of generated image bytes as Buffers
     */
    async generateImages(prompt, model = "imagen-3.0-generate-002", numberOfImages = 4) {
        try {
            const response = await this.client.models.generateImages({
                model,
                prompt,
                config: { numberOfImages },
            });
            return response.generatedImages.map((img) => Buffer.from(img.image.imageBytes));
        }
        catch (e) {
            throw new Error(`Failed to generate images: ${e.message}`);
        }
    }
}
exports.GeminiImageGeneration = GeminiImageGeneration;
//# sourceMappingURL=imageGeneration.js.map