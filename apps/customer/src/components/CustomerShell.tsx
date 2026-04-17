import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { matchPath, Outlet, useLocation, useParams } from 'react-router-dom';
import {
  getActiveSessionForTenant,
  getCustomerTokenForTenant,
  getLastTableIdForTenant,
  getSessionAccessTokenForTenant,
  setLastTableIdForTenant,
  setTableQrSecretForTenant,
  subscribeTenantStorage,
} from '../lib/tenantStorage';
import { useCartStore } from '../store/cartStore';
import { CustomerNav } from './CustomerNav';
import { HandshakeListener } from './HandshakeListener';
import { WaiterCall } from './WaiterCall';

import { publicApi } from '../lib/api';

function matches(pathname: string, path: string) {
  return Boolean(matchPath(path, pathname));
}

export function CustomerShell() {
  const { tenantSlug, tableId } = useParams();
  const setTenantScope = useCartStore((state) => state.setTenantScope);
  const setTenantPlan = useCartStore((state) => state.setTenantPlan);
  const tenantPlan = useCartStore((state) => state.tenantPlan);
  const location = useLocation();
  const cartItems = useCartStore((state) => state.items);
  const customerName = useCartStore((state) => state.customerName);
  const customerPhone = useCartStore((state) => state.customerPhone);
  const cartItemCount = Array.isArray(cartItems)
    ? cartItems.reduce((sum, item) => sum + Number(item?.quantity || 0), 0)
    : 0;

  const [storageState, setStorageState] = useState(() => ({
    activeSessionId: getActiveSessionForTenant(tenantSlug),
    sessionAccessToken: getSessionAccessTokenForTenant(tenantSlug),
    customerToken: getCustomerTokenForTenant(tenantSlug),
    lastTableId: getLastTableIdForTenant(tenantSlug),
  }));

  useEffect(() => {
    if (tenantSlug) {
      setTenantScope(tenantSlug);
    }
    setStorageState({
      activeSessionId: getActiveSessionForTenant(tenantSlug),
      sessionAccessToken: getSessionAccessTokenForTenant(tenantSlug),
      customerToken: getCustomerTokenForTenant(tenantSlug),
      lastTableId: getLastTableIdForTenant(tenantSlug),
    });
  }, [tenantSlug, setTenantScope]);

  useEffect(() => {
    return subscribeTenantStorage((event) => {
      const scope = tenantSlug?.trim() || 'global';
      if (event.detail?.tenantSlug !== scope) return;
      if (
        !['active_session', 'session_access_token', 'customer_token', 'last_table_id'].includes(event.detail?.key || '')
      ) {
        return;
      }

      setStorageState({
        activeSessionId: getActiveSessionForTenant(tenantSlug),
        sessionAccessToken: getSessionAccessTokenForTenant(tenantSlug),
        customerToken: getCustomerTokenForTenant(tenantSlug),
        lastTableId: getLastTableIdForTenant(tenantSlug),
      });
    });
  }, [tenantSlug]);

  useEffect(() => {
    if (tenantSlug && tableId) {
      setLastTableIdForTenant(tenantSlug, tableId);
    }
  }, [tableId, tenantSlug]);

  useEffect(() => {
    if (!tenantSlug) return;
    const qrSecret = new URLSearchParams(location.search).get('qr');
    if (qrSecret) {
      setTableQrSecretForTenant(tenantSlug, qrSecret);
    }
  }, [location.search, tenantSlug]);

  useEffect(() => {
    if (!tenantSlug) return;
    
    // Minimal fetch to sync plan if missing (e.g. landing on Tracker/History directly)
    const syncPlan = async () => {
      try {
        const res = await publicApi.get(`/${tenantSlug}/menu`);
        if (res.data?.plan) {
          setTenantPlan(res.data.plan);
        }
      } catch (err) {
        console.error('[PLAN_SYNC_ERROR]', err);
      }
    };
    void syncPlan();
  }, [tenantSlug, tenantPlan, setTenantPlan]);

  const isMenuRoute =
    matches(location.pathname, '/order/:tenantSlug') ||
    matches(location.pathname, '/order/:tenantSlug/:tableId/menu');
  const isSessionRoute = matches(location.pathname, '/order/:tenantSlug/session/:sessionId');
  const isStatusRoute = matches(location.pathname, '/order/:tenantSlug/status');
  const isHistoryRoute = matches(location.pathname, '/order/:tenantSlug/history');
  const isProfileRoute = matches(location.pathname, '/order/:tenantSlug/profile');

  const hasOrderingIdentity = Boolean(
    storageState.activeSessionId || storageState.customerToken || customerName || customerPhone,
  );
  const hasTableOrderingContext = Boolean(tableId && hasOrderingIdentity);

  const showBottomNav =
    (isMenuRoute && hasOrderingIdentity) || isSessionRoute || isStatusRoute || isHistoryRoute || isProfileRoute;
  const showWaiterCall = Boolean(
    storageState.activeSessionId &&
      storageState.sessionAccessToken &&
      ((isMenuRoute && hasTableOrderingContext) || isSessionRoute || isStatusRoute),
  );

  const waiterContext = useMemo(
    () => ({
      tenantSlug: tenantSlug || '',
      tableId: tableId || storageState.lastTableId || undefined,
      sessionId: storageState.activeSessionId || null,
      sessionAccessToken: storageState.sessionAccessToken || null,
    }),
    [storageState.activeSessionId, storageState.lastTableId, storageState.sessionAccessToken, tableId, tenantSlug],
  );

  const pageActionHeight = useMemo(() => {
    if (isMenuRoute) return cartItemCount > 0 ? '110px' : '64px';
    if (isSessionRoute || isStatusRoute) return '88px';
    return '0px';
  }, [cartItemCount, isMenuRoute, isSessionRoute, isStatusRoute]);

  return (
    <div
      className="relative flex flex-1 flex-col focus:outline-none"
      style={{ '--customer-page-action-height': pageActionHeight } as CSSProperties}
    >
      {showWaiterCall && waiterContext.sessionId && waiterContext.sessionAccessToken && (
        <HandshakeListener
          tenantSlug={waiterContext.tenantSlug}
          sessionId={waiterContext.sessionId}
          sessionAccessToken={waiterContext.sessionAccessToken}
        />
      )}

      <Outlet />

      {showBottomNav && <CustomerNav />}
      {showWaiterCall && waiterContext.sessionId && waiterContext.sessionAccessToken && (
        <WaiterCall
          tenantSlug={waiterContext.tenantSlug}
          tableId={waiterContext.tableId}
          sessionId={waiterContext.sessionId}
          sessionAccessToken={waiterContext.sessionAccessToken}
        />
      )}
    </div>
  );
}
