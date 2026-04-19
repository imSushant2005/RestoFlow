export const cacheKeys = {
  tenantIdBySlug: (tenantSlug: string) => `tenant_id_by_slug_${tenantSlug}`,
  tenantMeta: (tenantSlug: string) => `tenant_meta_${tenantSlug}`,
  tenantFull: (tenantSlug: string) => `tenant_full_${tenantSlug}`,
  authMeUser: (userId: string) => `auth_me_user_${userId}`,
  authTenantBrief: (tenantId: string) => `auth_tenant_brief_${tenantId}`,
  authTipSummary: (userId: string) => `auth_tip_summary_${userId}`,
  customDomainResolution: (domain: string) => `custom_domain_res_${domain}`,
  publicMenu: (tenantSlug: string) => `public_menu_${tenantSlug}`,
  publicSession: (tenantId: string, sessionId: string) => `public_session_${tenantId}_${sessionId}`,
  sessionOrders: (tenantId: string, sessionId: string) => `session_orders_${tenantId}_${sessionId}`,
  publicOrderInfo: (tenantId: string, orderId: string) => `public_order_info_${tenantId}_${orderId}`,
  dashboardLiveOrders: (tenantId: string) => `dashboard_live_orders_${tenantId}`,
  dashboardMenuItems: (tenantId: string, categoryKey: string, mode: 'list' | 'full') =>
    `dashboard_menu_items_${tenantId}_${categoryKey}_${mode}`,
  dashboardMenuItemsPattern: (tenantId: string) => `dashboard_menu_items_${tenantId}_*`,
  dashboardOrderHistory: (tenantId: string, page: number, limit: number, statusKey: string) =>
    `dashboard_order_history_${tenantId}_${page}_${limit}_${statusKey}`,
  dashboardOrderHistoryPattern: (tenantId: string) => `dashboard_order_history_${tenantId}_*`,
  publicOrderIdempotency: (tenantId: string, idempotencyKey: string) =>
    `public_order_idempotency_${tenantId}_${idempotencyKey}`,
};
