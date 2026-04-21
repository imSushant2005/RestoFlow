import { Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Receipt,
  CreditCard,
  BarChart3,
  Smartphone,
  Settings2,
  ChevronRight,
  Store,
  Loader2,
  Menu,
  X,
} from 'lucide-react';
import { FirstLoginPasswordGate } from './components/FirstLoginPasswordGate';
import { DashboardErrorBoundary } from './components/DashboardErrorBoundary';
import { LanguageProvider } from './contexts/LanguageContext';
import { VendorTopNav, type OpsNotification } from './components/VendorTopNav';
import { useRealtimeSocket } from './hooks/useRealtimeSocket';
import { api } from './lib/api';
import { formatINR } from './lib/currency';
import { clearDashboardAuthStorage, markManualLogout } from './lib/authSession';
import 'driver.js/dist/driver.css';

const DashboardOverview = lazy(() => import('./pages/DashboardOverview').then((m) => ({ default: m.DashboardOverview })));
const MenuBuilder = lazy(() => import('./pages/MenuBuilder').then((m) => ({ default: m.MenuBuilder })));
const FloorPlan = lazy(() => import('./pages/FloorPlan').then((m) => ({ default: m.FloorPlan })));
const Orders = lazy(() => import('./pages/Orders').then((m) => ({ default: m.Orders })));
const Analytics = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.Analytics })));
const AssistedOrderingPage = lazy(() => import('./pages/AssistedOrderingPage').then((m) => ({ default: m.AssistedOrderingPage })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })));
const Billing = lazy(() => import('./pages/InvoicesPage').then((m) => ({ default: m.InvoicesPage })));
const SubscriptionPage = lazy(() => import('./pages/PlansHub').then((m) => ({ default: m.PlansHub })));
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })));
const WaiterPage = lazy(() => import('./pages/WaiterPage').then((m) => ({ default: m.WaiterPage })));
const AuthContactPage = lazy(() => import('./pages/AuthContactPage').then((m) => ({ default: m.AuthContactPage })));
const DemoPage = lazy(() => import('./pages/DemoPage').then((m) => ({ default: m.DemoPage })));
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const PrivacyPolicyPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.PrivacyPolicyPage })));
const TermsPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.TermsPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const MarketingBillingPage = lazy(() =>
  import('./pages/MarketingBillingPage').then((m) => ({ default: m.MarketingBillingPage })),
);
const ProductPage = lazy(() => import('./pages/ProductPage').then((m) => ({ default: m.ProductPage })));
const SignupPage = lazy(() => import('./pages/SignupPage').then((m) => ({ default: m.SignupPage })));
const SetupFlowPage = lazy(() => import('./pages/SetupFlowPage').then((m) => ({ default: m.SetupFlowPage })));
const ClerkFinalizePage = lazy(() =>
  import('./pages/ClerkFinalizePage').then((m) => ({ default: m.ClerkFinalizePage })),
);

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
const BUSINESS_READ_ROLES = new Set<DashboardRole>(['OWNER', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN']);
const notificationStorageKey = 'rf_ops_notifications_v1';
const DASHBOARD_PAYMENT_SUBMITTED_EVENT = 'rf:session-payment-submitted';

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

function withScreenFallback(node: ReactNode, message = 'Loading workspace...') {
  return <Suspense fallback={<ScreenLoader message={message} />}>{node}</Suspense>;
}

function MarketingHomeRoute() {
  const navigate = useNavigate();
  return withScreenFallback(
    <HomePage
      onLoginClick={() => navigate('/login')}
      onSignupClick={() => navigate('/signup')}
      onContactClick={() => navigate('/contact')}
    />,
    'Loading home...'
  );
}

function MarketingProductRoute() {
  const navigate = useNavigate();
  return withScreenFallback(
    <ProductPage
      onLoginClick={() => navigate('/login')}
      onSignupClick={() => navigate('/signup')}
      onContactClick={() => navigate('/contact')}
    />,
    'Loading product...'
  );
}

function MarketingSetupFlowRoute() {
  const navigate = useNavigate();
  return withScreenFallback(
    <SetupFlowPage
      onLoginClick={() => navigate('/login')}
      onSignupClick={() => navigate('/signup')}
      onContactClick={() => navigate('/contact')}
    />,
    'Loading setup flow...'
  );
}

function MarketingBillingRoute() {
  const navigate = useNavigate();
  return withScreenFallback(
    <MarketingBillingPage
      onLoginClick={() => navigate('/login')}
      onSignupClick={() => navigate('/signup')}
      onContactClick={() => navigate('/contact')}
    />,
    'Loading billing...'
  );
}

function MarketingDemoRoute() {
  const navigate = useNavigate();
  return withScreenFallback(
    <DemoPage
      onLoginClick={() => navigate('/login')}
      onSignupClick={() => navigate('/signup')}
      onContactClick={() => navigate('/contact')}
    />,
    'Loading demo...'
  );
}

function MarketingContactRoute() {
  const navigate = useNavigate();
  return withScreenFallback(
    <AuthContactPage
      onBackHome={() => navigate('/')}
      onLoginClick={() => navigate('/login')}
      onSignupClick={() => navigate('/signup')}
    />,
    'Loading contact...'
  );
}

function MarketingPrivacyRoute() {
  const navigate = useNavigate();
  return withScreenFallback(
    <PrivacyPolicyPage
      onBackHome={() => navigate('/')}
      onLoginClick={() => navigate('/login')}
      onSignupClick={() => navigate('/signup')}
      onContactClick={() => navigate('/contact')}
    />,
    'Loading privacy policy...'
  );
}

function MarketingTermsRoute() {
  const navigate = useNavigate();
  return withScreenFallback(
    <TermsPage
      onBackHome={() => navigate('/')}
      onLoginClick={() => navigate('/login')}
      onSignupClick={() => navigate('/signup')}
      onContactClick={() => navigate('/contact')}
    />,
    'Loading terms...'
  );
}

function PostLoginRedirect({ mustChangePassword }: { mustChangePassword: boolean }) {
  const role = normalizeDashboardRole(localStorage.getItem('userRole'));
  const shouldForceSecuritySetup = role === 'OWNER' && mustChangePassword;

  if (role === 'UNKNOWN') {
    clearDashboardAuthStorage();
    return <Navigate to="/login" replace />;
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
  const [pendingPaymentVerification, setPendingPaymentVerification] = useState<{
    sessionId: string;
    tableName?: string;
    totalAmount?: number;
  } | null>(null);
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
  const canAccessAnalytics = role !== "UNKNOWN";
  const canAccessAssistedOrdering = role !== "UNKNOWN";
  const canAccessSettings = FULL_ACCESS_ROLES.has(role);
  const canShowFirstTimeDemo = FULL_ACCESS_ROLES.has(role);
  const canShowAdminShellData = BUSINESS_READ_ROLES.has(role);
  const shouldFetchBusinessShellData = canShowAdminShellData;
  const shouldEnableShellRealtime = canAccessOrders && role !== 'WAITER';

  const businessQuery = useQuery({
    queryKey: ['settings-business'],
    queryFn: async () => (await api.get('/settings/business')).data,
    retry: false,
    staleTime: 1000 * 60 * 5,
    enabled: shouldFetchBusinessShellData,
  });

  const business = businessQuery.data;
  const billing = null;
  const isLoading = shouldFetchBusinessShellData && businessQuery.isLoading && !business;
  const demoStorageKey = getDemoStorageKey(business);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;

    if (mobileNavOpen) {
      root.classList.add('dashboard-nav-open');
      body.classList.add('dashboard-nav-open');
    } else {
      root.classList.remove('dashboard-nav-open');
      body.classList.remove('dashboard-nav-open');
    }

    return () => {
      root.classList.remove('dashboard-nav-open');
      body.classList.remove('dashboard-nav-open');
    };
  }, [mobileNavOpen]);

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
        metadata: entry.metadata, 
      };

      setNotifications((previous) => [next, ...previous].slice(0, 60));
      setToasts((prev) => [...prev, next]);
      playNotificationSound(entry.sound);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6000);
    },
    [setNotifications, setToasts],
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
        if (newOrder?.id) {
          queryClient.setQueryData(['live-orders'], (old: any[]) => {
            if (!Array.isArray(old)) return old;
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
          queryClient.setQueryData(['live-orders'], (old: any[]) => {
            if (!Array.isArray(old)) return old;
            const exists = old.some((o) => o.id === updatedOrder.id);
            if (!exists) return old;
            return old.map((o) => {
              if (o.id !== updatedOrder.id) return o;
              if (typeof o.version === 'number' && typeof updatedOrder.version === 'number' && updatedOrder.version <= o.version) {
                return o;
              }
              return updatedOrder;
            });
          });
          queryClient.invalidateQueries({ queryKey: ['order-history'] });
          queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
        } else {
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
        const callType = String(call?.type || 'WAITER').toUpperCase();
        const tableName = call?.tableName ? call.tableName : 'A table';
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
      'session:update': (payload: any) => {
        if (payload?.sessionId) {
          queryClient.setQueryData(['live-orders'], (old: any[]) => {
            if (!Array.isArray(old)) return old;
            return old.map(order => {
              if (order.diningSessionId === payload.sessionId && order.diningSession) {
                return {
                  ...order,
                  diningSession: {
                    ...order.diningSession,
                    sessionStatus: payload.status || order.diningSession.sessionStatus,
                    bill: payload.bill ? { ...order.diningSession.bill, ...payload.bill } : order.diningSession.bill
                  }
                };
              }
              return order;
            });
          });
        }
        queryClient.invalidateQueries({ queryKey: ['live-orders'] });
      },
      'session:finished': (payload: any) => {
        if (payload?.sessionId) {
          queryClient.setQueryData(['live-orders'], (old: any[]) => {
            if (!Array.isArray(old)) return old;
            return old.map(order => 
              order.diningSessionId === payload.sessionId && order.diningSession 
                ? { ...order, diningSession: { ...order.diningSession, sessionStatus: 'AWAITING_BILL' } } 
                : order
            );
          });
        }
        queryClient.invalidateQueries({ queryKey: ['live-orders'] });
        queryClient.invalidateQueries({ queryKey: ['order-history'] });
      },
      'session:settled': () => {
        queryClient.invalidateQueries({ queryKey: ['live-orders'] });
        queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
      },
      'session:payment_submitted': (payload: any) => {
        queryClient.invalidateQueries({ queryKey: ['live-orders'] });
        queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
        const amount = Number(payload?.totalAmount || 0);
        const tableName = payload?.tableName ? `Table ${payload.tableName}` : 'A session';
        pushNotification({
          title: 'Check Account',
          message: `${tableName} marked ${amount > 0 ? formatINR(amount) : 'the payment'} as completed. Please verify it now.`,
          level: 'warning',
          sound: 'https://assets.mixkit.co/active_storage/sfx/495/495-preview.mp3',
          metadata: {
            sessionId: payload?.sessionId,
            tableId: payload?.tableId,
            tableName: payload?.tableName,
            totalAmount: amount,
            kind: 'PAYMENT_VERIFICATION',
          },
        });
        window.dispatchEvent(new CustomEvent(DASHBOARD_PAYMENT_SUBMITTED_EVENT, { detail: payload }));
      },
      'session:payment_rejected': () => {
        queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
      },
      'session:payment_requested': (payload: any) => {
        const method = String(payload?.paymentMethod || 'cash').toUpperCase();
        const tableName = payload?.tableName ? `Table ${payload.tableName}` : 'A table';
        pushNotification({
          title: 'Payment Requested',
          message: `${tableName} requested to pay via ${method}.`,
          level: 'info',
          sound: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
          metadata: {
            sessionId: payload?.sessionId,
            tableId: payload?.tableId,
            kind: 'PAYMENT_REQUESTED'
          }
        });
        queryClient.invalidateQueries({ queryKey: ['live-orders'] });
        queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
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
    if (!pendingPaymentVerification) return;
    if (location.pathname !== '/app/orders') return;

    const timeoutId = window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent(DASHBOARD_PAYMENT_SUBMITTED_EVENT, {
          detail: {
            sessionId: pendingPaymentVerification.sessionId,
            tableName: pendingPaymentVerification.tableName,
            totalAmount: pendingPaymentVerification.totalAmount,
          },
        }),
      );
      setPendingPaymentVerification(null);
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [location.pathname, pendingPaymentVerification]);

  useEffect(() => {
    refreshLiveOrderCount();
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
    let cancelled = false;
    let driverObj: any = null;

    void import('driver.js').then(({ driver }) => {
      if (cancelled) return;

      driverObj = driver({
        showProgress: true,
        steps: [
          { popover: { title: 'Welcome to RestoFlow', description: 'One OS for restaurant operations.', side: 'bottom', align: 'center' }},
          { element: '#dashboard-stats-grid', onHighlightStarted: () => navigate('/app'), popover: { title: 'Pulse', description: 'Revenue and occupancy.', side: 'bottom', align: 'start' }},
          { element: '#nav-menu', onHighlightStarted: () => navigate('/app/menu'), popover: { title: 'Menu', description: 'Product truth.', side: 'right', align: 'start' }},
          { element: '#nav-tables-qr', onHighlightStarted: () => navigate('/app/tables'), popover: { title: 'Floor', description: 'QR entry.', side: 'right', align: 'start' }},
          { element: '#nav-live-orders', onHighlightStarted: () => navigate('/app/orders'), popover: { title: 'Pipeline', description: 'The rush.', side: 'right', align: 'start' }},
        ],
        onDestroyStarted: () => {
          driverObj?.destroy();
          localStorage.setItem(demoStorageKey, '1');
        }
      });

      driverObj.drive();
    }).catch(() => {
      localStorage.setItem(demoStorageKey, '1');
    });

    return () => {
      cancelled = true;
    };
  }, [isLoading, showFirstTimeDemo, canShowFirstTimeDemo, business, demoStorageKey, navigate]);

  if (isLoading) {
    return <ScreenLoader message="Syncing profile..." />;
  }

  if (role === 'UNKNOWN') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <h2 className="text-white text-xl font-black tracking-tight">Access Error</h2>
          <button onClick={logoutAndReload} className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">Back to Login</button>
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

  const allowedPaths = new Set<string>([
    ...(canAccessDashboard ? ['/app'] : []),
    ...(canAccessMenu ? ['/app/menu'] : []),
    ...(canAccessTables ? ['/app/tables'] : []),
    ...(canAccessOrders ? ['/app/orders'] : []),
    ...(role === 'WAITER' ? ['/app/waiter'] : []),
    ...(canAccessBilling ? ['/app/billing', '/app/subscription'] : []),
    ...(canAccessAnalytics ? ['/app/analytics'] : []),
    ...(canAccessAssistedOrdering ? ['/app/assisted'] : []),
    ...(canAccessSettings ? ['/app/settings'] : []),
  ]);

  if (!allowedPaths.has(location.pathname) && !allowedPaths.has(location.pathname.replace(/\/$/, ''))) {
    return <Navigate to={defaultRoute} replace />;
  }

  const navItems = [
    ...(role === 'WAITER' ? [{ to: '/app/waiter', label: 'Waiter Ops', icon: <Receipt size={18} />, badge: liveOrderCount }] : []),
    ...(canAccessDashboard ? [{ to: '/app', label: 'Dashboard', icon: <LayoutDashboard size={18} /> }] : []),
    ...(canAccessMenu ? [{ to: '/app/menu', label: 'Menu', icon: <UtensilsCrossed size={18} /> }] : []),
    ...(canAccessTables ? [{ to: '/app/tables', label: 'Tables', icon: <Store size={18} /> }] : []),
    ...(canAccessOrders && role !== 'WAITER' ? [{ to: '/app/orders', label: 'Live Orders', icon: <Receipt size={18} />, badge: liveOrderCount }] : []),
    ...(canAccessBilling ? [{ to: '/app/billing', label: 'Billing', icon: <CreditCard size={18} /> }] : []),
    ...(canAccessAnalytics ? [{ to: '/app/analytics', label: 'Analytics', icon: <BarChart3 size={18} /> }] : []),
    ...(canAccessAssistedOrdering ? [{ to: '/app/assisted', label: 'Assisted Order', icon: <Smartphone size={18} /> }] : []),
    ...(canAccessSettings ? [{ to: '/app/settings', label: 'Settings', icon: <Settings2 size={18} /> }] : []),
  ];

  return (
    <div className="relative flex min-h-[100dvh] font-sans lg:h-screen lg:overflow-hidden" style={{ background: 'var(--shell-bg)', color: 'var(--text-1)' }}>
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: 'var(--shell-gradient)' }} />
      {mobileNavOpen && <button onClick={() => setMobileNavOpen(false)} className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex h-[100dvh] w-[min(280px,84vw)] flex-col backdrop-blur-xl transition-transform duration-300 lg:sticky lg:top-0 lg:z-10 lg:h-screen lg:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'} ${sidebarCollapsed ? 'lg:w-[68px]' : 'lg:w-[240px]'}`} style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}>
        <div className="px-4 py-6 flex items-center gap-3 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white"><UtensilsCrossed size={16} /></div>
          {!sidebarCollapsed && <span className="font-black text-lg tracking-tight">RestoFlow</span>}
          <button onClick={() => setMobileNavOpen(false)} className="ml-auto lg:hidden p-2"><X size={18} /></button>
        </div>
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon, badge }: any) => {
            const active = location.pathname === to;
            return (
              <Link key={to} to={to} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${active ? 'bg-blue-500/10 text-blue-500' : 'text-slate-400 hover:text-white'}`} onClick={() => setMobileNavOpen(false)}>
                {icon}
                {!sidebarCollapsed && <span className="truncate">{label}</span>}
                {badge > 0 && <span className="ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full bg-blue-500 text-white">{badge}</span>}
              </Link>
            );
          })}
        </nav>
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="hidden lg:flex items-center gap-3 p-6 text-slate-400 hover:text-white">
          <ChevronRight size={18} className={sidebarCollapsed ? '' : 'rotate-180'} />
          {!sidebarCollapsed && <span className="text-sm font-bold">Collapse</span>}
        </button>
      </aside>

      <main className="relative z-10 flex flex-1 flex-col lg:h-full lg:overflow-hidden">
        <div className="flex-shrink-0 px-4 py-4 lg:px-6 lg:pt-6">
          <div className="flex items-center justify-between lg:hidden mb-4">
             <button onClick={() => setMobileNavOpen(true)} className="p-2 border border-slate-800 rounded-xl"><Menu size={18} /></button>
             <span className="font-black text-xs uppercase tracking-widest text-slate-500">RestoFlow</span>
          </div>
          <VendorTopNav
            path={location.pathname}
            role={role}
            business={business}
            billing={billing}
            liveOrderCount={liveOrderCount}
            canAccessSettings={canAccessSettings}
            canAccessBilling={canAccessBilling}
            onMarkNotificationsRead={markNotificationsRead}
            onClearNotifications={clearNotifications}
            onLogout={logoutAndReload}
            notifications={notifications}
            unreadNotificationCount={unreadNotificationCount}
            onNotificationClick={(n) => {
              if (n.metadata?.kind === 'PAYMENT_VERIFICATION') {
                setPendingPaymentVerification(n.metadata as any);
                navigate('/app/orders');
              } else if (n.metadata?.sessionId) {
                setActiveWaiterCall(n);
              }
            }}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 lg:px-6">
          <DashboardErrorBoundary>
            <Routes>
              {canAccessDashboard && <Route index element={withScreenFallback(<DashboardOverview />)} />}
              {canAccessMenu && <Route path="menu" element={withScreenFallback(<MenuBuilder />)} />}
              {canAccessTables && <Route path="tables" element={withScreenFallback(<FloorPlan />)} />}
              {canAccessOrders && <Route path="orders" element={withScreenFallback(<Orders role={role} />)} />}
              {canAccessAnalytics && <Route path="analytics" element={withScreenFallback(<Analytics />)} />}
              {canAccessAssistedOrdering && <Route path="assisted" element={withScreenFallback(<AssistedOrderingPage />)} />}
              {canAccessSettings && <Route path="settings" element={withScreenFallback(<Settings />)} />}
              {canAccessBilling && <Route path="billing" element={withScreenFallback(<Billing />)} />}
              {canAccessBilling && <Route path="subscription" element={withScreenFallback(<SubscriptionPage />)} />}
              {role === 'WAITER' && <Route path="waiter" element={withScreenFallback(<WaiterPage />)} />}
              <Route path="*" element={<Navigate to={defaultRoute} replace />} />
            </Routes>
          </DashboardErrorBoundary>
        </div>
      </main>

      <div className="pointer-events-none fixed inset-x-3 top-3 z-[9999] flex flex-col gap-3 sm:right-4 sm:top-4 sm:w-80">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto flex items-start gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl animate-in slide-in-from-right duration-300">
             <div className="mt-1 h-2 w-2 rounded-full bg-blue-500 animate-pulse outline outline-4 outline-blue-500/20" />
             <div>
               <p className="font-black text-xs text-white uppercase tracking-tight">{toast.title}</p>
               <p className="text-xs font-bold text-slate-400 mt-0.5">{toast.message}</p>
             </div>
          </div>
        ))}
      </div>

      {activeWaiterCall && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
             <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-500"><Store size={32} /></div>
             <h3 className="text-xl font-black text-white">{activeWaiterCall.metadata?.tableName || 'Table'} Assistance</h3>
             <p className="text-sm font-bold text-slate-400 mt-2">Requesting {activeWaiterCall.metadata?.type || 'Help'}</p>
             <div className="mt-8 space-y-3">
               <button onClick={async () => {
                 try {
                   await api.post(`/public/${business?.slug}/waiter-call/acknowledge`, { sessionId: activeWaiterCall.metadata?.sessionId, tableId: activeWaiterCall.metadata?.tableId });
                   setActiveWaiterCall(null);
                   setNotifications(prev => prev.filter(n => n.id !== activeWaiterCall.id));
                 } catch (err) { console.error(err); setActiveWaiterCall(null); }
               }} className="w-full h-12 bg-blue-600 text-white font-black rounded-xl">ACKNOWLEDGE</button>
               <button onClick={() => setActiveWaiterCall(null)} className="w-full h-12 bg-slate-800 text-slate-400 font-bold rounded-xl">DISMISS</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('accessToken'));
  const [mustChangePassword, setMustChangePassword] = useState(() => localStorage.getItem('mustChangePassword') === '1');
  const role = normalizeDashboardRole(localStorage.getItem('userRole'));
  const clerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

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
      <Route path="/admin" element={withScreenFallback(<Admin />, 'Loading admin tools...')} />
      <Route path="/sso-callback" element={clerkConfigured ? <AuthenticateWithRedirectCallback /> : <Navigate to="/login" replace />} />
      <Route path="/auth/finalize" element={clerkConfigured ? withScreenFallback(<ClerkFinalizePage onLogin={handleLogin} />, 'Completing access...') : <Navigate to="/login" replace />} />
      <Route path="/" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : <MarketingHomeRoute />} />
      <Route path="/product" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : <MarketingProductRoute />} />
      <Route path="/setup-flow" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : <MarketingSetupFlowRoute />} />
      <Route path="/billing" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : <MarketingBillingRoute />} />
      <Route path="/demo" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : <MarketingDemoRoute />} />
      <Route path="/contact" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : <MarketingContactRoute />} />
      <Route path="/privacy" element={<MarketingPrivacyRoute />} />
      <Route path="/terms" element={<MarketingTermsRoute />} />
      <Route path="/login" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : withScreenFallback(<LoginPage onLogin={handleLogin} />, 'Loading login...')} />
      <Route path="/signup" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : withScreenFallback(<SignupPage onLogin={handleLogin} />, 'Loading signup...')} />
      <Route path="/setup" element={!isLoggedIn ? <Navigate to="/login" replace /> : FULL_ACCESS_ROLES.has(role) ? withScreenFallback(<Onboarding nextPath={role === 'OWNER' && mustChangePassword ? '/security-setup' : getDefaultRouteForRole(role)} />) : <Navigate to={getDefaultRouteForRole(role)} replace />} />
      <Route path="/security-setup" element={!isLoggedIn ? <Navigate to="/login" replace /> : role === 'OWNER' && mustChangePassword ? <FirstLoginPasswordGate onCompleted={() => setMustChangePassword(false)} onLogout={handleLogout} /> : <PostLoginRedirect mustChangePassword={false} />} />
      <Route path="/app/*" element={!isLoggedIn ? <Navigate to="/login" replace /> : <DashboardShell />} />
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
