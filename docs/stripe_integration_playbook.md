### Stripe Checkout API integration

Follow below integration strictly and it will work.

The path to import library is 
```python
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

```

# Initialize the stripe checkout with stripe API key
```python
stripe_checkout = StripeCheckout(api_key=api_key)
```
# To implement checkout status api use
```python
checkout_status : CheckoutStatusResponse = await stripe_checkout.get_checkout_status(checkout_session_id : str)
```
The input and output models of get_checkout_status are:

```python
    Retrieves the status of a Stripe checkout session.

    Input Args:
        checkout_session_id (str): The ID of the checkout session to check.

    Response Model:
    CheckoutStatusResponse(BaseModel):
    """Response model for checkout session status."""
    status: str = Field(..., description="The status of the checkout session")
    payment_status: str = Field(..., description="The payment status")
    amount_total: int = Field(..., description="The total amount in cents")
    currency: str = Field(..., description="The currency code")
    metadata: Dict[str, str] = Field(..., description="The metadata of the checkout session")

```

# To create checkout session for Custom amount with currency
```python
checkoutrequest = CheckoutSessionRequest(amount=amount, currency=currency, success_url=success_url, cancel_url=cancel_url, metadata=metadata)
#
session : CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkoutrequest)
```
# To create checkout session for fixed price stripe product
```python
checkoutrequest = CheckoutSessionRequest(stripe_price_id=stripe_price_id, quantity=quantity, success_url=success_url, cancel_url=cancel_url, metadata=metadata)
session : CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkoutrequest)
```
**The success_url and cancel_url in create_checkout_session should be created by frontend and stripe should redirect to frontend and then the frontend should call the backend to get the payment status on success as shown in the js example below**

The input and output models for create_checkout_session are:
```python

    CheckoutSessionRequest(BaseModel):
    """Request model for creating a checkout session."""
    amount: Optional[float] = Field(None, description="The amount to charge in the specified currency")
    currency: str = Field("usd", description="The currency code")
    stripe_price_id: Optional[str] = Field(None, description="The Stripe Price ID to use for the payment")
    quantity: int = Field(1, description="The quantity of items to purchase")
    success_url: Optional[str] = Field(None, description="URL to redirect to after successful payment, should contain the variable session_id={CHECKOUT_SESSION_ID} to fill in the session id")
    cancel_url: Optional[str] = Field(None, description="URL to redirect to if payment is cancelled")
    metadata: Optional[Dict[str, str]] = Field(None, description="Additional metadata to store with the session")


    CheckoutSessionResponse(BaseModel):
    """Response model for checkout session creation."""
    url: str = Field(..., description="The stripe checkout session URL to redirect the customer to")
    session_id: str = Field(..., description="The ID of the created session")
    
```

The metadata in CheckoutSessionRequest can be used to set parameters which help in indentifying and connecting the checkout sesion with a user/auth 



**MANDATORILY CREATE A NEW TABLE payment_transactions while integrating payments, to store the data for each payment transaction.**

Expected Flow:
1. User clicks to perform payment
2. Frontend will call the api to create checkout session. the backend will call a create_checkout_session function
3. **In case of custom amount and currency, the amount and currency should be fetched and set by the backend and should not be sent by the frontend to backend to prevent price manipulation on frontend**
4. **After create checkout session returns, it is MANDATORY TO CREATE AN ENTRY IN payment_transactions TABLE WITH DATA LIKE AMOUNT, CURRENCY, METADATA, SESSION_ID, PAYMENT_ID, USER_ID/EMAIL (ONLY IF AUTH IS ENABLED), AND LASTLY PAYMENT_STATUS field  AND ADD IT AS INITIATED OR PENDING.**
5. The user completes payment and is redirected to the frontend via success url
6. The frontend gets the session_id from the url and calls api to get checkout status
7. **The api calls get_checkout_status to get status of checkout sesion. upon getting the status, the entry in payment_transactions table is updated with new status and payment_status fields based on success/failure/expiration of the payment request.**
8. In the case of cancelation of checkout session, the redirect should be back to the page where payment request was made
9. In case of success, perform the other related operations.

