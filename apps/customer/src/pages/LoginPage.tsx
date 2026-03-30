import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { publicApi } from '../lib/api';
import { Phone, User, ArrowRight, Utensils } from 'lucide-react';

export function LoginPage() {
  const { tenantSlug, tableId } = useParams();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (phone.length < 10) {
      setError('Enter a valid phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await publicApi.post('/customer/login', { phone, name: name || undefined });
      
      // Store customer JWT and info
      localStorage.setItem('rf_customer_token', res.data.token);
      localStorage.setItem('rf_customer_id', res.data.customer.id);
      localStorage.setItem('rf_customer_name', res.data.customer.name || '');
      localStorage.setItem('rf_customer_phone', res.data.customer.phone);

      // Navigate to party size
      navigate(`/order/${tenantSlug}/${tableId}/party`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[color:var(--bg-primary)] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-500 to-red-500 px-6 pt-16 pb-12 text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Utensils size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Welcome!</h1>
          <p className="text-white/80 text-sm mt-1 font-medium">Enter your phone to start dining</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 -mt-6 relative z-10">
        <div className="bg-[color:var(--bg-secondary)] rounded-3xl shadow-xl border border-[color:var(--border-primary)] p-6 space-y-5">
          
          {/* Phone */}
          <div>
            <label className="text-xs font-bold text-[color:var(--text-secondary)] uppercase tracking-wider mb-2 block">Phone Number *</label>
            <div className="relative">
              <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Enter your 10-digit number"
                className="w-full pl-12 pr-4 py-4 bg-[color:var(--bg-primary)] border border-[color:var(--border-primary)] rounded-2xl text-[color:var(--text-primary)] font-bold text-lg outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                autoFocus
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-bold text-[color:var(--text-secondary)] uppercase tracking-wider mb-2 block">Your Name (Optional)</label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should we call you?"
                className="w-full pl-12 pr-4 py-4 bg-[color:var(--bg-primary)] border border-[color:var(--border-primary)] rounded-2xl text-[color:var(--text-primary)] font-bold outline-none focus:ring-2 focus:ring-orange-500 transition-all"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm font-bold text-center">{error}</p>
          )}

          {/* Submit */}
          <button
            onClick={handleLogin}
            disabled={loading || phone.length < 10}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-orange-500/25 flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98] transition-all text-lg"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Continue <ArrowRight size={20} />
              </>
            )}
          </button>

          <p className="text-center text-xs text-[color:var(--text-secondary)]">
            No OTP needed. Just enter your number to start.
          </p>
        </div>
      </div>

      <div className="text-center py-6">
        <p className="text-xs text-gray-300 font-medium">
          Powered by <span className="font-bold text-gray-400">RestoFlow</span>
        </p>
      </div>
    </div>
  );
}
