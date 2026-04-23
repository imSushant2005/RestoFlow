const LEGACY_KEYS = {
  customerToken: 'rf_customer_token',
  customerId: 'rf_customer_id',
  customerName: 'rf_customer_name',
  customerPhone: 'rf_customer_phone',
  activeSession: 'rf_active_session',
  guestHandshakeToken: 'rf_handshake_token',
  sessionAccessToken: 'rf_session_access_token',
  tableQrSecret: 'rf_table_qr_secret',
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
  return localStorage.getItem(scopedKey(tenantSlug, key));
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
}

export function getCustomerTokenForTenant(tenantSlug: string | null | undefined) {
  return getTenantStorageItem(tenantSlug, 'customer_token');
}

export function getSessionAccessTokenForTenant(tenantSlug: string | null | undefined) {
  return getTenantStorageItem(tenantSlug, 'session_access_token');
}

export function setSessionAccessForTenant(
  tenantSlug: string | null | undefined,
  payload: { sessionId: string; sessionAccessToken: string },
) {
  setTenantStorageItem(tenantSlug, 'active_session', payload.sessionId);
  setTenantStorageItem(tenantSlug, 'session_access_token', payload.sessionAccessToken);
}

export function clearSessionAccessForTenant(tenantSlug: string | null | undefined) {
  removeTenantStorageItem(tenantSlug, 'active_session');
  removeTenantStorageItem(tenantSlug, 'session_access_token');
}

export function getTableQrSecretForTenant(tenantSlug: string | null | undefined) {
  return getTenantStorageItem(tenantSlug, 'table_qr_secret');
}

export function setTableQrSecretForTenant(tenantSlug: string | null | undefined, qrSecret: string) {
  setTenantStorageItem(tenantSlug, 'table_qr_secret', qrSecret);
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
}

export function clearCustomerContextForTenant(tenantSlug: string | null | undefined) {
  removeTenantStorageItem(tenantSlug, 'customer_token');
  removeTenantStorageItem(tenantSlug, 'customer_id');
  removeTenantStorageItem(tenantSlug, 'customer_name');
  removeTenantStorageItem(tenantSlug, 'customer_phone');
  removeTenantStorageItem(tenantSlug, 'active_session');
  removeTenantStorageItem(tenantSlug, 'session_access_token');
  removeTenantStorageItem(tenantSlug, 'guest_handshake_token');
  removeTenantStorageItem(tenantSlug, 'table_qr_secret');
}

export function clearLegacyCustomerStorage() {
  Object.values(LEGACY_KEYS).forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem('BHOJFLOW_session');
}
