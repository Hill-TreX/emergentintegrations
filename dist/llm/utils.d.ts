/**
 * Utility functions for LLM integrations.
 */
/**
 * Get the application identifier from environment variables.
 * Tries APP_URL first (preview pods), then falls back to
 * REACT_APP_BACKEND_URL (deployed apps).
 */
export declare function getAppIdentifier(): string | undefined;
/**
 * Get the integration proxy URL from environment variables.
 * Priority: INTEGRATION_PROXY_URL > integration_proxy_url > default
 */
export declare function getIntegrationProxyUrl(): string;
//# sourceMappingURL=utils.d.ts.map