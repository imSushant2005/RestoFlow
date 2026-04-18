import { Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Receipt,
  CreditCard,
  LogIn,
  BarChart3,
  Settings2,
  ChevronRight,
  Store,
  Loader2,
  Menu,
  X,
} from 'lucide-react';
import { MenuBuilder } from './pages/MenuBuilder';
import { FloorPlan } from './pages/FloorPlan';
import { Orders } from './pages/Orders';
import { DashboardOverview } from './pages/DashboardOverview';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { Onboarding } from './pages/Onboarding';
import { InvoicesPage as Billing } from './pages/InvoicesPage';
import { PlansHub as SubscriptionPage } from './pages/PlansHub';
import { Admin } from './pages/Admin';
import { WaiterPage } from './pages/WaiterPage';
import { AssistedOrderingPage } from './pages/AssistedOrderingPage';
import { FirstLoginPasswordGate } from './components/FirstLoginPasswordGate';
import { AuthContactPage } from './pages/AuthContactPage';
import { DemoPage } from './pages/DemoPage';
import { HomePage } from './pages/HomePage';
import { PrivacyPolicyPage, TermsPage } from './pages/LegalPages';
import { LoginPage } from './pages/LoginPage';
import { MarketingBillingPage } from './pages/MarketingBillingPage';
import { ProductPage } from './pages/ProductPage';
import { SignupPage } from './pages/SignupPage';
import { SetupFlowPage } from './pages/SetupFlowPage';
import { DashboardErrorBoundary } from './components/DashboardErrorBoundary';
import { LanguageProvider } from './contexts/LanguageContext';
import { VendorTopNav, type OpsNotification } from './components/VendorTopNav';
import { useRealtimeSocket } from './hooks/useRealtimeSocket';
import { usePlanFeatures } from './hooks/usePlanFeatures';
import { api } from './lib/api';
import { clearDashboardAuthStorage, markManualLogout } from './lib/authSession';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

// Pre-load notification sounds at module level — avoids creating a new Audio object
// (and a CDN HTTP request) on every notification.
const _notifSound = typeof window !== 'undefined'
  ? new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
  : null;
const _waiterSound = typeof window !== 'undefined'
  ? new Audio('https://assets.mixkit.co/active_storage/sfx/495/495-preview.mp3')
  : null;

function playNotificationSound(url?: string) {
  const sound = url?.includes('495') ? _waiterSound : _notifSound;
  if (!sound) return;
  sound.currentTime = 0;
  sound.volume = 0.5;
  sound.play().catch(() => undefined);
  setTimeout(() => { sound.pause(); sound.currentTime = 0; }, 1000);
}

type DashboardRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN' | 'WAITER' | 'UNKNOWN';


// REMOVED STATIC DASHBOARD_DEMO_STEPS

function normalizeDashboardRole(rawRole?: string | null): DashboardRole {
  const normalized = (rawRole || '').toUpperCase();
  if (normalized === 'OWNER') return 'OWNER';
  if (normalized === 'MANAGER') return 'MANAGER';
  if (normalized === 'CASHIER') return 'CASHIER';
  if (normalized === 'KITCHEN') return 'KITCHEN';
  if (normalized === 'WAITER') return 'WAITER';
  return 'UNKNOWN';
}

