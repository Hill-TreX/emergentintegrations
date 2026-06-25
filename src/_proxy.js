/**
 * Emergent proxy helpers — key detection and endpoint resolution.
 * Mirrors: src/emergentintegrations/_proxy.py exactly.
 */

export const EMERGENT_KEY_PREFIX = "sk-emergent-";
export const DEFAULT_PROXY_URL = "https://integrations.emergentagent.com";

export function isEmergentKey(apiKey) {
  return apiKey.startsWith(EMERGENT_KEY_PREFIX);
}

export function getAppIdentifier() {
  return process.env.APP_URL || process.env.REACT_APP_BACKEND_URL || null;
}

export function getIntegrationProxyUrl() {
  // lowercase fallback is intentional — matches legacy CDN-published SDK
  return (
    process.env.INTEGRATION_PROXY_URL ||
    process.env.integration_proxy_url ||
    DEFAULT_PROXY_URL
  );
}
