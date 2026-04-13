import { Routes, Route } from 'react-router-dom';
import { KitchenBoard } from './pages/KitchenBoard';
import { useEffect, useState } from 'react';
import { api } from './lib/api';
import { Loader2, LogIn, UtensilsCrossed } from 'lucide-react';

const KDS_ALLOWED_ROLES = new Set(['KITCHEN', 'MANAGER', 'OWNER']);

function normalizeRole(value: unknown) {
  return typeof value === 'string' ? value.toUpperCase() : '';
}

function KitchenLogin({
  onLogin,
  initialError = '',
}: {
  onLogin: () => void;
  initialError?: string;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(initialError);
  }, [initialError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/login', { email, password });
      const accessToken = res.data?.accessToken;
      const role = normalizeRole(res.data?.user?.role);
      const mustChangePassword = Boolean(res.data?.user?.mustChangePassword);

      if (!accessToken) {
        throw new Error('Missing access token');
      }

      if (mustChangePassword) {
        setError('First login password change is required in the vendor dashboard before KDS access.');
        return;
      }

      if (!KDS_ALLOWED_ROLES.has(role)) {
        setError('This account does not have Kitchen Display access.');
        return;
      }

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('userRole', role);
      onLogin();
    } catch (err: any) {
      const apiError =
        typeof err?.response?.data?.error === 'string'
          ? err.response.data.error.trim()
          : '';
      if (!err?.response) {
        const apiBase = String(api.defaults.baseURL || 'http://localhost:4000');
        setError(`Cannot reach API server (${apiBase}). Start backend and try again.`);
      } else if (err.response.status === 401 || err.response.status === 403) {
        setError(apiError || 'Login failed. Please check your credentials.');
      } else {
        setError(apiError || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <UtensilsCrossed size={20} className="text-white" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-black">RestoFlow</p>
            <h1 className="text-white text-lg font-black tracking-tight">Kitchen Display Login</h1>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-[0.14em] text-slate-400 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="staff@dineflow.demo"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-[0.14em] text-slate-400 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="********"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-400">
            <p className="font-bold text-slate-300">Demo Kitchen Login</p>
            <p>Email: <span className="font-mono text-blue-300">staff@dineflow.demo</span></p>
            <p>Password: <span className="font-mono text-blue-300">staff1234</span></p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold py-3.5 flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {loading ? 'Signing In...' : 'Sign In to KDS'}
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated'>(
    () => (localStorage.getItem('accessToken') ? 'checking' : 'unauthenticated')
  );
  const [authError, setAuthError] = useState('');

  const clearSession = (message = '') => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userRole');
    setAuthError(message);
    setAuthState('unauthenticated');
  };

  useEffect(() => {
    if (authState !== 'checking') return;

    let cancelled = false;

    const validateSession = async () => {
      try {
        const me = await api.get('/auth/me');
        const role = normalizeRole(me.data?.user?.role);

        if (!KDS_ALLOWED_ROLES.has(role)) {
          if (!cancelled) {
            clearSession('This account does not have Kitchen Display access.');
          }
          return;
        }

        localStorage.setItem('userRole', role);
        if (!cancelled) {
          setAuthError('');
          setAuthState('authenticated');
        }
      } catch {
        if (!cancelled) {
          clearSession('Session expired. Please sign in again.');
        }
      }
    };

    validateSession();

    return () => {
      cancelled = true;
    };
  }, [authState]);

  if (authState === 'checking') {
    return (
      <div className="min-h-[100dvh] bg-slate-950 text-slate-100 font-sans flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-400">
          <Loader2 size={18} className="animate-spin text-blue-400" />
          <span>Checking session...</span>
        </div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <div className="min-h-[100dvh] bg-slate-950 text-slate-100 font-sans">
        <KitchenLogin
          initialError={authError}
          onLogin={() => {
            setAuthError('');
            setAuthState('authenticated');
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-900 text-gray-100 font-sans">
      <Routes>
        <Route
          path="/"
          element={
            <KitchenBoard
              onLogout={() => {
                clearSession();
              }}
            />
          }
        />
      </Routes>
    </div>
  );
}

export default App;
