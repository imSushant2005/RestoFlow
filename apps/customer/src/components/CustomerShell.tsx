import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { matchPath, Outlet, useLocation, useParams } from 'react-router-dom';
import {
  ensureGuestHandshakeTokenForTenant,
  getActiveSessionForTenant,
  getGuestHandshakeTokenForTenant,
  getLastTableIdForTenant,
  setLastTableIdForTenant,
  subscribeTenantStorage,
} from '../lib/tenantStorage';
import { useCartStore } from '../store/cartStore';
import { CustomerNav } from './CustomerNav';
import { HandshakeListener } from './HandshakeListener';
import { WaiterCall } from './WaiterCall';

function matches(pathname: string, path: string) {
  return Boolean(matchPath(path, pathname));
}

export function CustomerShell() {
  const { tenantSlug, tableId } = useParams();
  const location = useLocation();
  const cartItems = useCartStore((state) => state.items);
  const cartItemCount = Array.isArray(cartItems)
    ? cartItems.reduce((sum, item) => sum + Number(item?.quantity || 0), 0)
    : 0;

  const [storageState, setStorageState] = useState(() => ({
    activeSessionId: getActiveSessionForTenant(tenantSlug),
    guestToken: getGuestHandshakeTokenForTenant(tenantSlug),
    lastTableId: getLastTableIdForTenant(tenantSlug),
  }));

  useEffect(() => {
    setStorageState({
      activeSessionId: getActiveSessionForTenant(tenantSlug),
      guestToken: getGuestHandshakeTokenForTenant(tenantSlug),
      lastTableId: getLastTableIdForTenant(tenantSlug),
    });
  }, [tenantSlug]);

  useEffect(() => {
    return subscribeTenantStorage((event) => {
      const scope = tenantSlug?.trim() || 'global';
      if (event.detail?.tenantSlug !== scope) return;
      if (!['active_session', 'guest_handshake_token', 'last_table_id'].includes(event.detail?.key || '')) return;

      setStorageState({
        activeSessionId: getActiveSessionForTenant(tenantSlug),
        guestToken: getGuestHandshakeTokenForTenant(tenantSlug),
        lastTableId: getLastTableIdForTenant(tenantSlug),
      });
    });
  }, [tenantSlug]);

  useEffect(() => {
    if (tenantSlug && tableId) {
      setLastTableIdForTenant(tenantSlug, tableId);
    }
  }, [tableId, tenantSlug]);

  const isMenuRoute =
    matches(location.pathname, '/order/:tenantSlug') ||
    matches(location.pathname, '/order/:tenantSlug/:tableId/menu');
  const isSessionRoute = matches(location.pathname, '/order/:tenantSlug/session/:sessionId');
  const isStatusRoute = matches(location.pathname, '/order/:tenantSlug/status');
  const isHistoryRoute = matches(location.pathname, '/order/:tenantSlug/history');
  const isProfileRoute = matches(location.pathname, '/order/:tenantSlug/profile');

  const showBottomNav = isMenuRoute || isSessionRoute || isStatusRoute || isHistoryRoute || isProfileRoute;
  const showWaiterCall = isMenuRoute || isSessionRoute || isStatusRoute;

  useEffect(() => {
    if (!tenantSlug || !showWaiterCall || storageState.activeSessionId || storageState.guestToken) return;
    const nextGuestToken = ensureGuestHandshakeTokenForTenant(tenantSlug);
    setStorageState((current) => ({ ...current, guestToken: nextGuestToken }));
  }, [showWaiterCall, storageState.activeSessionId, storageState.guestToken, tenantSlug]);

  const waiterContext = useMemo(
    () => ({
      tenantSlug: tenantSlug || '',
      tableId: tableId || storageState.lastTableId || undefined,
      sessionToken: storageState.activeSessionId || storageState.guestToken || null,
    }),
    [storageState.activeSessionId, storageState.guestToken, storageState.lastTableId, tableId, tenantSlug],
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
      {showWaiterCall && waiterContext.sessionToken && (
        <HandshakeListener tenantSlug={waiterContext.tenantSlug} sessionToken={waiterContext.sessionToken} />
      )}

      <Outlet />

      {showBottomNav && <CustomerNav />}
      {showWaiterCall && waiterContext.sessionToken && (
        <WaiterCall
          tenantSlug={waiterContext.tenantSlug}
          tableId={waiterContext.tableId}
          sessionToken={waiterContext.sessionToken}
        />
      )}
    </div>
  );
}
