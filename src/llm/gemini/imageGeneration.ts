/**
 * Gemini Image Generation using the official google-genai SDK.
 * Exact port of llm/gemeni/image_generation.py
 */
import { GoogleGenAI } from "@google/genai";

export class GeminiImageGeneration {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  /**
   * Generates images using Gemini's image generation API.
   *
   * @param prompt - The prompt to generate images from
   * @param model - The model to use for generation (default: 'imagen-3.0-generate-002')
   * @param numberOfImages - Number of images to generate (default: 4)
   * @returns List of generated image bytes as Buffers
   */
  async generateImages(
    prompt: string,
    model: string = "imagen-3.0-generate-002",
    numberOfImages: number = 4
  ): Promise<Buffer[]> {
    try {
      const response = await (this.client as any).models.generateImages({
        model,
        prompt,
        config: { numberOfImages },
      });

      return response.generatedImages.map((img: any) =>
        Buffer.from(img.image.imageBytes)
      );
    } catch (e: any) {
      throw new Error(`Failed to generate images: ${e.message}`);
    }
  }
}
