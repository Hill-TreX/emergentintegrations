/**
 * Stripe checkout integration for payment processing.
 * Exact port of payments/stripe/checkout.py
 */
import Stripe from "stripe";

// ============================================================
// Request/Response Interfaces (matching Python Pydantic models)
// ============================================================

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

// ============================================================
// Error Class
// ============================================================

export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

// ============================================================
// StripeCheckout Class
// ============================================================

export class StripeCheckout {
  private stripe: Stripe;
  private webhookSecret?: string;
  private webhookUrl?: string;

  /**
   * Initialize the Stripe checkout integration.
   *
   * @param apiKey - The Stripe API key
   * @param webhookSecret - The webhook signing secret for validating webhook events
   * @param webhookUrl - The webhook URL to include in metadata
   */
  constructor(
    apiKey: string,
    webhookSecret?: string,
    webhookUrl?: string
  ) {
    this.webhookSecret = webhookSecret;
    this.webhookUrl = webhookUrl;

    // If api key contains sk_test_emergent, set api base to emergent integration proxy
    const stripeOpts: Stripe.StripeConfig = {
      apiVersion: "2024-06-20" as any,
    };

    if (apiKey.includes("sk_test_emergent")) {
      stripeOpts.host = "integrations.emergentagent.com";
      stripeOpts.protocol = "https";
      stripeOpts.port = 443;
    }

    this.stripe = new Stripe(apiKey, stripeOpts);
  }

  /**
   * Validate a CheckoutSessionRequest.
   * Mirrors the Python Pydantic validators.
   */
  private _validateRequest(request: CheckoutSessionRequest): void {
    if (request.amount !== undefined && request.amount <= 0) {
      throw new CheckoutError("Amount must be greater than 0");
    }
    if (request.quantity !== undefined && request.quantity < 1) {
      throw new CheckoutError("Quantity must be greater than 0");
    }
    if (
      request.stripe_price_id === undefined &&
      request.amount === undefined
    ) {
      throw new CheckoutError(
        "Either amount or stripe_price_id must be provided"
      );
    }
    if (
      request.stripe_price_id !== undefined &&
      request.amount !== undefined
    ) {
      throw new CheckoutError(
        "Cannot provide both amount and stripe_price_id"
      );
    }
  }

  /**
   * Normalize payment methods array.
   * Mirrors the Python validator.
   */
  private _normalizePaymentMethods(methods?: string[]): string[] {
    if (!methods || methods.length === 0) return ["card"];

    const normalized: string[] = [];
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
  async createCheckoutSession(
    request: CheckoutSessionRequest
  ): Promise<CheckoutSessionResponse> {
    try {
      this._validateRequest(request);

      // Prepare line items based on payment method
      let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];

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
      } else {
        lineItems = [
          {
            price: request.stripe_price_id!,
            quantity: request.quantity || 1,
          },
        ];
      }

      // Merge webhook url with metadata
      let metadata = request.metadata || {};
      if (this.webhookUrl) {
        metadata = { ...metadata, webhook_url: this.webhookUrl };
      }

      const paymentMethods = this._normalizePaymentMethods(
        request.payment_methods
      );

      // Create the checkout session
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: paymentMethods as any[],
        line_items: lineItems,
        mode: "payment",
        success_url: request.success_url,
        cancel_url: request.cancel_url,
        metadata,
      });

      return {
        url: session.url!,
        session_id: session.id,
      };
    } catch (e: any) {
      if (e instanceof CheckoutError) throw e;
      if (e.type && e.type.startsWith("Stripe")) {
        throw new CheckoutError(
          `Failed to create checkout session: ${e.message}`
        );
      }
      throw new CheckoutError(
        `Unexpected error creating checkout session: ${e.message}`
      );
    }
  }

  /**
   * Retrieves the status of a Stripe checkout session.
   */
  async getCheckoutStatus(
    checkoutSessionId: string
  ): Promise<CheckoutStatusResponse> {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(
        checkoutSessionId
      );

      return {
        status: session.status as string,
        payment_status: session.payment_status,
        amount_total: session.amount_total || 0,
        currency: session.currency || "",
        metadata: (session.metadata as Record<string, string>) || {},
      };
    } catch (e: any) {
      if (e.type && e.type.startsWith("Stripe")) {
        throw new CheckoutError(
          `Failed to retrieve session status: ${e.message}`
        );
      }
      throw new CheckoutError(
        `Unexpected error retrieving session status: ${e.message}`
      );
    }
  }

  /**
   * Handles a Stripe webhook event by processing the event payload.
   *
   * @param payload - The raw webhook payload from Stripe (Buffer or string)
   * @param signature - The Stripe-Signature header value
   */
  async handleWebhook(
    payload: Buffer | string,
    signature?: string
  ): Promise<WebhookEventResponse> {
    try {
      let event: any;

      if (this.webhookSecret && signature) {
        event = this.stripe.webhooks.constructEvent(
          payload,
          signature,
          this.webhookSecret
        );
      } else {
        const payloadStr =
          typeof payload === "string" ? payload : payload.toString("utf-8");
        event = JSON.parse(payloadStr);
      }

      // Extract relevant information based on event type
      const eventType: string = event.type;
      const eventId: string = event.id;
      const metadata: Record<string, string> =
        event.data?.object?.metadata || {};

      let sessionId: string | undefined;
      let paymentStatus: string | undefined;

      // Handle different event types
      if (eventType === "checkout.session.completed") {
        const sessionData = event.data.object;
        sessionId = sessionData.id;
        paymentStatus = sessionData.payment_status;
      } else if (eventType === "checkout.session.expired") {
        const sessionData = event.data.object;
        sessionId = sessionData.id;
        paymentStatus = sessionData.payment_status;
      } else if (eventType === "payment_intent.succeeded") {
        const paymentData = event.data.object;
        sessionId = paymentData.metadata?.checkout_session_id;
        paymentStatus = "paid";
      } else if (eventType === "payment_intent.payment_failed") {
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
    } catch (e: any) {
      if (e instanceof SyntaxError) {
        throw new CheckoutError(`Invalid JSON payload: ${e.message}`);
      }
      throw new CheckoutError(
        `Unexpected error processing webhook: ${e.message}`
      );
    }
  }
}
