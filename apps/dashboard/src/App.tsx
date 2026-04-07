import { Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
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
import { VendorTopNav } from './components/VendorTopNav';
import { api } from './lib/api';

type DashboardRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN' | 'WAITER' | 'UNKNOWN';

const FULL_ACCESS_ROLES = new Set<DashboardRole>(['OWNER', 'MANAGER']);
const ORDERS_ACCESS_ROLES = new Set<DashboardRole>(['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN']);
const BILLING_ACCESS_ROLES = new Set<DashboardRole>(['OWNER', 'MANAGER', 'CASHIER']);
const BUSINESS_READ_ROLES = new Set<DashboardRole>(['OWNER', 'MANAGER', 'CASHIER']);

type DemoStep = {
  title: string;
  summary: string;
  actionLabel: string;
  route: string;
  checklist: string[];
};

const DASHBOARD_DEMO_STEPS: DemoStep[] = [
  {
    title: 'Menu Management',
    summary: 'Create categories and menu items here. This is the source of truth for what guests can order.',
    actionLabel: 'Menu',
    route: '/app',
    checklist: [
      'Add categories like Starters, Mains, and Desserts.',
      'Create items, set prices, and keep descriptions up to date.',
      'Use View Live Site to preview how customers will see your menu.',
    ],
  },
  {
    title: 'Tables & QR Setup',
    summary: 'Design your floor layout and generate tables linked to QR ordering.',
    actionLabel: 'Tables & QR',
    route: '/app/tables',
    checklist: [
      'Create zones and place tables where they belong.',
      'Track table statuses: available, occupied, reserved, or cleaning.',
      'Use QR links so guests can start sessions directly from their table.',
    ],
  },
  {
    title: 'Live Orders Pipeline',
    summary: 'Monitor incoming orders in real time and move them through kitchen and service stages.',
    actionLabel: 'Live Orders',
    route: '/app/orders',
    checklist: [
      'Watch orders appear instantly as guests place them.',
      'Update status to keep kitchen and service teams synced.',
      'Handle waiter calls and close sessions once service is complete.',
    ],
  },
  {
    title: 'Billing & Invoices',
    summary: 'Finalize completed sessions, collect payments, and generate invoices.',
    actionLabel: 'Billing',
    route: '/app/billing',
    checklist: [
      'Review completed orders with tax and discount totals.',
      'Print or download invoices when needed.',
      'Split bills and mark payments to close the loop quickly.',
    ],
  },
  {
    title: 'Analytics Insights',
    summary: 'Understand revenue trends, peak hours, and top-performing items.',
    actionLabel: 'Analytics',
    route: '/app/analytics',
    checklist: [
      'Choose a date range to compare business performance.',
      'Track conversion and order volume to spot bottlenecks.',
      'Export data when you need reporting outside the dashboard.',
    ],
  },
  {
    title: 'Settings & Team Controls',
    summary: 'Manage business profile, team accounts, and operational defaults.',
    actionLabel: 'Settings',
    route: '/app/settings',
    checklist: [
      'Update restaurant details and customer-facing settings.',
      'Add staff members and assign roles safely.',
      'Adjust system options as your operations grow.',
    ],
  },
  {
    title: 'Daily Workflow',
    summary: 'Most teams run this loop: update menu, monitor live orders, then settle billing and review analytics.',
    actionLabel: 'Live Orders',
    route: '/app/orders',
    checklist: [
      "Start by confirming today's menu and table readiness.",
      'Keep the Orders view open during service for real-time control.',
      'Close the day with billing checks and analytics review.',
    ],
  },
];

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
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [liveOrderCount, setLiveOrderCount] = useState(0);
  const [showFirstTimeDemo, setShowFirstTimeDemo] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const role = normalizeDashboardRole(localStorage.getItem('userRole'));
  const defaultRoute = getDefaultRouteForRole(role);
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
  const activeDemoStep = DASHBOARD_DEMO_STEPS[demoStep];
  const isLastDemoStep = demoStep === DASHBOARD_DEMO_STEPS.length - 1;

  useEffect(() => {
    if (!canAccessOrders) {
      setLiveOrderCount(0);
      return;
    }
    api.get('/orders').then((r) => setLiveOrderCount(Array.isArray(r.data) ? r.data.length : 0)).catch(() => {});
  }, [canAccessOrders, location.pathname]);

  useEffect(() => {
    if (isLoading || showFirstTimeDemo) return;
    if (!canShowFirstTimeDemo || !business || needsWorkspaceSetup(business)) return;
    const hasSeenDemo = localStorage.getItem(demoStorageKey) === '1';
    if (hasSeenDemo) return;
    setShowFirstTimeDemo(true);
    setDemoStep(0);
  }, [business, canShowFirstTimeDemo, demoStorageKey, isLoading, showFirstTimeDemo]);

  const finishDemo = () => {
    localStorage.setItem(demoStorageKey, '1');
    setShowFirstTimeDemo(false);
  };

  const goToPreviousDemoStep = () => {
    setDemoStep((prev) => Math.max(prev - 1, 0));
  };

  const goToNextDemoStep = () => {
    if (isLastDemoStep) {
      finishDemo();
      return;
    }
    setDemoStep((prev) => Math.min(prev + 1, DASHBOARD_DEMO_STEPS.length - 1));
  };

  const openDemoSection = () => {
    if (!activeDemoStep) return;
    if (location.pathname !== activeDemoStep.route) {
      navigate(activeDemoStep.route);
    }
  };

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
    ...(canAccessMenu ? ['/app'] : []),
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
    ...(canAccessMenu ? [{ to: '/app', label: 'Menu', icon: <UtensilsCrossed size={18} /> }] : []),
    ...(canAccessTables ? [{ to: '/app/tables', label: 'Tables & QR', icon: <LayoutDashboard size={18} /> }] : []),
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

        {!sidebarCollapsed && business?.businessName && (
          <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <Store size={14} className="text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: 'var(--text-1)' }}>{business.businessName}</p>
                <p className="text-[10px] uppercase tracking-widest font-semibold mt-0.5" style={{ color: 'var(--text-3)' }}>{billing?.plan || 'Free'} plan</p>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {navItems.map(({ to, label, icon, badge }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
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
            onLogout={logoutAndReload}
          />
        </div>

        <div className="min-h-0 flex-1 px-2 pb-2 pt-2 sm:px-3 sm:pb-3 lg:px-5 lg:pb-5">
          <DashboardErrorBoundary>
            <Routes>
              {canAccessMenu && <Route index element={<MenuBuilder />} />}
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

      {showFirstTimeDemo && activeDemoStep && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="bg-slate-900 px-6 py-5 text-white">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-300">First-Time Demo</p>
              <h3 className="mt-1 text-2xl font-black tracking-tight">How RestoFlow Works</h3>
              <p className="mt-2 text-sm text-slate-300">
                Step {demoStep + 1} of {DASHBOARD_DEMO_STEPS.length}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {DASHBOARD_DEMO_STEPS.map((stepItem, index) => (
                  <span
                    key={stepItem.title}
                    className={`h-1.5 min-w-[28px] flex-1 rounded-full ${index <= demoStep ? 'bg-blue-400' : 'bg-slate-700'}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div>
                <h4 className="text-xl font-black text-slate-900">{activeDemoStep.title}</h4>
                <p className="mt-1 text-sm font-medium text-slate-600">{activeDemoStep.summary}</p>
              </div>

              <ul className="space-y-2">
                {activeDemoStep.checklist.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <button
                  onClick={finishDemo}
                  className="text-sm font-bold text-slate-500 transition-colors hover:text-slate-800"
                >
                  Skip Demo
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={goToPreviousDemoStep}
                    disabled={demoStep === 0}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={openDemoSection}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    Open {activeDemoStep.actionLabel}
                  </button>
                  <button
                    onClick={goToNextDemoStep}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                  >
                    {isLastDemoStep ? 'Finish Demo' : 'Next'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
