import { Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom'
import { MenuBuilder } from './pages/MenuBuilder'
import { FloorPlan } from './pages/FloorPlan'
import { Orders } from './pages/Orders'
import { Analytics } from './pages/Analytics'
import { Settings } from './pages/Settings'
import { Onboarding } from './pages/Onboarding'
import { Billing } from './pages/Billing'
import { Admin } from './pages/Admin'
import { LayoutDashboard, UtensilsCrossed, Receipt, CreditCard, LogIn } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from './lib/api'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, UserCircle2 } from 'lucide-react'

// Simple login gate for the dashboard prototype
function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('accessToken', res.data.accessToken);
      onLogin();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-blue-600 p-8 text-white">
          <h1 className="text-3xl font-black tracking-tighter">RESTOFLOW</h1>
          <p className="opacity-80 mt-1 font-medium">Sign in to your vendor dashboard</p>
        </div>
        <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-5">
          {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm font-semibold border border-red-100">{error}</div>}
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full border-2 border-gray-200 p-3.5 rounded-xl font-medium focus:border-blue-600 outline-none transition-colors"
              placeholder="owner@restaurant.com" autoFocus />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full border-2 border-gray-200 p-3.5 rounded-xl font-medium focus:border-blue-600 outline-none transition-colors" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 hover:bg-blue-700 disabled:opacity-60 mt-2 transition-all shadow-md active:scale-[0.98]">
            <LogIn size={20} /> {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

function DashboardShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const { data: business, isLoading } = useQuery({
    queryKey: ['settings-business'],
    queryFn: async () => (await api.get('/settings/business')).data,
    retry: false
  });
  const { data: billing } = useQuery({
    queryKey: ['billing-summary'],
    queryFn: async () => (await api.get('/billing')).data,
    retry: false
  });

  useEffect(() => {
    const closeOnOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, []);

  if (isLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold text-gray-400">Loading Configuration...</div>;

  // Protect routes based on onboarding status
  if (business?.onboardingCompleted === false && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Prevent accessing onboarding if completed
  if (business?.onboardingCompleted === true && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />;
  }

  // Render just onboarding if matching
  if (location.pathname === '/onboarding') {
    return <Onboarding />;
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col font-sans text-gray-900">
      <header className="bg-white border-b px-8 py-5 flex items-center justify-between shadow-sm relative z-10">
        <h1 className="text-2xl font-black tracking-tighter text-blue-600 flex items-center gap-2">
          RESTOFLOW <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest translate-y-[-2px]">Vendor</span>
        </h1>
        <div className="flex gap-6">
          {[
            { to: '/', label: 'Menus', icon: <UtensilsCrossed size={18} strokeWidth={2.5} /> },
            { to: '/tables', label: 'Tables & QR', icon: <LayoutDashboard size={18} strokeWidth={2.5} /> },
            { to: '/orders', label: 'Live Orders', icon: <Receipt size={18} strokeWidth={2.5} /> },
            { to: '/billing', label: 'Billing', icon: <CreditCard size={18} strokeWidth={2.5} /> },
          ].map(({ to, label, icon }) => (
            <Link key={to} to={to} className={`flex items-center gap-2 text-sm font-bold transition-all relative ${location.pathname === to ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}>
              {icon} {label}
              {location.pathname === to && <div className="absolute -bottom-[22px] left-0 right-0 h-1 bg-blue-600 rounded-t-full"></div>}
            </Link>
          ))}
        </div>
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((prev) => !prev)}
            className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl transition-colors"
          >
            <UserCircle2 size={16} />
            <span className="text-sm font-bold">Profile</span>
            <ChevronDown size={14} className={`transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl p-1 z-50">
              <button
                onClick={() => {
                  setProfileOpen(false);
                  navigate('/settings');
                }}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
              >
                Settings
              </button>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  navigate('/analytics');
                }}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
              >
                Analytics
              </button>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  navigate('/billing');
                }}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
              >
                Bill Counter
              </button>
              <div className="px-3 py-2.5 text-sm font-semibold text-gray-500 bg-gray-50 rounded-lg">
                Subscription: {billing?.plan || 'FREE'}
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem('accessToken');
                  window.location.reload();
                }}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
        <Routes>
          <Route path="/" element={<MenuBuilder />} />
          <Route path="/tables" element={<FloorPlan />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/billing" element={<Billing />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('accessToken'));

  // Root commander pipeline completely bypassing tenant bounds naturally over local port checks.
  if (window.location.pathname === '/admin') {
    return <Admin />;
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  return <DashboardShell />;
}

export default App
