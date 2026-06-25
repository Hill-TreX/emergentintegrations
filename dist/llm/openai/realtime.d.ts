/**
 * OpenAI Realtime WebRTC integration.
 * Exact port of llm/openai/realtime.py
 */
export declare class OpenAIChatRealtime {
    private apiKey;
    constructor(apiKey: string);
    /**
     * Creates an ephemeral session for audio chat.
     */
    createEphemeralSessionForAudioChat(voice?: string, model?: string): Promise<any>;
    /**
     * Negotiates the WebRTC connection using the provided SDP offer.
     *
     * @param sdpOffer - The SDP offer from the client
     * @param model - The model to use
     * @returns The SDP answer from OpenAI's server
     */
    negotiateConnection(sdpOffer: string, model?: string): Promise<string>;
    /**
     * Creates Express-compatible route handlers for realtime endpoints.
     * Returns an object with handler functions that can be mounted on any Express router.
     *
     * Usage:
     *   const handlers = OpenAIChatRealtime.createRouteHandlers(realtimeInstance);
     *   router.post('/realtime/session', handlers.createSession);
     *   router.post('/realtime/negotiate', handlers.negotiate);
     */
    static createRouteHandlers(openaiRealtime: OpenAIChatRealtime): {
        createSession: (req: any, res: any) => Promise<void>;
        negotiate: (req: any, res: any) => Promise<void>;
    };
}
//# sourceMappingURL=realtime.d.ts.map