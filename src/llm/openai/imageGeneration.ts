/**
 * OpenAI Image Generation via emergent proxy.
 * Ported from llm/openai/image_generation.py with one deliberate deviation:
 * this always requests response_format: "b64_json" so callers reliably get
 * bytes back without an extra network hop. Python lets the API pick a default
 * and handles either a b64_json or a url response shape dynamically.
 */
import OpenAI from "openai";
import { getAppIdentifier, getIntegrationProxyUrl } from "../utils";

export class OpenAIImageGeneration {
  private apiKey: string;
  private emergentProxyUrl: string;
  private customHeaders: Record<string, string>;

  constructor(apiKey: string, customHeaders?: Record<string, string>) {
    this.apiKey = apiKey;
    const proxyUrl = getIntegrationProxyUrl();
    this.emergentProxyUrl = proxyUrl + "/llm";
    this.customHeaders = customHeaders || {};
  }

  private _isEmergentKey(apiKey: string): boolean {
    return apiKey.startsWith("sk-emergent-");
  }

  /**
   * Generates images using OpenAI's image generation API.
   *
   * @param prompt - The prompt to generate images from
   * @param model - The model to use for generation (default: "gpt-image-1")
   * @param numberOfImages - Number of images to generate (default: 1)
   * @param quality - The quality of the image ("low", "medium", "standard", "high", "hd")
   * @returns List of generated image bytes as Buffers
   */
  async generateImages(
    prompt: string,
    model: string = "gpt-image-1",
    numberOfImages: number = 1,
    quality: string = "low"
  ): Promise<Buffer[]> {
    try {
      // Convert quality for different models (exact Python logic)
      if (model === "dall-e-3") {
        if (quality === "low" || quality === "medium") {
          quality = "standard";
        } else if (quality === "high") {
          quality = "hd";
        }
      } else if (model === "gpt-image-1") {
        // GPT-Image-1 supports: 'low', 'medium', 'high'
        if (quality === "standard") {
          quality = "medium";
        } else if (quality === "hd") {
          quality = "high";
        }
      }

      const opts: any = { apiKey: this.apiKey };
      if (this._isEmergentKey(this.apiKey)) {
        opts.baseURL = this.emergentProxyUrl;
        if (Object.keys(this.customHeaders).length > 0) {
          opts.defaultHeaders = this.customHeaders;
        }
      }
      const client = new OpenAI(opts);

      const params: any = {
        model,
        prompt,
        n: numberOfImages,
        response_format: "b64_json",
      };

      // Only add quality parameter for models that support it
      if (model === "dall-e-3" || model === "gpt-image-1") {
        params.quality = quality;
      }

      const response = await client.images.generate(params);

      // Convert base64/URLs to bytes
      const imageBytesList: Buffer[] = [];
      for (const img of response.data as any[]) {
        if ((img as any).b64_json) {
          imageBytesList.push(Buffer.from((img as any).b64_json, "base64"));
        } else if (img.url) {
          // If we get URL instead of base64, fetch the image
          const imageResponse = await fetch(img.url);
          const arrayBuffer = await imageResponse.arrayBuffer();
          imageBytesList.push(Buffer.from(arrayBuffer));
        } else {
          throw new Error(`Unexpected image response format: ${JSON.stringify(img)}`);
        }
      }

      return imageBytesList;
    } catch (e: any) {
      throw new Error(`Failed to generate images: ${e.message}`);
    }
  }
}
