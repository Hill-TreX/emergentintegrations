"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeCheckout = exports.CheckoutError = void 0;
/**
 * Stripe checkout integration for payment processing.
 * Exact port of payments/stripe/checkout.py
 */
const stripe_1 = __importDefault(require("stripe"));
// ============================================================
// Error Class
// ============================================================
class CheckoutError extends Error {
    constructor(message) {
        super(message);
        this.name = "CheckoutError";
    }
}
exports.CheckoutError = CheckoutError;
// ============================================================
// StripeCheckout Class
// ============================================================
class StripeCheckout {
    /**
     * Initialize the Stripe checkout integration.
     *
     * @param apiKey - The Stripe API key
     * @param webhookSecret - The webhook signing secret for validating webhook events
     * @param webhookUrl - The webhook URL to include in metadata
     */
    constructor(apiKey, webhookSecret, webhookUrl) {
        this.webhookSecret = webhookSecret;
        this.webhookUrl = webhookUrl;
        // If api key contains sk_test_emergent, set api base to emergent integration proxy
        const stripeOpts = {
            apiVersion: "2024-06-20",
        };
        if (apiKey.includes("sk_test_emergent")) {
            stripeOpts.host = "integrations.emergentagent.com";
            stripeOpts.protocol = "https";
            stripeOpts.port = 443;
        }
        this.stripe = new stripe_1.default(apiKey, stripeOpts);
    }
    /**
     * Validate a CheckoutSessionRequest.
     * Mirrors the Python Pydantic validators.
     */
    _validateRequest(request) {
        if (request.amount !== undefined && request.amount <= 0) {
            throw new CheckoutError("Amount must be greater than 0");
        }
        if (request.quantity !== undefined && request.quantity < 1) {
            throw new CheckoutError("Quantity must be greater than 0");
        }
        if (request.stripe_price_id === undefined &&
            request.amount === undefined) {
            throw new CheckoutError("Either amount or stripe_price_id must be provided");
        }
        if (request.stripe_price_id !== undefined &&
            request.amount !== undefined) {
            throw new CheckoutError("Cannot provide both amount and stripe_price_id");
        }
    }
    /**
     * Normalize payment methods array.
     * Mirrors the Python validator.
     */
    _normalizePaymentMethods(methods) {
        if (!methods || methods.length === 0)
            return ["card"];
        const normalized = [];
        for (const method of methods) {
            if (!normalized.includes(method)) {
                normalized.push(method);
            }
        }
        return normalized.length > 0 ? normalized : ["card"];
    }
    /**
     * Creates a Stripe checkout session for a payment.
     */
    async createCheckoutSession(request) {
        try {
            this._validateRequest(request);
            // Prepare line items based on payment method
            let lineItems;
            if (request.amount !== undefined) {
                // Convert amount to cents/smallest currency unit
                const amountInCents = Math.round(request.amount * 100);
                lineItems = [
                    {
                        price_data: {
                            currency: request.currency || "usd",
                            product_data: { name: "Payment" },
                            unit_amount: amountInCents,
                        },
                        quantity: 1,
                    },
                ];
            }
            else {
                lineItems = [
                    {
                        price: request.stripe_price_id,
                        quantity: request.quantity || 1,
                    },
                ];
            }
            // Merge webhook url with metadata
            let metadata = request.metadata || {};
            if (this.webhookUrl) {
                metadata = { ...metadata, webhook_url: this.webhookUrl };
            }
            const paymentMethods = this._normalizePaymentMethods(request.payment_methods);
            // Create the checkout session
            const session = await this.stripe.checkout.sessions.create({
                payment_method_types: paymentMethods,
                line_items: lineItems,
                mode: "payment",
                success_url: request.success_url,
                cancel_url: request.cancel_url,
                metadata,
            });
            return {
                url: session.url,
                session_id: session.id,
            };
        }
        catch (e) {
            if (e instanceof CheckoutError)
                throw e;
            if (e.type && e.type.startsWith("Stripe")) {
                throw new CheckoutError(`Failed to create checkout session: ${e.message}`);
            }
            throw new CheckoutError(`Unexpected error creating checkout session: ${e.message}`);
        }
    }
    /**
     * Retrieves the status of a Stripe checkout session.
     */
    async getCheckoutStatus(checkoutSessionId) {
        try {
            const session = await this.stripe.checkout.sessions.retrieve(checkoutSessionId);
            return {
                status: session.status,
                payment_status: session.payment_status,
                amount_total: session.amount_total || 0,
                currency: session.currency || "",
                metadata: session.metadata || {},
            };
        }
        catch (e) {
            if (e.type && e.type.startsWith("Stripe")) {
                throw new CheckoutError(`Failed to retrieve session status: ${e.message}`);
            }
            throw new CheckoutError(`Unexpected error retrieving session status: ${e.message}`);
        }
    }
    /**
     * Handles a Stripe webhook event by processing the event payload.
     *
     * @param payload - The raw webhook payload from Stripe (Buffer or string)
     * @param signature - The Stripe-Signature header value
     */
    async handleWebhook(payload, signature) {
        try {
            let event;
            if (this.webhookSecret && signature) {
                event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
            }
            else {
                const payloadStr = typeof payload === "string" ? payload : payload.toString("utf-8");
                event = JSON.parse(payloadStr);
            }
            // Extract relevant information based on event type
            const eventType = event.type;
            const eventId = event.id;
            const metadata = event.data?.object?.metadata || {};
            let sessionId;
            let paymentStatus;
            // Handle different event types
            if (eventType === "checkout.session.completed") {
                const sessionData = event.data.object;
                sessionId = sessionData.id;
                paymentStatus = sessionData.payment_status;
            }
            else if (eventType === "checkout.session.expired") {
                const sessionData = event.data.object;
                sessionId = sessionData.id;
                paymentStatus = sessionData.payment_status;
            }
            else if (eventType === "payment_intent.succeeded") {
                const paymentData = event.data.object;
                sessionId = paymentData.metadata?.checkout_session_id;
                paymentStatus = "paid";
            }
            else if (eventType === "payment_intent.payment_failed") {
                const paymentData = event.data.object;
                sessionId = paymentData.metadata?.checkout_session_id;
                paymentStatus = "failed";
            }
            return {
                event_type: eventType,
                event_id: eventId,
                session_id: sessionId,
                payment_status: paymentStatus,
                metadata,
            };
        }
        catch (e) {
            if (e instanceof SyntaxError) {
                throw new CheckoutError(`Invalid JSON payload: ${e.message}`);
            }
            throw new CheckoutError(`Unexpected error processing webhook: ${e.message}`);
        }
    }
}
exports.StripeCheckout = StripeCheckout;
//# sourceMappingURL=checkout.js.map