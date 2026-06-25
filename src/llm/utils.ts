/**
 * Utility functions for LLM integrations.
 */

/**
 * Get the application identifier from environment variables.
 * Tries APP_URL first (preview pods), then falls back to
 * REACT_APP_BACKEND_URL (deployed apps).
 */
export function getAppIdentifier(): string | undefined {
  const appUrl = process.env.APP_URL;
  if (appUrl) return appUrl;
  return process.env.REACT_APP_BACKEND_URL || undefined;
}

/**
 * Get the integration proxy URL from environment variables.
 * Priority: INTEGRATION_PROXY_URL > integration_proxy_url > default
 */
export function getIntegrationProxyUrl(): string {
  let proxyUrl = process.env.INTEGRATION_PROXY_URL;
  if (!proxyUrl) {
    proxyUrl = process.env.integration_proxy_url;
  }
  if (!proxyUrl) {
    proxyUrl = "https://integrations.emergentagent.com";
  }
  return proxyUrl;
}
