"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiVideoGeneration = void 0;
/**
 * Gemini Veo video generation client using emergent proxy.
 * Exact port of llm/gemeni/video_generation.py
 */
const fs = __importStar(require("fs"));
const utils_1 = require("../utils");
class GeminiVideoGeneration {
    constructor(apiKey, customHeaders) {
        const mergedHeaders = customHeaders || {};
        const proxyUrl = (0, utils_1.getIntegrationProxyUrl)();
        this.baseUrl = proxyUrl + "/llm/gemini/v1beta";
        const appUrl = (0, utils_1.getAppIdentifier)();
        if (appUrl) {
            mergedHeaders["X-App-ID"] = appUrl;
        }
        this.headers = {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json",
            Authorization: apiKey,
            ...mergedHeaders,
        };
    }
    /**
     * Generate video from text prompt using Veo.
     *
     * @param prompt - Text description of the video to generate
     * @param maxWaitTime - Maximum time to wait in seconds (default: 600)
     * @param imagePath - Optional path to reference image
     * @param mimeType - MIME type of the image if provided
     * @returns Video bytes if successful, null otherwise
     */
    async textToVideo(prompt, maxWaitTime = 600, imagePath, mimeType = "image/jpeg") {
        const operationName = await this._generateVideo(prompt, imagePath, mimeType);
        if (!operationName)
            return null;
        const videoUri = await this._waitForCompletion(operationName, maxWaitTime);
        if (!videoUri)
            return null;
        return this._downloadVideoBytes(videoUri);
    }
    /**
     * Alternative text-to-video generation wrapper (matches genai SDK style).
     * Calls textToVideo and optionally saves to file.
     */
    async textToVideoGenaiSdk(prompt, maxWaitTime = 600, outputPath, imagePath, mimeType = "image/jpeg") {
        console.log("🔄 Using genai SDK approach (falls back to HTTP requests for video generation)");
        try {
            console.log(`🚀 Starting video generation with prompt: ${prompt}`);
            const videoBytes = await this.textToVideo(prompt, maxWaitTime, imagePath, mimeType);
            if (videoBytes) {
                const savePath = outputPath || `genai_video_${Date.now()}.mp4`;
                fs.writeFileSync(savePath, videoBytes);
                console.log(`✅ Video saved to: ${savePath}`);
                return videoBytes;
            }
            else {
                console.log("❌ Video generation failed");
                return null;
            }
        }
        catch (e) {
            console.error(`❌ Error in genai SDK video generation: ${e.message}`);
            return null;
        }
    }
    async _generateVideo(prompt, imagePath, mimeType = "image/jpeg") {
        const url = `${this.baseUrl}/models/veo-3.0-generate-001:predictLongRunning`;
        const payload = {
            instances: [{ prompt }],
        };
        if (imagePath) {
            const fileBytes = fs.readFileSync(imagePath);
            const encodedString = fileBytes.toString("base64");
            payload.instances[0].image = {
                bytesBase64Encoded: encodedString,
                mimeType,
            };
        }
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: this.headers,
                body: JSON.stringify(payload),
            });
            if (!response.ok)
                return null;
            const data = await response.json();
            const operationName = data.name || null;
            if (operationName) {
                return operationName;
            }
            else {
                return null;
            }
        }
        catch (e) {
            return null;
        }
    }
    async _waitForCompletion(operationName, maxWaitTime = 600) {
        const operationUrl = `${this.baseUrl}/${operationName}`;
        const startTime = Date.now();
        let pollInterval = 10000; // 10 seconds in ms
        while (Date.now() - startTime < maxWaitTime * 1000) {
            try {
                const response = await fetch(operationUrl, { headers: this.headers });
                if (!response.ok) {
                    await this._sleep(pollInterval);
                    continue;
                }
                const data = await response.json();
                if (data.error)
                    return null;
                const isDone = data.done || false;
                if (isDone) {
                    try {
                        const videoUri = data.response.generateVideoResponse.generatedSamples[0].video.uri;
                        return videoUri;
                    }
                    catch {
                        return null;
                    }
                }
                await this._sleep(pollInterval);
                pollInterval = Math.min(pollInterval * 1.2, 30000);
            }
            catch (e) {
                await this._sleep(pollInterval);
            }
        }
        return null;
    }
    async _downloadVideoBytes(videoUri) {
        try {
            // Convert Google URI to LiteLLM proxy URI
            const parts = videoUri.split("https://generativelanguage.googleapis.com/v1beta/");
            if (parts.length < 2)
                return null;
            const downloadPath = parts[1];
            const litellmDownloadUrl = `${this.baseUrl}/${downloadPath}`;
            console.log(`Debug: Downloading from URL: ${litellmDownloadUrl}`);
            // Follow redirects manually to ensure we get the actual file
            let response = await fetch(litellmDownloadUrl, {
                headers: this.headers,
                redirect: "manual",
            });
            console.log(`Debug: Initial response status: ${response.status}`);
            // Handle redirects manually
            let redirectCount = 0;
            const maxRedirects = 5;
            while ([301, 302, 303, 307, 308].includes(response.status) &&
                redirectCount < maxRedirects) {
                const redirectUrl = response.headers.get("location");
                console.log(`Debug: Redirect #${redirectCount + 1} to: ${redirectUrl}`);
                if (!redirectUrl)
                    return null;
                redirectCount++;
                response = await fetch(redirectUrl, {
                    headers: this.headers,
                    redirect: "manual",
                });
                console.log(`Debug: Redirect response status: ${response.status}`);
            }
            if (response.status !== 200) {
                console.log(`Debug: Final status code: ${response.status}`);
                return null;
            }
            // Verify we have the actual video content
            const contentType = response.headers.get("content-type") || "";
            console.log(`Debug: Content-Type: ${contentType}`);
            if (!contentType.startsWith("video/") &&
                !contentType.startsWith("application/octet-stream")) {
                console.log("Debug: Content type doesn't look like video, trying fallback approach");
                const finalResponse = await fetch(litellmDownloadUrl, {
                    headers: this.headers,
                    redirect: "follow",
                });
                if (!finalResponse.ok)
                    return null;
                response = finalResponse;
            }
            const arrayBuffer = await response.arrayBuffer();
            const videoData = Buffer.from(arrayBuffer);
            console.log(`Debug: Downloaded ${videoData.length} bytes`);
            // Verify we actually got video data (should be at least 1KB)
            if (videoData.length < 1000) {
                console.log(`Debug: Video data too small (${videoData.length} bytes), returning null`);
                return null;
            }
            return videoData;
        }
        catch (e) {
            console.error(`Debug: Request exception: ${e.message}`);
            return null;
        }
    }
    _sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.GeminiVideoGeneration = GeminiVideoGeneration;
//# sourceMappingURL=videoGeneration.js.map