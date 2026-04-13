const LEGACY_KEYS = {
  customerToken: 'rf_customer_token',
  customerId: 'rf_customer_id',
  customerName: 'rf_customer_name',
  customerPhone: 'rf_customer_phone',
  activeSession: 'rf_active_session',
  guestHandshakeToken: 'rf_handshake_token',
};

const TENANT_STORAGE_EVENT = 'rf:tenant-storage-updated';

function emitTenantStorageUpdate(tenantSlug: string | null | undefined, key: string, value: string | null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(TENANT_STORAGE_EVENT, {
      detail: {
        tenantSlug: tenantSlug?.trim() || 'global',
        key,
        value,
      },
    }),
  );
}

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
  if (key === 'guest_handshake_token') {
    return localStorage.getItem(LEGACY_KEYS.guestHandshakeToken);
  }

  return null;
}

export function setTenantStorageItem(tenantSlug: string | null | undefined, key: string, value: string) {
  localStorage.setItem(scopedKey(tenantSlug, key), value);
  emitTenantStorageUpdate(tenantSlug, key, value);
}

export function removeTenantStorageItem(tenantSlug: string | null | undefined, key: string) {
  localStorage.removeItem(scopedKey(tenantSlug, key));
  emitTenantStorageUpdate(tenantSlug, key, null);
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

export function getGuestHandshakeTokenForTenant(tenantSlug: string | null | undefined) {
  return getTenantStorageItem(tenantSlug, 'guest_handshake_token');
}

export function ensureGuestHandshakeTokenForTenant(tenantSlug: string | null | undefined) {
  const existing = getGuestHandshakeTokenForTenant(tenantSlug);
  if (existing) return existing;

  const nextToken = `guest_${Math.random().toString(36).slice(2, 11)}`;
  setTenantStorageItem(tenantSlug, 'guest_handshake_token', nextToken);
  localStorage.setItem(LEGACY_KEYS.guestHandshakeToken, nextToken);
  return nextToken;
}

export function getLastTableIdForTenant(tenantSlug: string | null | undefined) {
  return getTenantStorageItem(tenantSlug, 'last_table_id');
}

export function setLastTableIdForTenant(tenantSlug: string | null | undefined, tableId: string) {
  setTenantStorageItem(tenantSlug, 'last_table_id', tableId);
}

export function subscribeTenantStorage(listener: (event: CustomEvent<{ tenantSlug: string; key: string; value: string | null }>) => void) {
  if (typeof window === 'undefined') return () => undefined;

  const handler = (event: Event) => {
    if (event instanceof CustomEvent) {
      listener(event as CustomEvent<{ tenantSlug: string; key: string; value: string | null }>);
    }
  };

  window.addEventListener(TENANT_STORAGE_EVENT, handler);
  return () => window.removeEventListener(TENANT_STORAGE_EVENT, handler);
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

export function clearCustomerContextForTenant(tenantSlug: string | null | undefined) {
  removeTenantStorageItem(tenantSlug, 'customer_token');
  removeTenantStorageItem(tenantSlug, 'customer_id');
  removeTenantStorageItem(tenantSlug, 'customer_name');
  removeTenantStorageItem(tenantSlug, 'customer_phone');
  removeTenantStorageItem(tenantSlug, 'active_session');
  removeTenantStorageItem(tenantSlug, 'guest_handshake_token');

  localStorage.removeItem(LEGACY_KEYS.customerToken);
  localStorage.removeItem(LEGACY_KEYS.customerId);
  localStorage.removeItem(LEGACY_KEYS.customerName);
  localStorage.removeItem(LEGACY_KEYS.customerPhone);
  localStorage.removeItem(LEGACY_KEYS.activeSession);
  localStorage.removeItem(LEGACY_KEYS.guestHandshakeToken);
  localStorage.removeItem('restoflow_session');
}
