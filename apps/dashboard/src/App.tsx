import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { MenuBuilder } from './pages/MenuBuilder'
import { FloorPlan } from './pages/FloorPlan'
import { Orders } from './pages/Orders'
import { Analytics } from './pages/Analytics'
import { Settings } from './pages/Settings'
import { Onboarding } from './pages/Onboarding'
import { Billing } from './pages/Billing'
import { Admin } from './pages/Admin'
import { WaiterPage } from './pages/WaiterPage'
import {
  LayoutDashboard, UtensilsCrossed, Receipt, CreditCard, LogIn,
  BarChart3, Settings2, ChevronRight, Store, Loader2
} from 'lucide-react'
import { useQueries } from '@tanstack/react-query'
import { api } from './lib/api'
import { useEffect, useState } from 'react'

/* ─── Login Page ──────────────────────────────────────────── */
function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('userRole', res.data.user.role);
      onLogin();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative overflow-hidden px-16 py-12"
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 30% 70%, rgba(99,102,241,0.3) 0%, transparent 60%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 80% 20%, rgba(16,185,129,0.15) 0%, transparent 50%)' }} />
        
        <div className="relative z-10 text-white text-center">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-3xl flex items-center justify-center mx-auto mb-8 float border border-white/20">
            <UtensilsCrossed size={36} className="text-white" />
          </div>
          <h1 className="text-5xl font-black tracking-tight mb-3" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
            RestoFlow
          </h1>
          <p className="text-blue-200 text-lg font-medium mb-12">The modern restaurant OS</p>

          <div className="space-y-4 text-left w-full max-w-sm">
            {[
              { icon: '🍽️', title: 'Table Session Management', desc: 'Intelligent open-ticket system' },
              { icon: '📊', title: 'Real-time order pipeline', desc: 'CRM-grade live operations' },
              { icon: '🧾', title: 'GST-compliant billing', desc: 'Auto calculator with CGST/SGST' },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
                <span className="text-2xl mt-0.5">{f.icon}</span>
                <div>
                  <p className="font-bold text-white text-sm">{f.title}</p>
                  <p className="text-blue-200 text-xs mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-950">
        <div className={`w-full max-w-md ${shake ? 'animate-[shake_0.4s_ease]' : ''}`}>
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <UtensilsCrossed size={20} className="text-white" />
            </div>
            <span className="text-white font-black text-xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>RestoFlow</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
            <h2 className="text-2xl font-black text-white mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Sign in
            </h2>
            <p className="text-slate-400 text-sm mb-8">Access your vendor dashboard</p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm font-medium mb-6 flex items-center gap-2 fade-in">
                <span>⚠</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Email Address</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
                  placeholder="owner@restaurant.com"
                  className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 px-4 py-3.5 rounded-xl font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 px-4 py-3.5 rounded-xl font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              <div className="bg-slate-800 rounded-xl p-3 text-xs text-slate-400">
                <p className="font-bold text-slate-300 mb-0.5">Demo Credentials</p>
                <p>Email: <span className="text-blue-400 font-mono">owner@dineflow.demo</span></p>
                <p>Password: <span className="text-blue-400 font-mono">demo1234</span></p>
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/30 active:scale-[0.98] mt-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                {loading ? 'Signing In...' : 'Sign In to Dashboard'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}

/* ─── Dashboard Shell with Sidebar ───────────────────────── */
function DashboardShell() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [liveOrderCount, setLiveOrderCount] = useState(0);

  const [businessQuery, billingQuery] = useQueries({
    queries: [
      { queryKey: ['settings-business'], queryFn: async () => (await api.get('/settings/business')).data, retry: false, staleTime: 1000 * 30 },
      { queryKey: ['billing-summary'], queryFn: async () => (await api.get('/billing')).data, retry: false, staleTime: 1000 * 30 },
    ],
  });

  const business = businessQuery.data;
  const billing = billingQuery.data;
  const isLoading = businessQuery.isLoading || billingQuery.isLoading;

  useEffect(() => {
    api.get('/orders').then(r => setLiveOrderCount(Array.isArray(r.data) ? r.data.length : 0)).catch(() => {});
  }, [location.pathname]);

  const role = localStorage.getItem('userRole');

  if (isLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={32} className="text-blue-500 animate-spin" />
        <p className="text-slate-400 text-sm font-medium">Syncing profile...</p>
      </div>
    </div>
  );

  if (business?.onboardingCompleted === false && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  if (business?.onboardingCompleted === true && location.pathname === '/onboarding') return <Navigate to="/" replace />;
  
  // Waiter Redirect Logic
  if (role === 'WAITER' && location.pathname !== '/waiter') return <Navigate to="/waiter" replace />;
  if (role === 'WAITER' && location.pathname === '/waiter') return <WaiterPage />;
  if (role !== 'WAITER' && location.pathname === '/waiter') return <Navigate to="/" replace />;

  if (location.pathname === '/onboarding') return <Onboarding />;

  const navItems = [
    { to: '/', label: 'Menu', icon: <UtensilsCrossed size={18} /> },
    { to: '/tables', label: 'Tables & QR', icon: <LayoutDashboard size={18} /> },
    { to: '/orders', label: 'Live Orders', icon: <Receipt size={18} />, badge: liveOrderCount },
    { to: '/billing', label: 'Billing', icon: <CreditCard size={18} /> },
    { to: '/analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
    { to: '/settings', label: 'Settings', icon: <Settings2 size={18} /> },
  ];

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex font-sans text-gray-900">
      {/* ── Sidebar ── */}
      <aside className={`flex-shrink-0 h-screen sticky top-0 bg-slate-900 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-[68px]' : 'w-[228px]'}`}>
        {/* Logo */}
        <div className="px-4 py-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <UtensilsCrossed size={16} className="text-white" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-black text-white text-lg tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              RestoFlow
            </span>
          )}
        </div>

        {/* Restaurant info */}
        {!sidebarCollapsed && business?.businessName && (
          <div className="px-4 py-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Store size={13} className="text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{business.businessName}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{billing?.plan || 'Free'} plan</p>
              </div>
            </div>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon, badge }) => {
            const active = location.pathname === to;
            return (
              <Link key={to} to={to}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative group ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-1 ring-blue-300/40'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex-shrink-0 relative">
                  {icon}
                  {active && <span className="absolute -inset-1.5 rounded-lg bg-blue-400/25 blur-sm -z-10" />}
                </span>
                {!sidebarCollapsed && <span className="truncate">{label}</span>}
                {badge != null && badge > 0 && (
                  <span className={`ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
                    {badge}
                  </span>
                )}
                {sidebarCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-slate-700 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    {label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle + Logout */}
        <div className="p-2 border-t border-slate-800 space-y-1">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800 text-sm font-medium transition-all relative group"
          >
            <ChevronRight size={18} className={`transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
            {!sidebarCollapsed && <span>Collapse</span>}
            {sidebarCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-slate-700 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Expand Sidebar
              </div>
            )}
          </button>
          <button
            onClick={() => { localStorage.removeItem('accessToken'); window.location.reload(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 text-sm font-medium transition-all"
          >
            <LogIn size={18} className="rotate-180" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Routes>
          <Route path="/" element={<MenuBuilder />} />
          <Route path="/tables" element={<FloorPlan />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/waiter" element={<WaiterPage />} />
        </Routes>
      </main>
    </div>
  );
}

/* ─── Root App ─────────────────────────────────────────────── */
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('accessToken'));
  if (window.location.pathname === '/admin') return <Admin />;
  if (!isLoggedIn) return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  return <DashboardShell />;
}

export default App
