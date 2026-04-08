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
} from 'lucide-react';
import { MenuBuilder } from './pages/MenuBuilder';
import { FloorPlan } from './pages/FloorPlan';
import { Orders } from './pages/Orders';
import { DashboardOverview } from './pages/DashboardOverview';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { Onboarding } from './pages/Onboarding';
import { Billing } from './pages/Billing';
import { Admin } from './pages/Admin';
import { WaiterPage } from './pages/WaiterPage';
import { FirstLoginPasswordGate } from './components/FirstLoginPasswordGate';
import { AuthIndexPage } from './pages/AuthIndexPage';
import { AuthContactPage } from './pages/AuthContactPage';
import { AuthLaunch45Page } from './pages/AuthLaunch45Page';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardErrorBoundary } from './components/DashboardErrorBoundary';
import { VendorTopNav, type OpsNotification } from './components/VendorTopNav';
import { useRealtimeSocket } from './hooks/useRealtimeSocket';
import { api } from './lib/api';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

type DashboardRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN' | 'WAITER' | 'UNKNOWN';

const FULL_ACCESS_ROLES = new Set<DashboardRole>(['OWNER', 'MANAGER']);
const ORDERS_ACCESS_ROLES = new Set<DashboardRole>(['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN']);
const BILLING_ACCESS_ROLES = new Set<DashboardRole>(['OWNER', 'MANAGER', 'CASHIER']);
const BUSINESS_READ_ROLES = new Set<DashboardRole>(['OWNER', 'MANAGER', 'CASHIER']);

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

function clearLocalAuthStorage() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('userRole');
  localStorage.removeItem('mustChangePassword');
}

function logoutAndReload() {
  clearLocalAuthStorage();
  const clerk = (globalThis as any).Clerk;
  if (clerk?.signOut) {
    void Promise.resolve(clerk.signOut()).finally(() => window.location.reload());
    return;
  }
  window.location.reload();
}

function ScreenLoader({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={30} className="animate-spin text-blue-500" />
        <p className="text-sm font-medium text-slate-400">{message}</p>
      </div>
    </div>
  );
}

