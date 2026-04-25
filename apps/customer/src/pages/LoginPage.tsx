import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, ChefHat, LockKeyhole, Phone, User, UserPlus } from 'lucide-react';
import { publicApi } from '../lib/api';
import { BrandLogo } from '../components/BrandLogo';
import { getActiveSessionForTenant, getTenantStorageItem, setCustomerAuthForTenant } from '../lib/tenantStorage';

type AuthMode = 'guest' | 'login' | 'signup';

export function LoginPage() {
  const { tenantSlug, tableId } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('guest');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const rememberKey = `rf_login_pref_${tenantSlug || 'default'}`;
  const activeSessionId = getActiveSessionForTenant(tenantSlug);
  const rememberedCustomerId = getTenantStorageItem(tenantSlug, 'customer_id');

  const { data: tenantMenu } = useQuery({
    queryKey: ['tenant-login-brand', tenantSlug],
    queryFn: async () => {
      const response = await publicApi.get(`/${tenantSlug}/menu`);
      return response.data;
    },
    enabled: Boolean(tenantSlug),
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    const raw = localStorage.getItem(rememberKey);
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      if (typeof data?.phone === 'string') setPhone(data.phone);
      if (typeof data?.name === 'string') setName(data.name);
      if (typeof data?.mode === 'string' && ['guest', 'login', 'signup'].includes(data.mode)) {
        setMode(data.mode as AuthMode);
      }
    } catch {
      // ignore invalid cache
    }
  }, [rememberKey]);

  useEffect(() => {
    if (!tenantSlug || !tableId) return;
    if (activeSessionId) {
      navigate(`/order/${tenantSlug}/session/${activeSessionId}`, { replace: true });
      return;
    }
    if (rememberedCustomerId) {
      navigate(`/order/${tenantSlug}/${tableId}/party`, { replace: true });
    }
  }, [activeSessionId, navigate, rememberedCustomerId, tableId, tenantSlug]);

  const restaurantName = tenantMenu?.businessName || tenantMenu?.name || 'Restaurant';
  const logoUrl = tenantMenu?.logoUrl || tenantMenu?.logo || tenantMenu?.businessLogo || tenantMenu?.restaurantLogo || '';

  const panelCopy = useMemo(() => {
    if (mode === 'login') {
      return {
        title: 'Sign in to continue',
        subtitle: 'Use your saved customer account to open menu, history, and bills faster.',
        cta: 'Login',
      };
    }
    if (mode === 'signup') {
      return {
        title: 'Create your customer account',
        subtitle: 'Save your bills and order history for future visits.',
        cta: 'Create account',
      };
    }
    return {
      title: 'Start as guest',
      subtitle: 'Quick start for dine-in. You can still create an account later.',
      cta: 'Continue',
    };
  }, [mode]);

  const canSubmit =
    phone.length >= 10 &&
    (mode === 'guest' || password.trim().length >= 6) &&
    (mode !== 'signup' || name.trim().length >= 2);

  const persistRememberedState = () => {
    if (rememberMe) {
      localStorage.setItem(
        rememberKey,
        JSON.stringify({
          phone,
          name,
          rememberMe: true,
          mode,
        }),
      );
    } else {
      localStorage.removeItem(rememberKey);
    }
  };

  const saveCustomerAuth = (response: any) => {
    setCustomerAuthForTenant(tenantSlug, {
      token: response.data.token,
      customerId: response.data.customer.id,
      customerName: response.data.customer.name || '',
      customerPhone: response.data.customer.phone,
    });
  };

  const handleSubmit = async () => {
    if (phone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    if (mode !== 'guest' && password.trim().length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (mode === 'signup' && name.trim().length < 2) {
      setError('Please enter your name to create the account');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (mode === 'guest') {
        const response = await publicApi.post('/customer/login', {
          phone,
          name: name || undefined,
          tenantSlug: tenantSlug || undefined,
        });
        saveCustomerAuth(response);
      } else if (mode === 'login') {
        const response = await publicApi.post('/customer/auth/login', {
          phone,
          password,
          tenantSlug: tenantSlug || undefined,
        });
        saveCustomerAuth(response);
      } else {
        const response = await publicApi.post('/customer/register', {
          phone,
          name,
          password,
          tenantSlug: tenantSlug || undefined,
        });
        saveCustomerAuth(response);
      }

      persistRememberedState();
      navigate(`/order/${tenantSlug}/${tableId}/party`);
    } catch (requestError: any) {
      const status = requestError?.response?.status;
      const message = requestError?.response?.data?.error || 'Unable to continue right now.';
      setError(status === 400 || status === 401 || status === 403 || status === 404 || status === 409 ? message : `Something went wrong. ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const progress = Math.min((phone.length / 10) * 100, 100);

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden bg-gradient-to-b from-orange-500 via-orange-400 to-amber-300">
      <div className="relative px-6 pb-24 pt-16 text-center text-white">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/30 bg-white/15 shadow-xl backdrop-blur-sm">
          {logoUrl ? (
            <BrandLogo
              src={logoUrl}
              name={restaurantName}
              alt={`${restaurantName} logo`}
              className="h-full w-full rounded-3xl"
              imageClassName="h-full w-full rounded-3xl bg-white/70 p-2 object-contain"
              fallbackClassName="rounded-3xl bg-white/15 text-white"
              iconSize={36}
            />
          ) : (
            <ChefHat size={36} className="text-white" />
          )}
        </div>
        <h1 className="mb-2 text-3xl font-black tracking-tight">{restaurantName}</h1>
        <p className="text-base font-medium text-orange-100">Scan, choose party size, and keep your menu and bill linked.</p>

        <div className="absolute -bottom-1 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" preserveAspectRatio="none">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#FAFAFA" />
          </svg>
        </div>
      </div>

      <div className="flex-1 bg-[color:var(--bg-primary)] px-5 pb-10 pt-2">
        <div className="-mt-2 space-y-5 rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl shadow-orange-500/10">
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-gray-50 p-1">
            <ModeTab active={mode === 'guest'} label="Guest" icon={<User size={14} />} onClick={() => setMode('guest')} />
            <ModeTab active={mode === 'login'} label="Login" icon={<LockKeyhole size={14} />} onClick={() => setMode('login')} />
            <ModeTab active={mode === 'signup'} label="Signup" icon={<UserPlus size={14} />} onClick={() => setMode('signup')} />
          </div>

          <div>
            <h2 className="text-xl font-black text-gray-900">{panelCopy.title}</h2>
            <p className="mt-1 text-sm font-medium text-gray-500">{panelCopy.subtitle}</p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Phone Number *</label>
              <span className="text-xs font-bold text-gray-400">{phone.length}/10</span>
            </div>
            <div className="relative">
              <div className="absolute left-4 top-1/2 flex -translate-y-1/2 items-center gap-2">
                <Phone size={16} className="text-gray-400" />
                <span className="text-sm font-bold text-gray-400">+91</span>
                <div className="h-4 w-px bg-gray-200" />
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value.replace(/\D/g, '').slice(0, 10));
                  if (error) setError('');
                }}
                placeholder="98765 43210"
                className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 py-4 pl-20 pr-4 text-xl font-black tracking-widest text-gray-900 outline-none transition-all focus:border-orange-400 focus:bg-white"
                autoFocus
              />
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  background: progress === 100 ? 'linear-gradient(90deg, #22c55e, #16a34a)' : 'linear-gradient(90deg, #f97316, #ea580c)',
                }}
              />
            </div>
          </div>

          {(mode === 'guest' || mode === 'signup') && (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">
                Your Name {mode === 'signup' ? '*' : '(Optional)'}
              </label>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={mode === 'signup' ? 'Enter your full name' : 'What should we call you?'}
                  className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 py-4 pl-11 pr-4 font-semibold text-gray-900 outline-none transition-all focus:border-orange-400 focus:bg-white"
                />
              </div>
            </div>
          )}

          {(mode === 'login' || mode === 'signup') && (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">Password *</label>
              <div className="relative">
                <LockKeyhole size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'signup' ? 'Create a password' : 'Enter your password'}
                  className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 py-4 pl-11 pr-4 font-semibold text-gray-900 outline-none transition-all focus:border-orange-400 focus:bg-white"
                />
              </div>
              <p className="mt-2 text-xs font-medium text-gray-400">
                {mode === 'signup' ? 'Your account will save order history and closed bills.' : 'Use your saved customer account to reopen history anytime.'}
              </p>
            </div>
          )}

          {error && (
            <div className="fade-in flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-600">
            <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
            Remember me on this device
          </label>

          <button
            onClick={handleSubmit}
            disabled={loading || !canSubmit}
            className="mt-2 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 py-4 text-lg font-black text-white shadow-xl shadow-orange-500/30 transition-all active:scale-[0.98] hover:brightness-110 disabled:opacity-50"
          >
            {loading ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                {panelCopy.cta} <ArrowRight size={22} />
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-400">
            {mode === 'guest'
              ? 'Guest start stays fast. You can still create an account later from the same number.'
              : 'Your saved account lets you reopen history, bills, and past visits after session close.'}
          </p>
        </div>

        <p className="mt-6 text-center text-xs font-medium text-gray-400">
          Powered by <span className="font-bold text-gray-500">BHOJFLOW</span>
        </p>
      </div>
    </div>
  );
}

function ModeTab({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-[11px] font-black uppercase tracking-[0.14em] transition-all ${
        active ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
