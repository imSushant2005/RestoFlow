import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, ChefHat, Phone, User } from 'lucide-react';
import { publicApi } from '../lib/api';
import { setCustomerAuthForTenant } from '../lib/tenantStorage';

export function LoginPage() {
  const { tenantSlug, tableId } = useParams();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const rememberKey = `rf_login_pref_${tenantSlug || 'default'}`;

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
      if (typeof data?.rememberMe === 'boolean') setRememberMe(data.rememberMe);
    } catch {
      // Ignore invalid local storage payloads.
    }
  }, [rememberKey]);

  const handleLogin = async () => {
    if (phone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await publicApi.post('/customer/login', {
        phone,
        name: name || undefined,
        tenantSlug: tenantSlug || undefined,
      });

      setCustomerAuthForTenant(tenantSlug, {
        token: response.data.token,
        customerId: response.data.customer.id,
        customerName: response.data.customer.name || '',
        customerPhone: response.data.customer.phone,
      });

      if (rememberMe) {
        localStorage.setItem(
          rememberKey,
          JSON.stringify({
            phone,
            name,
            rememberMe: true,
          }),
        );
      } else {
        localStorage.removeItem(rememberKey);
      }

      navigate(`/order/${tenantSlug}/${tableId}/party`);
    } catch (requestError: any) {
      const status = requestError?.response?.status;
      const message = requestError?.response?.data?.error || 'Login failed. Please try again.';
      setError(status === 400 ? message : `Unable to log in right now. ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const progress = Math.min((phone.length / 10) * 100, 100);

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden bg-gradient-to-b from-orange-500 via-orange-400 to-amber-300">
      <div className="relative px-6 pb-24 pt-16 text-center text-white">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/30 bg-white/15 shadow-xl backdrop-blur-sm">
          {tenantMenu?.logoUrl ? (
            <img
              src={tenantMenu.logoUrl}
              alt={`${tenantMenu?.businessName || 'Restaurant'} logo`}
              className="h-full w-full rounded-3xl object-cover"
            />
          ) : (
            <ChefHat size={36} className="text-white" />
          )}
        </div>
        <h1 className="mb-2 text-3xl font-black tracking-tight">
          {tenantMenu?.businessName || tenantMenu?.name || 'Welcome!'}
        </h1>
        <p className="text-base font-medium text-orange-100">Enter your details to start dining</p>

        <div className="absolute -bottom-1 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" preserveAspectRatio="none">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#FAFAFA" />
          </svg>
        </div>
      </div>

      <div className="flex-1 bg-[color:var(--bg-primary)] px-5 pb-10 pt-2">
        <div className="-mt-2 space-y-5 rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl shadow-orange-500/10">
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
                  background:
                    progress === 100
                      ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                      : 'linear-gradient(90deg, #f97316, #ea580c)',
                }}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">Your Name (Optional)</label>
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="What should we call you?"
                className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 py-4 pl-11 pr-4 font-semibold text-gray-900 outline-none transition-all focus:border-orange-400 focus:bg-white"
              />
            </div>
          </div>

          {error && (
            <div className="fade-in flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-600">
            <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
            Remember me on this device
          </label>

          <button
            onClick={handleLogin}
            disabled={loading || phone.length < 10}
            className="mt-2 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 py-4 text-lg font-black text-white shadow-xl shadow-orange-500/30 transition-all active:scale-[0.98] hover:brightness-110 disabled:opacity-50"
          >
            {loading ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                Continue <ArrowRight size={22} />
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-400">
            No OTP needed. Your number is only used for order tracking.
          </p>
        </div>

        <p className="mt-6 text-center text-xs font-medium text-gray-400">
          Powered by <span className="font-bold text-gray-500">RestoFlow</span>
        </p>
      </div>
    </div>
  );
}
