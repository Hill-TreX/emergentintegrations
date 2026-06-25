"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIImageGeneration = void 0;
/**
 * OpenAI Image Generation via emergent proxy.
 * Exact port of llm/openai/image_generation.py
 */
const openai_1 = __importDefault(require("openai"));
const utils_1 = require("../utils");
class OpenAIImageGeneration {
    constructor(apiKey, customHeaders) {
        this.apiKey = apiKey;
        const proxyUrl = (0, utils_1.getIntegrationProxyUrl)();
        this.emergentProxyUrl = proxyUrl + "/llm";
        this.customHeaders = customHeaders || {};
    }
    _isEmergentKey(apiKey) {
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
    async generateImages(prompt, model = "gpt-image-1", numberOfImages = 1, quality = "low") {
        try {
            // Convert quality for different models (exact Python logic)
            if (model === "dall-e-3") {
                if (quality === "low" || quality === "medium") {
                    quality = "standard";
                }
                else if (quality === "high") {
                    quality = "hd";
                }
            }
            else if (model === "gpt-image-1") {
                // GPT-Image-1 supports: 'low', 'medium', 'high'
                if (quality === "standard") {
                    quality = "medium";
                }
                else if (quality === "hd") {
                    quality = "high";
                }
            }
            const opts = { apiKey: this.apiKey };
            if (this._isEmergentKey(this.apiKey)) {
                opts.baseURL = this.emergentProxyUrl;
                if (Object.keys(this.customHeaders).length > 0) {
                    opts.defaultHeaders = this.customHeaders;
                }
            }
            const client = new openai_1.default(opts);
            const params = {
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
            const imageBytesList = [];
            for (const img of response.data) {
                if (img.b64_json) {
                    imageBytesList.push(Buffer.from(img.b64_json, "base64"));
                }
                else if (img.url) {
                    // If we get URL instead of base64, fetch the image
                    const imageResponse = await fetch(img.url);
                    const arrayBuffer = await imageResponse.arrayBuffer();
                    imageBytesList.push(Buffer.from(arrayBuffer));
                }
                else {
                    throw new Error(`Unexpected image response format: ${JSON.stringify(img)}`);
                }
            }
            return imageBytesList;
        }
        catch (e) {
            throw new Error(`Failed to generate images: ${e.message}`);
        }
    }
}
exports.OpenAIImageGeneration = OpenAIImageGeneration;
//# sourceMappingURL=imageGeneration.js.map