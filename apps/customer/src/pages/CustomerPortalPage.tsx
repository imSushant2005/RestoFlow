import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, LogOut, QrCode, ShieldCheck, UserPlus, LockKeyhole, UserRound, UtensilsCrossed } from 'lucide-react';
import { publicApi } from '../lib/api';
import {
  clearCustomerContextForTenant,
  getCustomerNameForTenant,
  getCustomerTokenForTenant,
  getLastVisitedTenantSlug,
  setCustomerAuthForTenant,
} from '../lib/tenantStorage';

type PortalMode = 'login' | 'signup';

export function CustomerPortalPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryTenant = searchParams.get('tenant')?.trim() || '';
  const rememberedTenant = getLastVisitedTenantSlug()?.trim() || '';
  const scopedTenantSlug = queryTenant || rememberedTenant || '';
  const isLoggedIn = Boolean(getCustomerTokenForTenant(scopedTenantSlug || undefined));
  const customerName = getCustomerNameForTenant(scopedTenantSlug || undefined) || 'Customer';

  const [mode, setMode] = useState<PortalMode>('login');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const panelCopy = useMemo(
    () =>
      mode === 'signup'
        ? {
            title: 'Create your customer account',
            subtitle: 'Save order history, past bills, and faster checkouts across visits.',
            cta: 'Create account',
          }
        : {
            title: 'Login to your customer account',
            subtitle: 'Reopen your bills, view history, and continue ordering quickly.',
            cta: 'Login',
          },
    [mode],
  );

  const handleAuth = async () => {
    setLoading(true);
    setError('');
    try {
      const response =
        mode === 'signup'
          ? await publicApi.post('/customer/register', {
              phone,
              name,
              password,
              tenantSlug: scopedTenantSlug || undefined,
            })
          : await publicApi.post('/customer/auth/login', {
              phone,
              password,
              tenantSlug: scopedTenantSlug || undefined,
            });

      setCustomerAuthForTenant(scopedTenantSlug || undefined, {
        token: response.data.token,
        customerId: response.data.customer.id,
        customerName: response.data.customer.name || '',
        customerPhone: response.data.customer.phone,
      });
      if (scopedTenantSlug) {
        navigate(`/order/${scopedTenantSlug}`, { replace: true });
        return;
      }
      window.location.reload();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || 'Could not continue right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearCustomerContextForTenant(scopedTenantSlug || undefined);
    navigate(scopedTenantSlug ? `/?tenant=${scopedTenantSlug}` : '/', { replace: true });
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] px-4 py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <section className="overflow-hidden rounded-[2.5rem] border border-white/6 bg-slate-950 text-white shadow-2xl">
          <div className="relative px-6 py-8 sm:px-8 sm:py-10">
            <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-blue-500/10 blur-[90px]" />
            <div className="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-orange-500/10 blur-[90px]" />
            <div className="relative flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/15 text-blue-400">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-400/80">Customer Portal</p>
                  <h1 className="mt-1 text-3xl font-black tracking-tight">BHOJFLOW</h1>
                </div>
              </div>
              <p className="max-w-2xl text-sm font-medium leading-6 text-slate-300">
                Login, scan a table QR, continue to the menu, and reopen your bills after the restaurant closes your session.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-white/6 bg-white p-5 shadow-xl sm:p-6">
            <div className="flex items-center gap-2 rounded-2xl bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] transition-all ${
                  mode === 'login' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                <LockKeyhole size={14} />
                Login
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] transition-all ${
                  mode === 'signup' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                <UserPlus size={14} />
                Signup
              </button>
            </div>

            <div className="mt-5">
              <h2 className="text-2xl font-black text-gray-900">{panelCopy.title}</h2>
              <p className="mt-2 text-sm font-medium text-gray-500">{panelCopy.subtitle}</p>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-gray-500">Mobile Number</label>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter mobile number"
                  className="h-12 w-full rounded-2xl border-2 border-gray-100 bg-gray-50 px-4 font-black text-gray-900 outline-none transition-all focus:border-orange-400 focus:bg-white"
                />
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-gray-500">Full Name</label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Enter your name"
                    className="h-12 w-full rounded-2xl border-2 border-gray-100 bg-gray-50 px-4 font-black text-gray-900 outline-none transition-all focus:border-orange-400 focus:bg-white"
                  />
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-gray-500">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'signup' ? 'Create password' : 'Enter password'}
                  className="h-12 w-full rounded-2xl border-2 border-gray-100 bg-gray-50 px-4 font-black text-gray-900 outline-none transition-all focus:border-orange-400 focus:bg-white"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleAuth}
                disabled={loading || phone.length < 10 || password.length < 6 || (mode === 'signup' && name.trim().length < 2)}
                className="flex h-13 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 py-4 text-lg font-black text-white shadow-xl shadow-orange-500/30 transition-all active:scale-[0.98] hover:brightness-110 disabled:opacity-50"
              >
                {loading ? <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <>{panelCopy.cta} <ArrowRight size={20} /></>}
              </button>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/6 bg-white p-5 shadow-xl sm:p-6">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Quick Actions</p>
                <h2 className="mt-2 text-2xl font-black text-gray-900">
                  {isLoggedIn ? `Welcome back, ${customerName}` : 'Start from anywhere'}
                </h2>
                <p className="mt-2 text-sm font-medium text-gray-500">
                  {isLoggedIn
                    ? 'Scan a table QR, continue to your restaurant menu, or reopen your saved history.'
                    : 'Use the customer portal, scan a QR from the table, or open a restaurant menu link.'}
                </p>
              </div>

              <div className="space-y-3">
                <ActionButton icon={<QrCode size={18} />} label="Scan QR Code" onClick={() => navigate('/scan')} />
                {scopedTenantSlug && (
                  <>
                    <ActionButton icon={<UtensilsCrossed size={18} />} label="Open Restaurant Home" onClick={() => navigate(`/order/${scopedTenantSlug}`)} />
                    <ActionButton icon={<ArrowRight size={18} />} label="Enter Menu" onClick={() => navigate(`/order/${scopedTenantSlug}/menu`)} />
                    {isLoggedIn && (
                      <ActionButton icon={<UserRound size={18} />} label="Open My History" onClick={() => navigate(`/order/${scopedTenantSlug}/history`)} />
                    )}
                  </>
                )}
                {isLoggedIn && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 text-[12px] font-black uppercase tracking-[0.14em] text-red-600 transition-all hover:bg-red-100"
                  >
                    <LogOut size={18} />
                    Logout
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 w-full items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-5 text-left transition-all hover:border-orange-200 hover:bg-orange-50"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm">
          {icon}
        </span>
        <span className="text-[12px] font-black uppercase tracking-[0.14em] text-gray-900">{label}</span>
      </div>
      <ArrowRight size={18} className="text-gray-400" />
    </button>
  );
}
