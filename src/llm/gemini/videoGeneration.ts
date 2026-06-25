/**
 * Gemini Veo video generation client using emergent proxy.
 * Exact port of llm/gemeni/video_generation.py
 */
import * as fs from "fs";
import { getAppIdentifier, getIntegrationProxyUrl } from "../utils";

export class GeminiVideoGeneration {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(apiKey: string, customHeaders?: Record<string, string>) {
    const mergedHeaders = customHeaders || {};
    const proxyUrl = getIntegrationProxyUrl();
    this.baseUrl = proxyUrl + "/llm/gemini/v1beta";

    const appUrl = getAppIdentifier();
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
  async textToVideo(
    prompt: string,
    maxWaitTime: number = 600,
    imagePath?: string,
    mimeType: string = "image/jpeg"
  ): Promise<Buffer | null> {
    const operationName = await this._generateVideo(prompt, imagePath, mimeType);
    if (!operationName) return null;

    const videoUri = await this._waitForCompletion(operationName, maxWaitTime);
    if (!videoUri) return null;

    return this._downloadVideoBytes(videoUri);
  }

  /**
   * Alternative text-to-video generation wrapper (matches genai SDK style).
   * Calls textToVideo and optionally saves to file.
   */
  async textToVideoGenaiSdk(
    prompt: string,
    maxWaitTime: number = 600,
    outputPath?: string,
    imagePath?: string,
    mimeType: string = "image/jpeg"
  ): Promise<Buffer | null> {
    console.log(
      "🔄 Using genai SDK approach (falls back to HTTP requests for video generation)"
    );

    try {
      console.log(`🚀 Starting video generation with prompt: ${prompt}`);

      const videoBytes = await this.textToVideo(
        prompt,
        maxWaitTime,
        imagePath,
        mimeType
      );

      if (videoBytes) {
        const savePath = outputPath || `genai_video_${Date.now()}.mp4`;
        fs.writeFileSync(savePath, videoBytes);
        console.log(`✅ Video saved to: ${savePath}`);
        return videoBytes;
      } else {
        console.log("❌ Video generation failed");
        return null;
      }
    } catch (e: any) {
      console.error(`❌ Error in genai SDK video generation: ${e.message}`);
      return null;
    }
  }

  private async _generateVideo(
    prompt: string,
    imagePath?: string,
    mimeType: string = "image/jpeg"
  ): Promise<string | null> {
    const url = `${this.baseUrl}/models/veo-3.0-generate-001:predictLongRunning`;

    const payload: any = {
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

      if (!response.ok) return null;

      const data: any = await response.json();
      const operationName = data.name || null;

      if (operationName) {
        return operationName;
      } else {
        return null;
      }
    } catch (e: any) {
      return null;
    }
  }

  private async _waitForCompletion(
    operationName: string,
    maxWaitTime: number = 600
  ): Promise<string | null> {
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

        const data: any = await response.json();

        if (data.error) return null;

        const isDone = data.done || false;

        if (isDone) {
          try {
            const videoUri =
              data.response.generateVideoResponse.generatedSamples[0].video.uri;
            return videoUri;
          } catch {
            return null;
          }
        }

        await this._sleep(pollInterval);
        pollInterval = Math.min(pollInterval * 1.2, 30000);
      } catch (e: any) {
        await this._sleep(pollInterval);
      }
    }

    return null;
  }

  private async _downloadVideoBytes(videoUri: string): Promise<Buffer | null> {
    try {
      // Convert Google URI to LiteLLM proxy URI
      const parts = videoUri.split(
        "https://generativelanguage.googleapis.com/v1beta/"
      );
      if (parts.length < 2) return null;
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

      while (
        [301, 302, 303, 307, 308].includes(response.status) &&
        redirectCount < maxRedirects
      ) {
        const redirectUrl = response.headers.get("location");
        console.log(`Debug: Redirect #${redirectCount + 1} to: ${redirectUrl}`);
        if (!redirectUrl) return null;

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

      if (
        !contentType.startsWith("video/") &&
        !contentType.startsWith("application/octet-stream")
      ) {
        console.log(
          "Debug: Content type doesn't look like video, trying fallback approach"
        );
        const finalResponse = await fetch(litellmDownloadUrl, {
          headers: this.headers,
          redirect: "follow",
        });
        if (!finalResponse.ok) return null;
        response = finalResponse;
      }

      const arrayBuffer = await response.arrayBuffer();
      const videoData = Buffer.from(arrayBuffer);

      console.log(`Debug: Downloaded ${videoData.length} bytes`);

      // Verify we actually got video data (should be at least 1KB)
      if (videoData.length < 1000) {
        console.log(
          `Debug: Video data too small (${videoData.length} bytes), returning null`
        );
        return null;
      }

      return videoData;
    } catch (e: any) {
      console.error(`Debug: Request exception: ${e.message}`);
      return null;
    }
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