function MarketingHomeRoute() {
  const navigate = useNavigate();
  return (
    <AuthIndexPage
      onLoginClick={() => navigate('/login')}
      onSignupClick={() => navigate('/signup')}
      onContactClick={() => navigate('/contact')}
      onLaunchClick={() => navigate('/launch-plan')}
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

function MarketingLaunchRoute() {
  const navigate = useNavigate();
  return (
    <AuthLaunch45Page
      onBackHome={() => navigate('/')}
      onLoginClick={() => navigate('/login')}
      onContactClick={() => navigate('/contact')}
      onSignupClick={() => navigate('/signup')}
    />
  );
}

function PostLoginRedirect({ mustChangePassword }: { mustChangePassword: boolean }) {
  const role = normalizeDashboardRole(localStorage.getItem('userRole'));
  const shouldCheckWorkspace = FULL_ACCESS_ROLES.has(role);

  const { data: business, isLoading } = useQuery({
    queryKey: ['post-login-business'],
    queryFn: async () => (await api.get('/settings/business')).data,
    retry: false,
    staleTime: 1000 * 30,
    enabled: shouldCheckWorkspace,
  });

  if (role === 'UNKNOWN') {
    clearLocalAuthStorage();
    return <Navigate to="/login" replace />;
  }

  if (shouldCheckWorkspace && isLoading) {
    return <ScreenLoader message="Preparing your workspace..." />;
  }

  if (shouldCheckWorkspace && business && needsWorkspaceSetup(business)) {
    return <Navigate to="/setup" replace />;
  }

  if (mustChangePassword) {
    return <Navigate to="/security-setup" replace />;
  }

  return <Navigate to={getDefaultRouteForRole(role)} replace />;
}

function DashboardShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [liveOrderCount, setLiveOrderCount] = useState(0);
  const [showFirstTimeDemo, setShowFirstTimeDemo] = useState(false);
  const [notifications, setNotifications] = useState<OpsNotification[]>([]);
  const [notificationsHydrated, setNotificationsHydrated] = useState(false);
  const role = normalizeDashboardRole(localStorage.getItem('userRole'));
  const defaultRoute = getDefaultRouteForRole(role);
  const canAccessDashboard = FULL_ACCESS_ROLES.has(role);
  const canAccessMenu = FULL_ACCESS_ROLES.has(role);
  const canAccessTables = FULL_ACCESS_ROLES.has(role);
  const canAccessOrders = ORDERS_ACCESS_ROLES.has(role);
  const canAccessBilling = BILLING_ACCESS_ROLES.has(role);
  const canAccessAnalytics = FULL_ACCESS_ROLES.has(role);
  const canAccessSettings = FULL_ACCESS_ROLES.has(role);
  const canShowFirstTimeDemo = FULL_ACCESS_ROLES.has(role);
  const canShowAdminShellData = BUSINESS_READ_ROLES.has(role);

  const [businessQuery, billingQuery] = useQueries({
    queries: [
      {
        queryKey: ['settings-business'],
        queryFn: async () => (await api.get('/settings/business')).data,
        retry: false,
        staleTime: 1000 * 30,
        enabled: canShowAdminShellData,
      },
      {
        queryKey: ['billing-summary'],
        queryFn: async () => (await api.get('/billing')).data,
        retry: false,
        staleTime: 1000 * 30,
        enabled: canShowAdminShellData,
      },
    ],
  });

  const business = businessQuery.data;
  const billing = billingQuery.data;
  const isLoading = canShowAdminShellData && (businessQuery.isLoading || billingQuery.isLoading);
  const demoStorageKey = getDemoStorageKey(business);
  const notificationStorageKey = useMemo(() => getDemoStorageKey(business).replace('demo_seen', 'notifications'), [business]);

  const refreshLiveOrderCount = useCallback(async () => {
    if (!canAccessOrders) {
      setLiveOrderCount(0);
      return;
    }
    try {
      const response = await api.get('/orders');
      setLiveOrderCount(Array.isArray(response.data) ? response.data.length : 0);
    } catch {
      setLiveOrderCount(0);
    }
  }, [canAccessOrders]);

  const pushNotification = useCallback(
    (entry: Omit<OpsNotification, 'id' | 'read' | 'createdAt'> & { createdAt?: string }) => {
      setNotifications((previous) => {
        const next: OpsNotification = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          title: entry.title,
          message: entry.message,
          level: entry.level,
          createdAt: entry.createdAt || new Date().toISOString(),
          read: false,
        };
        return [next, ...previous].slice(0, 60);
      });
    },
    [],
  );

  const unreadNotificationCount = useMemo(
    () => notifications.reduce((total, notification) => total + (notification.read ? 0 : 1), 0),
    [notifications],
  );

  const markNotificationsRead = useCallback(() => {
    setNotifications((previous) => previous.map((notification) => ({ ...notification, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(notificationStorageKey);
      if (!raw) {
        setNotifications([]);
        setNotificationsHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setNotifications([]);
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
      setNotifications([]);
      setNotificationsHydrated(true);
    }
  }, [notificationStorageKey]);

  useEffect(() => {
    if (!notificationsHydrated) return;
    localStorage.setItem(notificationStorageKey, JSON.stringify(notifications.slice(0, 60)));
  }, [notificationStorageKey, notifications, notificationsHydrated]);

  const realtimeHandlers = useMemo(
    () => ({
      'order:new': (order: any) => {
        queryClient.invalidateQueries({ queryKey: ['live-orders'] });
        void refreshLiveOrderCount();
        pushNotification({
          title: 'New Order',
          message: `${order?.table?.name ? `Table ${order.table.name}` : 'Takeaway'} placed ${order?.orderNumber || `#${String(order?.id || '').slice(-6)}`}`,
          level: 'warning',
        });
      },
      'order:update': (order: any) => {
        const status = String(order?.status || '').toUpperCase();
        queryClient.invalidateQueries({ queryKey: ['live-orders'] });
        queryClient.invalidateQueries({ queryKey: ['order-history'] });
        queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
        void refreshLiveOrderCount();

        if (status === 'READY') {
          pushNotification({
            title: 'Food Ready',
            message: `${order?.orderNumber || `#${String(order?.id || '').slice(-6)}`} is ready for service.`,
            level: 'success',
          });
          return;
        }
        if (status === 'SERVED') {
          pushNotification({
            title: 'Food Served',
            message: `${order?.orderNumber || `#${String(order?.id || '').slice(-6)}`} has been served.`,
            level: 'info',
          });
          return;
        }
        if (status === 'CANCELLED') {
          pushNotification({
            title: 'Order Cancelled',
            message: `${order?.orderNumber || `#${String(order?.id || '').slice(-6)}`} was cancelled.`,
            level: 'warning',
          });
        }
      },
      'orders:bulk_status': () => {
        queryClient.invalidateQueries({ queryKey: ['live-orders'] });
        queryClient.invalidateQueries({ queryKey: ['order-history'] });
        queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
        void refreshLiveOrderCount();
      },
      'waiter:call': (call: any) => {
        const callType = String(call?.type || 'WAITER').toUpperCase();
        const tableName = call?.tableName ? `Table ${call.tableName}` : 'A table';
        if (callType === 'BILL') {
          pushNotification({
            title: 'Bill Request',
            message: `${tableName} asked for billing.`,
            level: 'warning',
          });
          return;
        }
        if (callType === 'HELP') {
          pushNotification({
            title: 'Help Request',
            message: `${tableName} requested staff assistance.`,
            level: 'warning',
          });
          return;
        }
        pushNotification({
          title: 'Water Call',
          message: `${tableName} requested water or waiter attention.`,
          level: 'info',
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
    enabled: canAccessOrders && role !== 'WAITER',
    handlers: realtimeHandlers,
    onReconnect: () => {
      queryClient.invalidateQueries({ queryKey: ['live-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-history'] });
      queryClient.invalidateQueries({ queryKey: ['zones-overview'] });
      void refreshLiveOrderCount();
    },
  });

  useEffect(() => {
    void refreshLiveOrderCount();
  }, [location.pathname, refreshLiveOrderCount]);

  useEffect(() => {
    if (isLoading || showFirstTimeDemo) return;
    if (!canShowFirstTimeDemo || !business || needsWorkspaceSetup(business)) return;
    const hasSeenDemo = localStorage.getItem(demoStorageKey) === '1';
    if (hasSeenDemo) return;
    setShowFirstTimeDemo(true);

    const driverObj = driver({
      showProgress: true,
      steps: [
        { popover: { title: 'Welcome to RestoFlow', description: 'Let us take a quick tour of your workspace. Click Next to begin.' }},
        { element: '#nav-menu', onHighlightStarted: () => navigate('/app/menu'), popover: { title: 'Menu Studio', description: 'Create and organize your digital menu. Add categories, items with photos, and customization options that sync instantly to your shop.', side: "right", align: 'start' }},
        { element: '#nav-tables-qr', onHighlightStarted: () => navigate('/app/tables'), popover: { title: 'Tables & QR Design', description: 'Map out your physical restaurant layout and generate secure QR codes for દરેક table to enable instant checkout.', side: "right", align: 'start' }},
        { element: '#nav-live-orders', onHighlightStarted: () => navigate('/app/orders'), popover: { title: 'Real-time Order Track', description: 'Manage the flow of orders from placement to service. Track kitchen status and keep staff updated in real time.', side: "right", align: 'start' }},
        { element: '#nav-billing', onHighlightStarted: () => navigate('/app/billing'), popover: { title: 'Billing & Checkout', description: 'Manage payments, print invoices, and close dining sessions once customers are ready to pay.', side: "right", align: 'start' }},
        { element: '#nav-analytics', onHighlightStarted: () => navigate('/app/analytics'), popover: { title: 'Business Insights', description: 'View heatmaps of your best days, track revenue at a glance, and understand which menu items are your top sellers.', side: "right", align: 'start' }},
        { element: '#nav-settings', onHighlightStarted: () => navigate('/app/settings'), popover: { title: 'Operational Settings', description: 'Configure business hours, printer settings, and manage your team roles and permissions.', side: "right", align: 'start' }},
        { popover: { title: 'You are all set!', description: 'Explore the dashboard on your own. You can update your settings at any time.' }},
      ],
      onDestroyStarted: () => {
        if (!driverObj.hasNextStep() || confirm("Are you sure you want to skip the tour?")) {
           driverObj.destroy();
           localStorage.setItem(demoStorageKey, '1');
        }
      }
    });

    driverObj.drive();

  }, [business, canShowFirstTimeDemo, demoStorageKey, isLoading, showFirstTimeDemo]);

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

  if (canShowAdminShellData && business && needsWorkspaceSetup(business)) {
    return <Navigate to="/setup" replace />;
  }

  if (role === 'WAITER' && location.pathname !== '/app/waiter') {
    return <Navigate to="/app/waiter" replace />;
  }
  if (role === 'WAITER' && location.pathname === '/app/waiter') {
    return <WaiterPage />;
  }
  if (role !== 'WAITER' && location.pathname === '/app/waiter') {
    return <Navigate to={defaultRoute} replace />;
  }

  const allowedPaths = new Set<string>([
    ...(canAccessDashboard ? ['/app'] : []),
    ...(canAccessMenu ? ['/app/menu'] : []),
    ...(canAccessTables ? ['/app/tables'] : []),
    ...(canAccessOrders ? ['/app/orders'] : []),
    ...(canAccessBilling ? ['/app/billing'] : []),
    ...(canAccessAnalytics ? ['/app/analytics'] : []),
    ...(canAccessSettings ? ['/app/settings'] : []),
  ]);

  if (!allowedPaths.has(location.pathname)) {
    return <Navigate to={defaultRoute} replace />;
  }

  const navItems = [
    ...(canAccessDashboard ? [{ to: '/app', label: 'Dashboard', icon: <LayoutDashboard size={18} /> }] : []),
    ...(canAccessMenu ? [{ to: '/app/menu', label: 'Menu', icon: <UtensilsCrossed size={18} /> }] : []),
    ...(canAccessTables ? [{ to: '/app/tables', label: 'Tables & QR', icon: <Store size={18} /> }] : []),
    ...(canAccessOrders ? [{ to: '/app/orders', label: 'Live Orders', icon: <Receipt size={18} />, badge: liveOrderCount }] : []),
    ...(canAccessBilling ? [{ to: '/app/billing', label: 'Billing', icon: <CreditCard size={18} /> }] : []),
    ...(canAccessAnalytics ? [{ to: '/app/analytics', label: 'Analytics', icon: <BarChart3 size={18} /> }] : []),
    ...(canAccessSettings ? [{ to: '/app/settings', label: 'Settings', icon: <Settings2 size={18} /> }] : []),
  ];

  return (
    <div className="h-screen overflow-hidden flex font-sans selection:bg-blue-500/30" style={{ background: 'var(--shell-bg)', color: 'var(--text-1)' }}>
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: 'var(--shell-gradient)' }} />
      <aside className={`relative z-10 flex-shrink-0 h-screen sticky top-0 backdrop-blur-xl flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-[68px]' : 'w-[240px]'}`} style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}>
        <div className="px-4 py-6 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(37,99,235,0.4)]" style={{ background: 'var(--sidebar-logo-bg)' }}>
            <UtensilsCrossed size={16} className="text-white" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-black text-lg tracking-tight" style={{ color: 'var(--text-1)', fontFamily: 'Inter, sans-serif' }}>
              RestoFlow
            </span>
          )}
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {navItems.map(({ to, label, icon, badge }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                id={`nav-${label.toLowerCase().replace(/ & /g, '-').replace(' ', '-')}`}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative group border ${
                  active ? 'border-blue-500/20' : 'border-transparent'
                }`}
                style={{
                  background: active ? 'var(--sidebar-item-active-bg)' : undefined,
                  color: active ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--sidebar-item-hover-bg)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = ''; }}
              >
                <span className="flex-shrink-0 relative">
                  {icon}
                  {active && <span className="absolute -inset-1.5 rounded-lg bg-blue-400/25 blur-sm -z-10" />}
                </span>
                {!sidebarCollapsed && <span className="truncate">{label}</span>}
                {badge != null && badge > 0 && (
                  <span className="ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full bg-blue-500 text-white">
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
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ color: 'var(--text-3)' }}
          >
            <ChevronRight size={18} className={`transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
          <button
            onClick={() => {
              logoutAndReload();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400/80 hover:bg-red-500/10 hover:text-red-300 text-sm font-medium transition-all"
          >
            <LogIn size={18} className="rotate-180" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main className="relative z-10 flex-1 min-w-0 h-full overflow-hidden flex flex-col bg-transparent">
        <div className="flex-shrink-0 px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6 lg:pt-5">
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
              {canAccessAnalytics && <Route path="analytics" element={<Analytics />} />}
              {canAccessSettings && <Route path="settings" element={<Settings />} />}
              {canAccessBilling && <Route path="billing" element={<Billing />} />}
              {role === 'WAITER' && <Route path="waiter" element={<WaiterPage />} />}
              <Route path="*" element={<Navigate to={defaultRoute} replace />} />
            </Routes>
          </DashboardErrorBoundary>
        </div>
      </main>


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
    clearLocalAuthStorage();
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
      <Route path="/contact" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : <MarketingContactRoute />} />
      <Route path="/launch-plan" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : <MarketingLaunchRoute />} />
      <Route path="/login" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : <LoginPage onLogin={handleLogin} />} />
      <Route path="/signup" element={isLoggedIn ? <PostLoginRedirect mustChangePassword={mustChangePassword} /> : <SignupPage onLogin={handleLogin} />} />

      <Route
        path="/setup"
        element={
          !isLoggedIn ? (
            <Navigate to="/login" replace />
          ) : FULL_ACCESS_ROLES.has(role) ? (
            <Onboarding nextPath={mustChangePassword ? '/security-setup' : getDefaultRouteForRole(role)} />
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
          ) : mustChangePassword ? (
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

export default App;
