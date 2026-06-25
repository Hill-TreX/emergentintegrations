/**
 * OpenAI Sora video generation client using emergent proxy.
 * Exact port of llm/openai/video_generation.py
 */
import * as fs from "fs";
import { getAppIdentifier, getIntegrationProxyUrl } from "../utils";

export class OpenAIVideoGeneration {
  /** Supported models */
  static MODELS = ["sora-2", "sora-2-pro"];

  /** Supported video sizes */
  static SIZES: Record<string, { width: number; height: number }> = {
    "1280x720": { width: 1280, height: 720 },
    "1792x1024": { width: 1792, height: 1024 },
    "1024x1792": { width: 1024, height: 1792 },
    "1024x1024": { width: 1024, height: 1024 },
  };

  /** Supported durations in seconds */
  static DURATIONS = [4, 8, 12];

  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(apiKey: string, customHeaders?: Record<string, string>) {
    const proxyUrl = getIntegrationProxyUrl();
    this.baseUrl = proxyUrl + "/llm/openai/v1";

    const mergedHeaders = customHeaders || {};
    const appUrl = getAppIdentifier();
    if (appUrl) {
      mergedHeaders["X-App-ID"] = appUrl;
    }

    this.headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...mergedHeaders,
    };
  }

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
  async textToVideo(
    prompt: string,
    model: string = "sora-2",
    size: string = "1280x720",
    duration: number = 4,
    maxWaitTime: number = 600,
    imagePath?: string,
    mimeType: string = "image/jpeg"
  ): Promise<Buffer | null> {
    // Validate parameters
    if (!OpenAIVideoGeneration.MODELS.includes(model)) {
      throw new Error(
        `Invalid model: ${model}. Must be one of ${OpenAIVideoGeneration.MODELS}`
      );
    }
    if (!(size in OpenAIVideoGeneration.SIZES)) {
      throw new Error(
        `Invalid size: ${size}. Must be one of ${Object.keys(OpenAIVideoGeneration.SIZES)}`
      );
    }
    if (!OpenAIVideoGeneration.DURATIONS.includes(duration)) {
      throw new Error(
        `Invalid duration: ${duration}. Must be one of ${OpenAIVideoGeneration.DURATIONS}`
      );
    }

    // Initiate video generation
    const operationId = await this._generateVideo(
      prompt,
      model,
      size,
      duration,
      imagePath,
      mimeType
    );
    if (!operationId) return null;

    // Wait for completion
    const videoUri = await this._waitForCompletion(operationId, maxWaitTime);
    if (!videoUri) return null;

    // Download the video
    return this._downloadVideoBytes(videoUri);
  }

  private async _generateVideo(
    prompt: string,
    model: string,
    size: string,
    duration: number,
    imagePath?: string,
    mimeType: string = "image/jpeg"
  ): Promise<string | null> {
    const url = `${this.baseUrl}/videos`;

    // According to Sora 2 API docs, duration is passed as "seconds" and as a string
    const payload: any = {
      model,
      prompt,
      size,
      seconds: String(duration),
    };

    // Add reference image if provided
    if (imagePath) {
      const fileBytes = fs.readFileSync(imagePath);
      const encodedString = fileBytes.toString("base64");
      payload.reference_image = {
        data: `data:${mimeType};base64,${encodedString}`,
      };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`Error initiating video generation: ${response.status}`);
        return null;
      }

      const data: any = await response.json();

      // OpenAI may return the operation ID differently
      const operationId =
        data.id || data.operation_id || data.generation_id || null;

      if (operationId) {
        console.log(`Video generation initiated with ID: ${operationId}`);
        return operationId;
      } else {
        console.error(`Error: No operation ID in response: ${JSON.stringify(data)}`);
        return null;
      }
    } catch (e: any) {
      console.error(`Error initiating video generation: ${e.message}`);
      return null;
    }
  }

  private async _waitForCompletion(
    operationId: string,
    maxWaitTime: number = 600
  ): Promise<string | null> {
    const operationUrl = `${this.baseUrl}/videos/${operationId}`;
    const startTime = Date.now();
    let pollInterval = 10000; // Start with 10 seconds (in ms)

    console.log(
      `Waiting for video generation to complete (ID: ${operationId})...`
    );

    while (Date.now() - startTime < maxWaitTime * 1000) {
      try {
        const response = await fetch(operationUrl, { headers: this.headers });

        if (!response.ok) {
          await this._sleep(pollInterval);
          continue;
        }

        const data: any = await response.json();

        // Check for errors
        if (data.error) {
          console.error(`Error in video generation: ${JSON.stringify(data.error)}`);
          return null;
        }

        // Check status - be flexible with case
        let status = (data.status || "").toLowerCase();
        if (!status) status = (data.state || "").toLowerCase();
        if (!status) status = (data.job_status || "").toLowerCase();

        // Check if completed
        if (
          ["completed", "complete", "succeeded", "success", "done"].includes(status)
        ) {
          console.log("Video generation completed!");

          // Extract video URI from response - try multiple possible structures
          let videoUri: string | null = null;

          if (data.output && data.output.video_url) {
            videoUri = data.output.video_url;
          } else if (data.video && data.video.url) {
            videoUri = data.video.url;
          } else if (data.result && data.result.video_url) {
            videoUri = data.result.video_url;
          } else if (data.video_url) {
            videoUri = data.video_url;
          } else if (data.url) {
            videoUri = data.url;
          } else if (data.download_url) {
            videoUri = data.download_url;
          } else if (data.output_url) {
            videoUri = data.output_url;
          }

          // If no URL in response, construct the download URL using the video ID
          if (!videoUri) {
            const videoId = data.id || operationId;
            videoUri = `${this.baseUrl}/videos/${videoId}/content`;
            console.log(
              `No URL in response, constructed download URL: ${videoUri}`
            );
          }

          if (videoUri) {
            console.log(`Video ready at: ${videoUri}`);
            return videoUri;
          } else {
            console.error("Error: Could not determine video download URL");
            return null;
          }
        } else if (["failed", "error", "cancelled"].includes(status)) {
          console.error(
            `Video generation failed: ${data.error || "Unknown error"}`
          );
          return null;
        } else if (
          [
            "pending",
            "in_progress",
            "processing",
            "running",
            "queued",
            "started",
          ].includes(status)
        ) {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const progress = data.progress || 0;
          console.log(
            `Still processing... (${elapsed}s elapsed, status: ${status}, progress: ${progress}%)`
          );
        } else {
          // If no recognizable status, check if video is ready by other means
          if (
            data.video_url ||
            data.url ||
            data.download_url ||
            data.output_url
          ) {
            const uri =
              data.video_url || data.url || data.download_url || data.output_url;
            if (uri) return uri;
          }
        }

        // Wait with exponential backoff
        await this._sleep(pollInterval);
        pollInterval = Math.min(pollInterval * 1.2, 30000); // Max 30 seconds
      } catch (e: any) {
        console.error(`Error checking status: ${e.message}`);
        await this._sleep(pollInterval);
      }
    }

    console.error(
      `Timeout: Video generation did not complete within ${maxWaitTime} seconds`
    );
    return null;
  }

  private async _downloadVideoBytes(videoUri: string): Promise<Buffer | null> {
    try {
      console.log(`Downloading video from: ${videoUri}`);

      // Convert OpenAI URI to emergent proxy URI if needed
      let downloadUrl: string;
      if (videoUri.includes("api.openai.com")) {
        const pathParts = videoUri.split("api.openai.com/v1/");
        if (pathParts.length > 1) {
          downloadUrl = `${this.baseUrl}/${pathParts[1]}`;
        } else {
          downloadUrl = videoUri;
        }
      } else {
        downloadUrl = videoUri;
      }

      console.log(`Final download URL: ${downloadUrl}`);

      // Initial request without following redirects
      let response = await fetch(downloadUrl, {
        headers: this.headers,
        redirect: "manual",
      });

      console.log(`Initial response status: ${response.status}`);

      // Handle redirects manually
      let redirectCount = 0;
      const maxRedirects = 5;

      while (
        [301, 302, 303, 307, 308].includes(response.status) &&
        redirectCount < maxRedirects
      ) {
        const redirectUrl = response.headers.get("location");
        console.log(`Redirect #${redirectCount + 1} to: ${redirectUrl}`);

        if (!redirectUrl) {
          console.error("Error: No redirect URL provided");
          return null;
        }

        redirectCount++;
        response = await fetch(redirectUrl, {
          headers: this.headers,
          redirect: "manual",
        });
        console.log(`Redirect response status: ${response.status}`);
      }

      if (response.status !== 200) {
        console.error(`Error: Final status code: ${response.status}`);
        return null;
      }

      // Verify content type
      const contentType = response.headers.get("content-type") || "";
      console.log(`Content-Type: ${contentType}`);

      // If content type doesn't look like video, try with full redirect following
      if (
        !contentType.startsWith("video/") &&
        !contentType.startsWith("application/octet-stream")
      ) {
        console.log(
          "Content type doesn't look like video, trying fallback approach"
        );
        const fallbackResponse = await fetch(downloadUrl, {
          headers: this.headers,
          redirect: "follow",
        });
        if (!fallbackResponse.ok) return null;
        response = fallbackResponse;
      }

      // Download video bytes
      const arrayBuffer = await response.arrayBuffer();
      const videoData = Buffer.from(arrayBuffer);

      console.log(`Downloaded ${videoData.length} bytes`);

      // Verify we got actual video data (should be much larger than 1KB)
      if (videoData.length < 1000) {
        console.error(
          `Error: Video data too small (${videoData.length} bytes)`
        );
        return null;
      }

      return videoData;
    } catch (e: any) {
      console.error(`Error downloading video: ${e.message}`);
      return null;
    }
  }

  /**
   * Save video bytes to a file.
   */
  saveVideo(videoBytes: Buffer, outputPath?: string): string {
    const filePath = outputPath || `openai_video_${Date.now()}.mp4`;
    fs.writeFileSync(filePath, videoBytes);
    console.log(`Video saved to: ${filePath}`);
    return filePath;
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
