export interface CheckoutSessionRequest {
    /** The amount to charge in the specified currency */
    amount?: number;
    /** The currency code (default: "usd") */
    currency?: string;
    /** The Stripe Price ID to use for the payment */
    stripe_price_id?: string;
    /** The quantity of items to purchase (default: 1) */
    quantity?: number;
    /** URL to redirect to after successful payment (should contain session_id={CHECKOUT_SESSION_ID}) */
    success_url?: string;
    /** URL to redirect to if payment is cancelled */
    cancel_url?: string;
    /** Additional metadata to store with the session */
    metadata?: Record<string, string>;
    /** Stripe payment method types (default: ['card']) */
    payment_methods?: string[];
}
export interface CheckoutSessionResponse {
    /** The stripe checkout session URL to redirect the customer to */
    url: string;
    /** The ID of the created session */
    session_id: string;
}
export interface CheckoutStatusResponse {
    /** The status of the checkout session */
    status: string;
    /** The payment status */
    payment_status: string;
    /** The total amount in cents */
    amount_total: number;
    /** The currency code */
    currency: string;
    /** The metadata of the checkout session */
    metadata: Record<string, string>;
}
export interface WebhookEventResponse {
    /** The type of webhook event */
    event_type: string;
    /** The ID of the webhook event */
    event_id: string;
    /** The checkout session ID if applicable */
    session_id?: string;
    /** The payment status if applicable */
    payment_status?: string;
    /** The metadata of the event */
    metadata: Record<string, string>;
}
export declare class CheckoutError extends Error {
    constructor(message: string);
}
export declare class StripeCheckout {
    private stripe;
    private webhookSecret?;
    private webhookUrl?;
    /**
     * Initialize the Stripe checkout integration.
     *
     * @param apiKey - The Stripe API key
     * @param webhookSecret - The webhook signing secret for validating webhook events
     * @param webhookUrl - The webhook URL to include in metadata
     */
    constructor(apiKey: string, webhookSecret?: string, webhookUrl?: string);
    /**
     * Validate a CheckoutSessionRequest.
     * Mirrors the Python Pydantic validators.
     */
    private _validateRequest;
    /**
     * Normalize payment methods array.
     * Mirrors the Python validator.
     */
    private _normalizePaymentMethods;
    /**
     * Creates a Stripe checkout session for a payment.
     */
    createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSessionResponse>;
    /**
     * Retrieves the status of a Stripe checkout session.
     */
    getCheckoutStatus(checkoutSessionId: string): Promise<CheckoutStatusResponse>;
    /**
     * Handles a Stripe webhook event by processing the event payload.
     *
     * @param payload - The raw webhook payload from Stripe (Buffer or string)
     * @param signature - The Stripe-Signature header value
     */
    handleWebhook(payload: Buffer | string, signature?: string): Promise<WebhookEventResponse>;
}
//# sourceMappingURL=checkout.d.ts.map