"use strict";
/**
 * Utility functions for LLM integrations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAppIdentifier = getAppIdentifier;
exports.getIntegrationProxyUrl = getIntegrationProxyUrl;
/**
 * Get the application identifier from environment variables.
 * Tries APP_URL first (preview pods), then falls back to
 * REACT_APP_BACKEND_URL (deployed apps).
 */
function getAppIdentifier() {
    const appUrl = process.env.APP_URL;
    if (appUrl)
        return appUrl;
    return process.env.REACT_APP_BACKEND_URL || undefined;
}
/**
 * Get the integration proxy URL from environment variables.
 * Priority: INTEGRATION_PROXY_URL > integration_proxy_url > default
 */
function getIntegrationProxyUrl() {
    let proxyUrl = process.env.INTEGRATION_PROXY_URL;
    if (!proxyUrl) {
        proxyUrl = process.env.integration_proxy_url;
    }
    if (!proxyUrl) {
        proxyUrl = "https://integrations.emergentagent.com";
    }
    return proxyUrl;
}
//# sourceMappingURL=utils.js.map