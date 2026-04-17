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

function extractTenantSlug(url: string | undefined) {
  const path = String(url || '').replace(/^https?:\/\/[^/]+/i, '');
  const segments = path.split('/').filter(Boolean);
  return segments.length > 0 ? segments[0] : null;
}

publicApi.interceptors.request.use((config) => {
  const tenantSlug = extractTenantSlug(config.url);
  if (!tenantSlug) return config;

  const customerToken = getCustomerTokenForTenant(tenantSlug);
  if (customerToken) {
    config.headers.Authorization = `Bearer ${customerToken}`;
  }

  const sessionAccessToken = getSessionAccessTokenForTenant(tenantSlug);
  if (sessionAccessToken) {
    config.headers['x-session-access-token'] = sessionAccessToken;
  }

  const tableQrSecret = getTableQrSecretForTenant(tenantSlug);
  if (tableQrSecret) {
    config.headers['x-table-qr-secret'] = tableQrSecret;
  }

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