const FULL_ACCESS_ROLES = new Set<DashboardRole>(['OWNER', 'MANAGER', 'CASHIER']);
const ORDERS_ACCESS_ROLES = new Set<DashboardRole>(['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN', 'WAITER']);
const BILLING_ACCESS_ROLES = new Set<DashboardRole>(['OWNER', 'MANAGER', 'CASHIER']);
const ASSISTED_ACCESS_ROLES = new Set<DashboardRole>(['OWNER', 'MANAGER', 'CASHIER', 'WAITER']);
const BUSINESS_READ_ROLES = new Set<DashboardRole>(['OWNER', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN']);
const notificationStorageKey = 'rf_ops_notifications_v1';

function getDefaultRouteForRole(role: DashboardRole) {
  if (role === 'WAITER') return '/app/waiter';
  if (role === 'CASHIER' || role === 'KITCHEN') return '/app/orders';
  return '/app';
}

function needsWorkspaceSetup(business?: { businessName?: string; gstin?: string | null; phone?: string | null } | null) {
  if (!business) return false;
  return !Boolean(
    business.businessName?.trim() &&
      business.gstin?.trim() &&
      business.phone?.trim(),
  );
}

function getDemoStorageKey(business?: { id?: string; slug?: string }) {
  const scope = business?.id || business?.slug || 'default';
  return `rf_dashboard_demo_seen_${scope}`;
}

function logoutAndReload() {
  markManualLogout();
  void api.post('/auth/logout').catch(() => undefined);
  clearDashboardAuthStorage();
  const clerk = (globalThis as any).Clerk;
  if (clerk?.signOut) {
    void Promise.resolve(clerk.signOut()).finally(() => window.location.assign('/login'));
    return;
  }
  window.location.assign('/login');
}

function ScreenLoader({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--shell-bg)' }}>
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={30} className="animate-spin text-blue-500" />
        <p className="text-sm font-medium" style={{ color: 'var(--text-3)' }}>{message}</p>
      </div>
    </div>
  );
}

function MarketingHomeRoute() {
  const navigate = useNavigate();
  return (
    <HomePage
      onLoginClick={() => navigate('/login')}
      onSignupClick={() => navigate('/signup')}
      onContactClick={() => navigate('/contact')}
    />
  );
}

function MarketingProductRoute() {
  const navigate = useNavigate();
  return (
    <ProductPage
      onLoginClick={() => navigate('/login')}
      onSignupClick={() => navigate('/signup')}
      onContactClick={() => navigate('/contact')}
    />
  );
}

function MarketingSetupFlowRoute() {
  const navigate = useNavigate();
  return (
    <SetupFlowPage
      onLoginClick={() => navigate('/login')}
      onSignupClick={() => navigate('/signup')}
      onContactClick={() => navigate('/contact')}
    />
  );
}

function MarketingBillingRoute() {
  const navigate = useNavigate();
  return (
    <MarketingBillingPage
      onLoginClick={() => navigate('/login')}
      onSignupClick={() => navigate('/signup')}
      onContactClick={() => navigate('/contact')}
    />
  );
}

function MarketingDemoRoute() {
  const navigate = useNavigate();
  return (
    <DemoPage
      onLoginClick={() => navigate('/login')}
      onSignupClick={() => navigate('/signup')}
      onContactClick={() => navigate('/contact')}
    />
  );
}

function MarketingContactRoute() {
  const navigate = useNavigate();
  return (
    <AuthContactPage
      onBackHome={() => navigate('/')}
      onLoginClick={() => navigate('/login')}
      onSignupClick={() => navigate('/signup')}
    />
  );
}

function MarketingPrivacyRoute() {
  const navigate = useNavigate();
  return (
    <PrivacyPolicyPage
      onBackHome={() => navigate('/')}
      onLoginClick={() => navigate('/login')}
      onSignupClick={() => navigate('/signup')}
      onContactClick={() => navigate('/contact')}
    />
  );
}

function MarketingTermsRoute() {
  const navigate = useNavigate();
  return (
    <TermsPage
      onBackHome={() => navigate('/')}
      onLoginClick={() => navigate('/login')}
      onSignupClick={() => navigate('/signup')}
      onContactClick={() => navigate('/contact')}
    />
  );
}

function PostLoginRedirect({ mustChangePassword }: { mustChangePassword: boolean }) {
  const role = normalizeDashboardRole(localStorage.getItem('userRole'));
  const shouldCheckWorkspace = FULL_ACCESS_ROLES.has(role);
  const shouldForceSecuritySetup = role === 'OWNER' && mustChangePassword;

  const { data: business, isLoading } = useQuery({
    queryKey: ['post-login-business'],
    queryFn: async () => (await api.get('/settings/business')).data,
    retry: false,
    staleTime: 1000 * 30,
    enabled: shouldCheckWorkspace,
  });

  if (role === 'UNKNOWN') {
    clearDashboardAuthStorage();
    return <Navigate to="/login" replace />;
  }

  if (shouldCheckWorkspace && isLoading) {
    return <ScreenLoader message="Preparing your workspace..." />;
  }

  if (shouldCheckWorkspace && business && needsWorkspaceSetup(business)) {
    return <Navigate to="/setup" replace />;
  }

  if (shouldForceSecuritySetup) {
    return <Navigate to="/security-setup" replace />;
  }

  return <Navigate to={getDefaultRouteForRole(role)} replace />;
}

function DashboardShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [liveOrderCount, setLiveOrderCount] = useState(0);
  const [showFirstTimeDemo, setShowFirstTimeDemo] = useState(false);
  const [activeWaiterCall, setActiveWaiterCall] = useState<OpsNotification | null>(null);
  const [notificationsHydrated, setNotificationsHydrated] = useState(false);
  const [notifications, setNotifications] = useState<OpsNotification[]>([]);
  const [toasts, setToasts] = useState<any[]>([]);
  const role = normalizeDashboardRole(localStorage.getItem('userRole'));
  const defaultRoute = getDefaultRouteForRole(role);
  const canAccessDashboard = FULL_ACCESS_ROLES.has(role);
  const canAccessMenu = FULL_ACCESS_ROLES.has(role);
  const canAccessTables = FULL_ACCESS_ROLES.has(role);
  const canAccessOrders = ORDERS_ACCESS_ROLES.has(role);
  const canAccessBilling = BILLING_ACCESS_ROLES.has(role);
  const canAccessAnalytics = FULL_ACCESS_ROLES.has(role);
  const canAccessSettings = FULL_ACCESS_ROLES.has(role);
  const canAccessAssistedOrdering = ASSISTED_ACCESS_ROLES.has(role);
  const { features, isLoading: isPlanLoading } = usePlanFeatures();
  const canShowFirstTimeDemo = FULL_ACCESS_ROLES.has(role);
  const canShowAdminShellData = BUSINESS_READ_ROLES.has(role);
  const shouldFetchBusinessShellData = canShowAdminShellData;
  const shouldFetchBillingShellData = canAccessBilling && role !== 'WAITER';
  const shouldEnableShellRealtime = canAccessOrders && role !== 'WAITER';

  const [businessQuery, billingQuery] = useQueries({
    queries: [
      {
        queryKey: ['settings-business'],
        queryFn: async () => (await api.get('/settings/business')).data,
        retry: false,
        staleTime: 1000 * 30,
        enabled: shouldFetchBusinessShellData,
      },
      {
        queryKey: ['billing-summary'],
        queryFn: async () => (await api.get('/billing')).data,
        retry: false,
        staleTime: 1000 * 30,
        enabled: shouldFetchBillingShellData,
      },
    ],
  });

  const business = businessQuery.data;
  const billing = billingQuery.data;
  const isLoading = shouldFetchBusinessShellData && (businessQuery.isLoading || (shouldFetchBillingShellData && billingQuery.isLoading));
  const isError = shouldFetchBusinessShellData && businessQuery.isError;
  const demoStorageKey = getDemoStorageKey(business);

  // Derives live order count from React Query cache — no HTTP request fired.
  // Previously called GET /orders on every socket event (~60+ requests/min during service).
  const refreshLiveOrderCount = useCallback(() => {
    if (!canAccessOrders) {
      setLiveOrderCount(0);
      return;
    }
    const cached = queryClient.getQueryData<any[]>(['live-orders']);
    setLiveOrderCount(Array.isArray(cached) ? cached.length : 0);
  }, [canAccessOrders, queryClient]);

  const pushNotification = useCallback(
    (entry: Omit<OpsNotification, 'id' | 'read' | 'createdAt'> & { sound?: string; createdAt?: string }) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const next: OpsNotification = {
        id,
        title: entry.title,
        message: entry.message,
        level: entry.level,
        createdAt: entry.createdAt || new Date().toISOString(),
        read: false,
        metadata: entry.metadata, // Carry over tableId, sessionId, etc.
      };

      setNotifications((previous) => [next, ...previous].slice(0, 60));
      
      // Use pre-loaded sound element — no new Audio or CDN request per notification
      playNotificationSound(entry.sound);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6000);
    },
    [setNotifications],
  );


  const unreadNotificationCount = useMemo(
    () => notifications.reduce((total, notification) => total + (notification.read ? 0 : 1), 0),
    [notifications],
  );

  const markNotificationsRead = useCallback(() => {
    setNotifications((previous) => previous.map((notification) => ({ ...notification, read: true })));
  }, [setNotifications]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, [setNotifications]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(notificationStorageKey);
      if (!raw) {
        setNotificationsHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setNotificationsHydrated(true);
        return;
      }
      setNotifications(
        parsed
          .filter((item) => item && typeof item === 'object')
          .slice(0, 60),
      );
      setNotificationsHydrated(true);
    } catch {
      setNotificationsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!notificationsHydrated) return;
    localStorage.setItem(notificationStorageKey, JSON.stringify(notifications.slice(0, 60)));
  }, [notifications, notificationsHydrated]);

  const realtimeHandlers = useMemo(
    () => ({
      'order:new': (newOrder: any) => {
        // For new orders we may not have the full shape in the event payload,
        // so we append if we have data, otherwise fall back to a targeted invalidate.
        if (newOrder?.id) {
          queryClient.setQueryData(['live-orders'], (old: any[]) => {
            if (!Array.isArray(old)) return old;
            // Avoid duplicates on socket replay after reconnect
            if (old.some((o) => o.id === newOrder.id)) return old;
            return [newOrder, ...old];
          });
        } else {
          queryClient.invalidateQueries({ queryKey: ['live-orders'] });
        }
        void refreshLiveOrderCount();
      },
      'order:update': (updatedOrder: any) => {
        if (updatedOrder?.id) {
          // Patch the cache in-place â€” no HTTP request fired.
          // Version guard: only apply if this event is NEWER than what is in cache.
          // Prevents stale socket replay events from regressing the board during reconnect.
          queryClient.setQueryData(['live-orders'], (old: any[]) => {
            if (!Array.isArray(old)) return old;
            const exists = old.some((o) => o.id === updatedOrder.id);
            if (!exists) {
              // Order not in live board (e.g. moved to history) â€” no action needed
              return old;
            }
            return old.map((o) => {
              if (o.id !== updatedOrder.id) return o;
              // Only apply if this event version is strictly newer
              if (typeof o.version === 'number' && typeof updatedOrder.version === 'number' && updatedOrder.version <= o.version) {
                return o;
              }
              return updatedOrder;
            });
          });
          // Also invalidate history and billing counter (these are lighter â€” they don't block the board)
          queryClient.invalidateQueries({ queryKey: ['order-history'] });
          queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
        } else {
          // Fallback: no ID in payload â€” full refetch
          queryClient.invalidateQueries({ queryKey: ['live-orders'] });
          queryClient.invalidateQueries({ queryKey: ['order-history'] });
          queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
        }
        void refreshLiveOrderCount();
      },
      'orders:bulk_status': () => {
        queryClient.invalidateQueries({ queryKey: ['live-orders'] });
        queryClient.invalidateQueries({ queryKey: ['order-history'] });
        queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
        void refreshLiveOrderCount();
      },
      'waiter:call': (call: any) => {
        console.log('[DEBUG_DASHBOARD] RECEIVED waiter:call event:', call);
        const callType = String(call?.type || 'WAITER').toUpperCase();
        const tableName = call?.tableName ? call.tableName : 'A table';
        
        // Use a distinct "Ping" sound for waiter calls
        const WAITER_SOUND = 'https://assets.mixkit.co/active_storage/sfx/495/495-preview.mp3';

        const metadata = {
          tableId: call.tableId,
          tableName: call.tableName,
          sessionId: call.sessionId,
          type: callType
        };

        if (callType === 'BILL') {
          pushNotification({
            title: 'Bill Request',
            message: `${tableName} asked for billing.`,
            level: 'warning',
            sound: WAITER_SOUND,
            metadata
          });
          return;
        }
        pushNotification({
          title: callType === 'WAITER' ? 'Waiter Call' : `${callType} Request`,
          message: `${tableName} requested attention.`,
          level: 'info',
          sound: WAITER_SOUND,
          metadata
        });
      },
      'table:status_change': () => {
        queryClient.invalidateQueries({ queryKey: ['zones-overview'] });
      },
      'session:new': () => queryClient.invalidateQueries({ queryKey: ['live-orders'] }),
      'session:update': () => queryClient.invalidateQueries({ queryKey: ['live-orders'] }),
      'session:finished': () => {
        queryClient.invalidateQueries({ queryKey: ['live-orders'] });
        queryClient.invalidateQueries({ queryKey: ['order-history'] });
      },
      'session:completed': () => {
        queryClient.invalidateQueries({ queryKey: ['live-orders'] });
        queryClient.invalidateQueries({ queryKey: ['order-history'] });
        queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
      },
    }),
    [pushNotification, queryClient, refreshLiveOrderCount],
  );

  useRealtimeSocket({
    enabled: shouldEnableShellRealtime,
    handlers: realtimeHandlers,
    onReconnect: () => {
      queryClient.invalidateQueries({ queryKey: ['live-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-history'] });
      queryClient.invalidateQueries({ queryKey: ['zones-overview'] });
      void refreshLiveOrderCount();
    },
  });

  useEffect(() => {
    refreshLiveOrderCount(); // Synchronous — safe on mount
  }, [refreshLiveOrderCount]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isLoading || showFirstTimeDemo) return;
    if (!canShowFirstTimeDemo || !business || needsWorkspaceSetup(business)) return;
    const hasSeenDemo = localStorage.getItem(demoStorageKey) === '1';
    if (hasSeenDemo) return;
    setShowFirstTimeDemo(true);

    const driverObj = driver({
      showProgress: true,
      steps: [
        { popover: { title: 'Welcome to RestoFlow', description: 'This walkthrough shows how menu, tables, kitchen, service, billing, and staff controls connect inside one operating system.', side: 'bottom', align: 'center' }},
        { element: '#dashboard-stats-grid', onHighlightStarted: () => navigate('/app'), popover: { title: 'Start with the live pulse', description: 'Revenue, active tables, and live order movement are visible here so managers can understand service pressure quickly.', side: 'bottom', align: 'start' }},
        { element: '#nav-menu', onHighlightStarted: () => navigate('/app/menu'), popover: { title: 'Build the menu once', description: 'Categories, modifiers, photos, and availability updates all flow from this shared source of truth.', side: 'right', align: 'start' }},
        { element: '#item-list-container', onHighlightStarted: () => navigate('/app/menu'), popover: { title: 'Preview the guest experience', description: 'Check the live preview before publishing so your team knows exactly what diners will see on mobile.', side: 'left', align: 'start' }},
        { element: '#nav-tables-qr', onHighlightStarted: () => navigate('/app/tables'), popover: { title: 'Map tables and QR access', description: 'Set up zones, tables, and QR entry points so dine-in sessions always attach to the right service location.', side: 'right', align: 'start' }},
        { element: '#floor-builder-canvas', onHighlightStarted: () => navigate('/app/tables'), popover: { title: 'Match the real restaurant', description: 'Arrange the floor visually so staff can understand occupancy and routing without guessing.', side: 'left', align: 'start' }},
        { element: '#nav-live-orders', onHighlightStarted: () => navigate('/app/orders'), popover: { title: 'Control the live pipeline', description: 'Orders move from kitchen to service to billing here. This is the core rush-hour workspace for operators.', side: 'right', align: 'start' }},
        { element: '#nav-billing', onHighlightStarted: () => navigate('/app/billing'), popover: { title: 'Close bills with confidence', description: 'Invoices, payment states, and export-ready records stay together for end-of-day accuracy.', side: 'right', align: 'start' }},
        { element: '#nav-analytics', onHighlightStarted: () => navigate('/app/analytics'), popover: { title: 'Track performance trends', description: 'Use analytics to review demand, menu movement, and operational patterns instead of relying on memory.', side: 'right', align: 'start' }},
        { element: '#nav-settings', onHighlightStarted: () => navigate('/app/settings'), popover: { title: 'Keep business identity complete', description: 'Business details, staff access, and invoice identity should stay accurate here so setup never blocks operations.', side: 'right', align: 'start' }},
        { element: '#nav-notifications-btn', popover: { title: 'Focus on the right alerts', description: 'Notifications surface live assistance and billing needs so the correct role can respond quickly.', side: 'bottom', align: 'end' }},
        { element: '#nav-profile-btn', popover: { title: 'Manage staff preferences', description: 'Open the profile menu for password changes, language selection, ordering links, and waiter tip summaries.', side: 'bottom', align: 'end' }},
        { popover: { title: 'Next best step', description: 'Finish your menu, verify tables, and then place one full test order from customer to kitchen to billing.' }},
      ],
      onDestroyStarted: () => {
        if (!driverObj.hasNextStep() || confirm("Are you sure you want to skip the tour?")) {
           driverObj.destroy();
           localStorage.setItem(demoStorageKey, '1');
        }
      }
    });

    driverObj.drive();
  }, [isLoading, isPlanLoading, showFirstTimeDemo, canShowFirstTimeDemo, business, demoStorageKey, navigate, notifications.length]);


  if (isLoading) {
    return <ScreenLoader message="Syncing profile..." />;
  }

  if (role === 'UNKNOWN') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <h2 className="text-white text-xl font-black tracking-tight">Role Access Error</h2>
          <p className="mt-2 text-sm text-slate-400">
            Your account role could not be validated. Please sign in again.
          </p>
          <button
            onClick={() => {
              logoutAndReload();
            }}
            className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (canShowAdminShellData && business && needsWorkspaceSetup(business) && FULL_ACCESS_ROLES.has(role)) {
    return <Navigate to="/setup" replace />;
  }

  if (role === 'WAITER' && location.pathname !== '/app/waiter') {
    return <Navigate to="/app/waiter" replace />;
  }
  if (role !== 'WAITER' && location.pathname === '/app/waiter') {
    return <Navigate to={defaultRoute} replace />;
  }

  const allowedPaths = new Set<string>([
    ...(canAccessDashboard ? ['/app'] : []),
    ...(canAccessMenu ? ['/app/menu'] : []),
    ...(canAccessTables ? ['/app/tables'] : []),
    ...(canAccessOrders ? ['/app/orders'] : []),
    ...(canAccessAssistedOrdering ? ['/app/assisted-ordering'] : []),
    ...(role === 'WAITER' ? ['/app/waiter'] : []),
    ...(canAccessBilling ? ['/app/billing', '/app/subscription'] : []),
    ...(canAccessAnalytics ? ['/app/analytics'] : []),
    ...(canAccessSettings ? ['/app/settings'] : []),
  ]);

  const isPathAllowed = (() => {
    // Exact match for the dashboard home or specific tools
    if (allowedPaths.has(location.pathname)) return true;
    // Special case for sub-paths or trailing slashes
    if (allowedPaths.has(location.pathname.replace(/\/$/, ''))) return true;
    return false;
  })();

  if (!isPathAllowed) {
    return <Navigate to={defaultRoute} replace />;
  }

  const navItems = [
    ...(role === 'WAITER'
      ? [{ to: '/app/waiter', label: 'Waiter Ops', icon: <Receipt size={18} />, badge: liveOrderCount, isLocked: !features.hasWaiterApp }]
      : []),
    ...(canAccessDashboard ? [{ to: '/app', label: 'Dashboard', icon: <LayoutDashboard size={18} /> }] : []),
    ...(canAccessMenu ? [{ to: '/app/menu', label: 'Menu', icon: <UtensilsCrossed size={18} /> }] : []),
    ...(canAccessTables ? [{ to: '/app/tables', label: 'Tables & QR', icon: <Store size={18} />, isLocked: features.maxFloors === 0 }] : []),
    ...(canAccessOrders && role !== 'WAITER' ? [{ to: '/app/orders', label: 'Live Orders', icon: <Receipt size={18} />, badge: liveOrderCount }] : []),
    ...(canAccessAssistedOrdering ? [{ to: '/app/assisted-ordering', label: 'Assisted Ordering', icon: <Receipt size={18} />, isLocked: !features.hasWaiterRole }] : []),
    ...(canAccessBilling ? [{ to: '/app/billing', label: 'Billing', icon: <CreditCard size={18} /> }] : []),
    ...(canAccessAnalytics ? [{ to: '/app/analytics', label: 'Analytics', icon: <BarChart3 size={18} />, badge: features.hasAdvancedAnalytics ? 0 : 'LOCKED', isLocked: !features.hasAdvancedAnalytics }] : []),
    ...(canAccessSettings ? [{ to: '/app/settings', label: 'Settings', icon: <Settings2 size={18} /> }] : []),
  ];

  return (
    <div className="relative flex min-h-[100dvh] font-sans selection:bg-blue-500/30 lg:h-screen lg:overflow-hidden" style={{ background: 'var(--shell-bg)', color: 'var(--text-1)' }}>
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: 'var(--shell-gradient)' }} />
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-40 flex h-[100dvh] w-[min(280px,84vw)] flex-col backdrop-blur-xl transition-transform duration-300 lg:sticky lg:top-0 lg:z-10 lg:h-screen lg:flex-shrink-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 ${sidebarCollapsed ? 'lg:w-[68px]' : 'lg:w-[240px]'}`} style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}>
        <div className="px-4 py-6 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(37,99,235,0.4)]" style={{ background: 'var(--sidebar-logo-bg)' }}>
            <UtensilsCrossed size={16} className="text-white" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-black text-lg tracking-tight" style={{ color: 'var(--text-1)', fontFamily: 'Inter, sans-serif' }}>
              RestoFlow
            </span>
          )}
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-xl border lg:hidden"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {navItems.map(({ to, label, icon, badge, isLocked }: any) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={isLocked ? '/app/subscription' : to}
                id={`nav-${label.toLowerCase().replace(/ & /g, '-').replace(' ', '-')}`}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative group border ${
                  active ? 'border-blue-500/20' : 'border-transparent'
                } ${isLocked ? 'opacity-60 grayscale-[0.5]' : ''}`}
                style={{
                  background: active ? 'var(--sidebar-item-active-bg)' : undefined,
                  color: isLocked ? '#94a3b8' : (active ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)'),
                }}
                onClick={() => setMobileNavOpen(false)}
                onMouseEnter={(e) => { if (!active && !isLocked) e.currentTarget.style.background = 'var(--sidebar-item-hover-bg)'; }}
                onMouseLeave={(e) => { if (!active && !isLocked) e.currentTarget.style.background = ''; }}
              >
                <span className="flex-shrink-0 relative">
                  {icon}
                  {active && <span className="absolute -inset-1.5 rounded-lg bg-blue-400/25 blur-sm -z-10" />}
                </span>
                {!sidebarCollapsed && <span className="truncate">{label}</span>}
                {isLocked && !sidebarCollapsed && (
                   <span className="ml-auto text-[8px] font-black px-1 py-0.5 rounded bg-amber-500/20 text-amber-500 uppercase tracking-widest border border-amber-500/30">
                     PRO
                   </span>
                )}
                {badge != null && !isLocked && (typeof badge === 'number' ? badge > 0 : true) && (
                  <span className={`ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full ${typeof badge === 'string' ? 'bg-slate-700 text-slate-400' : 'bg-blue-500 text-white'}`}>
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all lg:flex"
            style={{ color: 'var(--text-3)' }}
          >
            <ChevronRight size={18} className={`transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
          <button
            onClick={() => {
              setMobileNavOpen(false);
              logoutAndReload();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400/80 hover:bg-red-500/10 hover:text-red-300 text-sm font-medium transition-all"
          >
            <LogIn size={18} className="rotate-180" />
            {(!sidebarCollapsed || mobileNavOpen) && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main className="relative z-10 flex min-h-[100dvh] min-w-0 flex-1 flex-col bg-transparent lg:h-full lg:min-h-0 lg:overflow-hidden">
        <div className="flex-shrink-0 px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6 lg:pt-5">
          <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-black uppercase tracking-[0.14em]" style={{ color: 'var(--text-1)' }}>
                {role === 'WAITER' ? 'Waiter workspace' : 'Operations workspace'}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-3)' }}>
                {navItems.length} live tools available
              </p>
            </div>
          </div>
          {isError && role !== 'KITCHEN' && (
            <div
              className="mb-3 rounded-2xl border px-4 py-3 text-sm font-semibold"
              style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#fecaca' }}
            >
              Workspace details are temporarily unavailable. Core tools are still loaded, and you can retry from page refresh if needed.
            </div>
          )}
          <VendorTopNav
            path={location.pathname}
            role={role}
            business={business}
            billing={billing}
            liveOrderCount={liveOrderCount}
            canAccessSettings={canAccessSettings}
            canAccessBilling={canAccessBilling}
            notifications={notifications}
            unreadNotificationCount={unreadNotificationCount}
            onMarkNotificationsRead={markNotificationsRead}
            onClearNotifications={clearNotifications}
            onNotificationClick={(n) => {
              if (n.metadata?.sessionId) {
                setActiveWaiterCall(n);
              }
            }}
            onLogout={logoutAndReload}
          />
        </div>

        <div id="scroll-container" className="min-h-0 flex-1 px-2 pb-2 pt-2 sm:px-3 sm:pb-3 lg:px-5 lg:pb-5 overflow-y-auto custom-scrollbar relative">
          <DashboardErrorBoundary>
            <Routes>
              {canAccessDashboard && <Route index element={<DashboardOverview />} />}
              {canAccessMenu && <Route path="menu" element={<MenuBuilder />} />}
              {canAccessTables && <Route path="tables" element={<FloorPlan />} />}
              {canAccessOrders && <Route path="orders" element={<Orders role={role} />} />}
              {canAccessAssistedOrdering && <Route path="assisted-ordering" element={<AssistedOrderingPage />} />}
              {canAccessAnalytics && <Route path="analytics" element={<Analytics />} />}
              {canAccessSettings && <Route path="settings" element={<Settings />} />}
              {canAccessBilling && <Route path="billing" element={<Billing />} />}
              {canAccessBilling && <Route path="subscription" element={<SubscriptionPage />} />}
              {role === 'WAITER' && <Route path="waiter" element={<WaiterPage />} />}
              <Route path="*" element={<Navigate to={defaultRoute} replace />} />
            </Routes>
          </DashboardErrorBoundary>
        </div>
      </main>

      {/* Floating Toasts */}
      <div className="pointer-events-none fixed inset-x-3 top-3 z-[9999] flex w-auto max-w-[calc(100vw-1.5rem)] flex-col gap-3 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-full sm:max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-4 p-4 rounded-2xl shadow-2xl border transition-all active:scale-95"
            style={{ 
              background: 'var(--surface)', 
              borderColor: toast.level === 'warning' ? '#f59e0b66' : toast.level === 'error' ? '#ef444466' : 'var(--border)',
              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.15), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
              animation: 'toast-enter 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div 
              className="mt-1 h-3 w-3 rounded-full flex-shrink-0 animate-pulse" 
              style={{ 
                background: toast.level === 'warning' ? '#f59e0b' : toast.level === 'error' ? '#ef4444' : '#3b82f6',
                boxShadow: toast.level === 'warning' ? '0 0 10px #f59e0b' : toast.level === 'error' ? '0 0 10px #ef4444' : '0 0 10px #3b82f6'
              }} 
            />
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm uppercase tracking-tight" style={{ color: 'var(--text-1)' }}>{toast.title}</p>
              <p className="text-xs font-bold mt-1 leading-relaxed" style={{ color: 'var(--text-2)' }}>{toast.message}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Waiter Call Handshake Modal */}
      {activeWaiterCall && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Store size={32} className="text-blue-500" />
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight">
                {activeWaiterCall.metadata?.tableName || 'Table'} Assistance
              </h3>
              <p className="mt-2 text-slate-400 font-medium">
                Customer is requesting <span className="text-blue-400 uppercase">{activeWaiterCall.metadata?.type || 'Help'}</span>.
              </p>
              
              <div className="mt-8 space-y-3">
                <button
                  onClick={async () => {
                    try {
                      const business = (queryClient.getQueryData(['settings-business']) as any);
                      const slug = business?.slug;
                      if (!slug) throw new Error('Tenant slug not found');

                      await api.post(`/public/${slug}/waiter-call/acknowledge`, {
                        sessionId: activeWaiterCall.metadata?.sessionId,
                        tableId: activeWaiterCall.metadata?.tableId
                      });
                      
                      // Success feedback
                      setActiveWaiterCall(null);
                      setNotifications(prev => prev.filter(n => n.id !== activeWaiterCall.id));
                    } catch (err) {
                      console.error('Handshake failed:', err);
                      setActiveWaiterCall(null);
                    }
                  }}
                  className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                >
                  ACCEPT & NOTIFY GUEST
                </button>
                <button
                  onClick={() => setActiveWaiterCall(null)}
                  className="w-full h-14 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl transition-all"
                >
                  DISMISS
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes toast-enter {
          0% { transform: translateX(100%) scale(0.9); opacity: 0; }
          100% { transform: translateX(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('accessToken'));
  const [mustChangePassword, setMustChangePassword] = useState(
    () => localStorage.getItem('mustChangePassword') === '1',
  );
  const role = normalizeDashboardRole(localStorage.getItem('userRole'));
  const clerkConfigured = Boolean(
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );

  const handleLogin = ({ mustChangePassword: shouldChange }: { mustChangePassword: boolean }) => {
    setMustChangePassword(shouldChange);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    markManualLogout();
    void api.post('/auth/logout').catch(() => undefined);
    clearDashboardAuthStorage();
    const clerk = (globalThis as any).Clerk;
    if (clerk?.signOut) void Promise.resolve(clerk.signOut()).catch(() => {});
    setMustChangePassword(false);
    setIsLoggedIn(false);
  };

  return (
    <Routes>
      <Route path="/admin" element={<Admin />} />
      <Route path="/sso-callback" element={clerkConfigured ? <AuthenticateWithRedirectCallback /> : <Navigate to="/login" replace />} />

      <Route path="/" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : <MarketingHomeRoute />} />
      <Route path="/product" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : <MarketingProductRoute />} />
      <Route path="/setup-flow" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : <MarketingSetupFlowRoute />} />
      <Route path="/billing" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : <MarketingBillingRoute />} />
      <Route path="/demo" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : <MarketingDemoRoute />} />
      <Route path="/contact" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : <MarketingContactRoute />} />
      <Route path="/privacy" element={<MarketingPrivacyRoute />} />
      <Route path="/terms" element={<MarketingTermsRoute />} />
      <Route path="/login" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : <LoginPage onLogin={handleLogin} />} />
      <Route path="/signup" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : <SignupPage onLogin={handleLogin} />} />

      <Route
        path="/setup"
        element={
          !isLoggedIn ? (
            <Navigate to="/login" replace />
          ) : FULL_ACCESS_ROLES.has(role) ? (
            <Onboarding nextPath={role === 'OWNER' && mustChangePassword ? '/security-setup' : getDefaultRouteForRole(role)} />
          ) : (
            <Navigate to={getDefaultRouteForRole(role)} replace />
          )
        }
      />

      <Route
        path="/security-setup"
        element={
          !isLoggedIn ? (
            <Navigate to="/login" replace />
          ) : role === 'OWNER' && mustChangePassword ? (
            <FirstLoginPasswordGate
              onCompleted={() => setMustChangePassword(false)}
              onLogout={handleLogout}
            />
          ) : (
            <PostLoginRedirect mustChangePassword={false} />
          )
        }
      />

      <Route
        path="/app/*"
        element={!isLoggedIn ? <Navigate to="/login" replace /> : <DashboardShell />}
      />

      <Route path="*" element={<Navigate to={isLoggedIn ? getDefaultRouteForRole(role) : '/'} replace />} />
    </Routes>
  );
}

const _AppWithLanguage = App;
export { _AppWithLanguage as AppInner };

function AppWithLanguage() {
  return (
    <LanguageProvider>
      <App />
    </LanguageProvider>
  );
}

export default AppWithLanguage;