You can expose APIs for above items in backend.
Check the examples in below js content

```js   
// Function to toggle between payment methods
function togglePaymentMethod() {{
    const paymentType = document.querySelector('input[name="paymentType"]:checked').value;
    document.getElementById('amountSection').classList.toggle('active', paymentType === 'amount');
    document.getElementById('priceSection').classList.toggle('active', paymentType === 'price');
}}

// Function to get URL parameters
function getUrlParameter(name) {{
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}}

// Function to update status display
function updateStatus(message, type) {{
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${{type}}`;
}}

// Function to poll payment status
async function pollPaymentStatus(sessionId, attempts = 0) {{
    const maxAttempts = 5;
    const pollInterval = 2000; // 2 seconds

    if (attempts >= maxAttempts) {{
        updateStatus('Payment status check timed out. Please check your email for confirmation.', 'error');
        return;
    }}

    try {{
        const response = await fetch(`/api/payments/v1/checkout/status/${{sessionId}}`);
        if (!response.ok) {{
            throw new Error('Failed to check payment status');
        }}

        const data = await response.json();
        
        if (data.payment_status === 'paid') {{
            updateStatus('Payment successful! Thank you for your purchase.', 'success');
            return;
        }} else if (data.status === 'expired') {{
            updateStatus('Payment session expired. Please try again.', 'error');
            return;
        }}

        // If payment is still pending, continue polling
        updateStatus('Payment is being processed...', 'pending');
        setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), pollInterval);
    }} catch (error) {{
        console.error('Error checking payment status:', error);
        updateStatus('Error checking payment status. Please try again.', 'error');
    }}
}}

// Function to check if we're returning from Stripe
function checkReturnFromStripe() {{
    const sessionId = getUrlParameter('session_id');
    if (sessionId) {{
        updateStatus('Checking payment status...', 'pending');
        pollPaymentStatus(sessionId);
    }}
}}

async function initiatePayment() {{
    const errorDiv = document.getElementById('error');
    const paymentType = document.querySelector('input[name="paymentType"]:checked').value;
    let requestBody = {{}};

    // Validate based on payment type
    if (paymentType === 'amount') {{
        const amount = parseFloat(document.getElementById('amount').value);
        const currency = document.getElementById('currency').value;

        if (!amount || amount <= 0) {{
            errorDiv.textContent = 'Please enter a valid amount greater than 0';
            return;
        }}

        requestBody = {{
            amount: amount,
            currency: currency
        }};
    }} else {{
        const priceId = document.getElementById('priceId').value.trim();
        const quantity = parseInt(document.getElementById('quantity').value);

        if (!priceId) {{
            errorDiv.textContent = 'Please enter a valid Stripe Price ID';
            return;
        }}

        requestBody = {{
            stripe_price_id: priceId,
            quantity: quantity
        }};
    }}

    try {{
        // Get current URL for success and cancel URLs
        const currentUrl = window.location.href.split('?')[0];
        const successUrl = `${{currentUrl}}?session_id={{CHECKOUT_SESSION_ID}}`;
        const cancelUrl = currentUrl;

        // Add URLs and metadata to request body
        requestBody.success_url = successUrl;
        requestBody.cancel_url = cancelUrl;
        requestBody.metadata = {{
            source: 'web_checkout',
            payment_type: paymentType
        }};

        // Call the checkout session API
        const response = await fetch('/api/payments/v1/checkout/session', {{
            method: 'POST',
            headers: {{
                'Content-Type': 'application/json',
            }},
            body: JSON.stringify(requestBody)
        }});

        if (!response.ok) {{
            throw new Error('Failed to create checkout session');
        }}

        const data = await response.json();
        
        // Redirect to Stripe Checkout
        if (data.url) {{
            window.location.href = data.url;
        }} else {{
            throw new Error('No checkout URL received');
        }}
    }} catch (error) {{
        errorDiv.textContent = error.message;
        console.error('Payment error:', error);
    }}
}}

// Check if we're returning from Stripe when the page loads
document.addEventListener('DOMContentLoaded', checkReturnFromStripe);
```
