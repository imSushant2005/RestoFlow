const LEGACY_KEYS = {
  customerToken: 'rf_customer_token',
  customerId: 'rf_customer_id',
  customerName: 'rf_customer_name',
  customerPhone: 'rf_customer_phone',
  activeSession: 'rf_active_session',
};

function scopedKey(tenantSlug: string | null | undefined, key: string) {
  const scope = tenantSlug && tenantSlug.trim().length > 0 ? tenantSlug.trim() : 'global';
  return `rf_${scope}_${key}`;
}

export function getTenantStorageItem(tenantSlug: string | null | undefined, key: string) {
  const scoped = localStorage.getItem(scopedKey(tenantSlug, key));
  if (scoped != null) return scoped;

  if (key === 'customer_token') return localStorage.getItem(LEGACY_KEYS.customerToken);
  if (key === 'customer_id') return localStorage.getItem(LEGACY_KEYS.customerId);
  if (key === 'customer_name') return localStorage.getItem(LEGACY_KEYS.customerName);
  if (key === 'customer_phone') return localStorage.getItem(LEGACY_KEYS.customerPhone);
  if (key === 'active_session') {
    return localStorage.getItem(LEGACY_KEYS.activeSession) || localStorage.getItem('restoflow_session');
  }

  return null;
}

export function setTenantStorageItem(tenantSlug: string | null | undefined, key: string, value: string) {
  localStorage.setItem(scopedKey(tenantSlug, key), value);
}

export function removeTenantStorageItem(tenantSlug: string | null | undefined, key: string) {
  localStorage.removeItem(scopedKey(tenantSlug, key));
}

export function getActiveSessionForTenant(tenantSlug: string | null | undefined) {
  return getTenantStorageItem(tenantSlug, 'active_session');
}

export function setActiveSessionForTenant(tenantSlug: string | null | undefined, sessionId: string) {
  setTenantStorageItem(tenantSlug, 'active_session', sessionId);
  localStorage.setItem(LEGACY_KEYS.activeSession, sessionId);
  localStorage.setItem('restoflow_session', sessionId);
}

export function getCustomerTokenForTenant(tenantSlug: string | null | undefined) {
  return getTenantStorageItem(tenantSlug, 'customer_token');
}

export function setCustomerAuthForTenant(
  tenantSlug: string | null | undefined,
  payload: { token: string; customerId: string; customerName?: string; customerPhone?: string },
) {
  setTenantStorageItem(tenantSlug, 'customer_token', payload.token);
  setTenantStorageItem(tenantSlug, 'customer_id', payload.customerId);

  if (payload.customerName != null) {
    setTenantStorageItem(tenantSlug, 'customer_name', payload.customerName);
  }
  if (payload.customerPhone != null) {
    setTenantStorageItem(tenantSlug, 'customer_phone', payload.customerPhone);
  }

  // Keep legacy compatibility so existing screens continue to work.
  localStorage.setItem(LEGACY_KEYS.customerToken, payload.token);
  localStorage.setItem(LEGACY_KEYS.customerId, payload.customerId);
  if (payload.customerName != null) localStorage.setItem(LEGACY_KEYS.customerName, payload.customerName);
  if (payload.customerPhone != null) localStorage.setItem(LEGACY_KEYS.customerPhone, payload.customerPhone);
}

