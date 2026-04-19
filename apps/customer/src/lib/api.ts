import axios from 'axios';
import { getApiBaseUrl } from './network';
import {
  getCustomerTokenForTenant,
  getSessionAccessTokenForTenant,
  getTableQrSecretForTenant,
  setSessionAccessForTenant,
} from './tenantStorage';

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 60000,
});

export const publicApi = axios.create({
  baseURL: `${getApiBaseUrl()}/public`,
  timeout: 60000,
});

const GLOBAL_PUBLIC_ROUTE_PREFIXES = new Set(['orders', 'customer', 'resolve-domain']);

function extractTenantSlug(url: string | undefined) {
  const path = String(url || '').replace(/^https?:\/\/[^/]+/i, '');
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  return GLOBAL_PUBLIC_ROUTE_PREFIXES.has(segments[0]) ? null : segments[0];
}

export function getTenantPublicAuthHeaders(tenantSlug: string | null | undefined) {
  const headers: Record<string, string> = {};
  if (!tenantSlug) return headers;

  const customerToken = getCustomerTokenForTenant(tenantSlug);
  if (customerToken) {
    headers.Authorization = `Bearer ${customerToken}`;
  }

  const sessionAccessToken = getSessionAccessTokenForTenant(tenantSlug);
  if (sessionAccessToken) {
    headers['x-session-access-token'] = sessionAccessToken;
  }

  const tableQrSecret = getTableQrSecretForTenant(tenantSlug);
  if (tableQrSecret) {
    headers['x-table-qr-secret'] = tableQrSecret;
  }

  return headers;
}

publicApi.interceptors.request.use((config) => {
  const tenantSlug = extractTenantSlug(config.url);
  if (!tenantSlug) return config;

  Object.assign(config.headers, getTenantPublicAuthHeaders(tenantSlug));

  return config;
});

publicApi.interceptors.response.use((response) => {
  const tenantSlug = extractTenantSlug(response.config.url);
  const data = response.data;

  if (
    tenantSlug &&
    data &&
    typeof data === 'object' &&
    typeof data.sessionAccessToken === 'string' &&
    typeof (data.sessionId || data.id) === 'string'
  ) {
    setSessionAccessForTenant(tenantSlug, {
      sessionId: String(data.sessionId || data.id),
      sessionAccessToken: data.sessionAccessToken,
    });
  }

  return response;
});
