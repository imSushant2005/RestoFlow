export const cacheKeys = {
  tenantIdBySlug: (tenantSlug: string) => `tenant_id_by_slug_${tenantSlug}`,
  tenantMeta: (tenantSlug: string) => `tenant_meta_${tenantSlug}`,
  tenantFull: (tenantSlug: string) => `tenant_full_${tenantSlug}`,
  customDomainResolution: (domain: string) => `custom_domain_res_${domain}`,
  publicMenu: (tenantSlug: string) => `public_menu_${tenantSlug}`,
  publicSession: (tenantId: string, sessionId: string) => `public_session_${tenantId}_${sessionId}`,
  sessionOrders: (tenantId: string, sessionId: string) => `session_orders_${tenantId}_${sessionId}`,
  dashboardLiveOrders: (tenantId: string) => `dashboard_live_orders_${tenantId}`,
  dashboardOrderHistory: (tenantId: string, page: number, limit: number, statusKey: string) =>
    `dashboard_order_history_${tenantId}_${page}_${limit}_${statusKey}`,
  dashboardOrderHistoryPattern: (tenantId: string) => `dashboard_order_history_${tenantId}_*`,
  publicOrderIdempotency: (tenantId: string, idempotencyKey: string) =>
    `public_order_idempotency_${tenantId}_${idempotencyKey}`,
};

