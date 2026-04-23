import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { CustomerFooter } from './CustomerFooter';
import { CustomerNav } from './CustomerNav';
import { HandshakeListener } from './HandshakeListener';
import { WaiterCall } from './WaiterCall';

import { publicApi } from '../lib/api';

function matches(pathname: string, path: string) {
  return Boolean(matchPath(path, pathname));
}

function supportsWaiterCalls(plan?: string) {
  const p = String(plan || '').trim().toUpperCase();
  // MINI is strictly hidden. CAFE is toggleable. Bhoj Pro+ is always.
  return p === 'CAFE' || p === 'BHOJPRO' || p === 'PREMIUM' || p === 'GOLD';
}

export function CustomerShell() {
  const { tenantSlug, tableId } = useParams();
  const queryClient = useQueryClient();
  const setTenantScope = useCartStore((state) => state.setTenantScope);
  const setTenantPlan = useCartStore((state) => state.setTenantPlan);
  const setTenantBusinessType = useCartStore((state) => state.setTenantBusinessType);
  const tenantPlan = useCartStore((state) => state.tenantPlan);
  const tenantBusinessType = useCartStore((state) => state.tenantBusinessType);
  const [hasWaiterService, setHasWaiterService] = useState<boolean | undefined>(undefined);
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

    const cachedMenu = queryClient.getQueryData<any>(['menu', tenantSlug]);
    if (cachedMenu?.plan && !tenantPlan) {
      setTenantPlan(cachedMenu.plan);
    }
    if (cachedMenu?.businessType && !tenantBusinessType) {
      setTenantBusinessType(cachedMenu.businessType);
    }
    if (cachedMenu?.hasWaiterService !== undefined && hasWaiterService === undefined) {
      setHasWaiterService(cachedMenu.hasWaiterService);
    }

    if ((cachedMenu?.plan || tenantPlan) && (cachedMenu?.businessType || tenantBusinessType)) {
      return;
    }

    if (tenantPlan && tenantBusinessType) return;

    const syncVenueProfile = async () => {
      try {
        const res = await publicApi.get(`/${tenantSlug}/menu`);
        if (res.data?.plan) {
          setTenantPlan(res.data.plan);
        }
        if (res.data?.businessType) {
          setTenantBusinessType(res.data.businessType);
        }
        if (res.data?.hasWaiterService !== undefined) {
          setHasWaiterService(res.data.hasWaiterService);
        }
      } catch (err) {
        console.error('[TENANT_PROFILE_SYNC_ERROR]', err);
      }
    };
    void syncVenueProfile();
  }, [queryClient, setTenantBusinessType, setTenantPlan, tenantBusinessType, tenantPlan, tenantSlug]);

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
  const hasWaiterCallAccess = useMemo(() => supportsWaiterCalls(tenantPlan), [tenantPlan]);

  const showBottomNav =
    (isMenuRoute && hasOrderingIdentity) || isSessionRoute || isStatusRoute || isHistoryRoute || isProfileRoute;

  const waiterContext = useMemo(
    () => ({
      tenantSlug: tenantSlug || '',
      tableId: tableId || storageState.lastTableId || undefined,
      sessionId: storageState.activeSessionId || null,
      sessionAccessToken: storageState.sessionAccessToken || null,
    }),
    [storageState.activeSessionId, storageState.lastTableId, storageState.sessionAccessToken, tableId, tenantSlug],
  );
  const isCafe = String(tenantPlan).toUpperCase() === 'CAFE';
  const showWaiterCall = Boolean(
    hasWaiterCallAccess &&
      (!isCafe || hasWaiterService !== false) &&
      waiterContext.tableId &&
      storageState.activeSessionId &&
      storageState.sessionAccessToken &&
      ((isMenuRoute && hasTableOrderingContext) || isSessionRoute || isStatusRoute)
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
      <div
        style={{
          paddingBottom: showBottomNav ? 'calc(var(--customer-nav-space) + var(--customer-page-action-height) + 1rem)' : '1rem',
        }}
      >
        <CustomerFooter />
      </div>

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
