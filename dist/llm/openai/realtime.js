"use strict";
/**
 * OpenAI Realtime WebRTC integration.
 * Exact port of llm/openai/realtime.py
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIChatRealtime = void 0;
class OpenAIChatRealtime {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    /**
     * Creates an ephemeral session for audio chat.
     */
    async createEphemeralSessionForAudioChat(voice = "verse", model = "gpt-4o-realtime-preview-2024-12-17") {
        const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ model, voice }),
        });
        return response.json();
    }
    /**
     * Negotiates the WebRTC connection using the provided SDP offer.
     *
     * @param sdpOffer - The SDP offer from the client
     * @param model - The model to use
     * @returns The SDP answer from OpenAI's server
     */
    async negotiateConnection(sdpOffer, model = "gpt-4o-realtime-preview-2024-12-17") {
        const response = await fetch(`https://api.openai.com/v1/realtime?model=${model}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/sdp",
            },
            body: sdpOffer,
        });
        return response.text();
    }
    /**
     * Creates Express-compatible route handlers for realtime endpoints.
     * Returns an object with handler functions that can be mounted on any Express router.
     *
     * Usage:
     *   const handlers = OpenAIChatRealtime.createRouteHandlers(realtimeInstance);
     *   router.post('/realtime/session', handlers.createSession);
     *   router.post('/realtime/negotiate', handlers.negotiate);
     */
    static createRouteHandlers(openaiRealtime) {
        return {
            createSession: async (req, res) => {
                try {
                    const session = await openaiRealtime.createEphemeralSessionForAudioChat();
                    res.json(session);
                }
                catch (e) {
                    res.status(500).json({ detail: e.message });
                }
            },
            negotiate: async (req, res) => {
                try {
                    let sdpOffer;
                    if (Buffer.isBuffer(req.body)) {
                        sdpOffer = req.body.toString("utf-8");
                    }
                    else if (typeof req.body === "string") {
                        sdpOffer = req.body;
                    }
                    else {
                        // If body-parser has parsed it, try to get raw
                        sdpOffer = JSON.stringify(req.body);
                    }
                    const sdpAnswer = await openaiRealtime.negotiateConnection(sdpOffer);
                    res.json({ sdp: sdpAnswer });
                }
                catch (e) {
                    res.status(500).json({ detail: e.message });
                }
            },
        };
    }
}
exports.OpenAIChatRealtime = OpenAIChatRealtime;
//# sourceMappingURL=realtime.js.map