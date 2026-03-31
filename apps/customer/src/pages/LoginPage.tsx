import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { publicApi } from '../lib/api';
import { Phone, User, ArrowRight, ChefHat } from 'lucide-react';

export function LoginPage() {
  const { tenantSlug, tableId } = useParams();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (phone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await publicApi.post('/customer/login', { phone, name: name || undefined });
      localStorage.setItem('rf_customer_token', res.data.token);
      localStorage.setItem('rf_customer_id', res.data.customer.id);
      localStorage.setItem('rf_customer_name', res.data.customer.name || '');
      localStorage.setItem('rf_customer_phone', res.data.customer.phone);
      navigate(`/order/${tenantSlug}/${tableId}/party`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const progress = Math.min((phone.length / 10) * 100, 100);

  return (
    <div className="min-h-[100dvh] flex flex-col overflow-hidden bg-gradient-to-b from-orange-500 via-orange-400 to-amber-300">
      {/* Hero area */}
      <div className="relative px-6 pt-16 pb-24 text-white text-center">
        {/* Floating icon */}
        <div className="w-20 h-20 bg-white/15 backdrop-blur-sm rounded-3xl flex items-center justify-center mx-auto mb-5 border border-white/30 float shadow-xl">
          <ChefHat size={36} className="text-white" />
        </div>
        <h1 className="text-3xl font-black tracking-tight mb-2">Welcome!</h1>
        <p className="text-orange-100 text-base font-medium">Enter your details to start dining</p>

        {/* Wave SVG */}
        <div className="absolute -bottom-1 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" preserveAspectRatio="none">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#FAFAFA" />
          </svg>
        </div>
      </div>

      {/* Form card */}
      <div className="flex-1 bg-[color:var(--bg-primary)] px-5 pt-2 pb-10">
        <div className="bg-white rounded-3xl shadow-2xl shadow-orange-500/10 border border-gray-100 p-6 space-y-5 -mt-2">

          {/* Phone */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phone Number *</label>
              <span className="text-xs font-bold text-gray-400">{phone.length}/10</span>
            </div>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <Phone size={16} className="text-gray-400" />
                <span className="text-gray-400 text-sm font-bold">+91</span>
                <div className="w-px h-4 bg-gray-200" />
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                  if (error) setError('');
                }}
                placeholder="98765 43210"
                className="w-full pl-20 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-900 font-black text-xl outline-none focus:border-orange-400 focus:bg-white transition-all tracking-widest"
                autoFocus
              />
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  background: progress === 100 ? 'linear-gradient(90deg, #22c55e, #16a34a)' : 'linear-gradient(90deg, #f97316, #ea580c)'
                }}
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Your Name (Optional)</label>
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should we call you?"
                className="w-full pl-11 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-900 font-semibold outline-none focus:border-orange-400 focus:bg-white transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-semibold fade-in">
              {error}
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleLogin}
            disabled={loading || phone.length < 10}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:brightness-110 disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-xl shadow-orange-500/30 flex items-center justify-center gap-3 active:scale-[0.98] transition-all text-lg mt-2"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Continue <ArrowRight size={22} />
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-400">
            🔒 No OTP needed. Your number is only used for order tracking.
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 font-medium mt-6">
          Powered by <span className="font-bold text-gray-500">RestoFlow</span>
        </p>
      </div>
    </div>
  );
}
