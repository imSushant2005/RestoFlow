import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { publicApi } from '../lib/api';
import { Users, ArrowRight, AlertCircle } from 'lucide-react';

const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6];

export function PartySizePage() {
  const { tenantSlug, tableId } = useParams();
  const navigate = useNavigate();
  const [partySize, setPartySize] = useState(2);
  const [customSize, setCustomSize] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const customerName = localStorage.getItem('rf_customer_name') || '';
  const customerId = localStorage.getItem('rf_customer_id');

  const handleContinue = async () => {
    if (!customerId) {
      navigate(`/order/${tenantSlug}/${tableId}`);
      return;
    }

    const finalSize = showCustom ? parseInt(customSize) || 1 : partySize;
    
    setLoading(true);
    setError('');

    try {
      const res = await publicApi.post(`/${tenantSlug}/sessions`, {
        customerId,
        tableId,
        partySize: finalSize,
      });

      // Store active session
      localStorage.setItem('rf_active_session', res.data.id);
      localStorage.setItem('restoflow_session', res.data.id);

      // Navigate to menu
      navigate(`/order/${tenantSlug}/${tableId}/menu`);
    } catch (err: any) {
      if (err.response?.status === 409) {
        // Table has an active session — join it
        const existingId = err.response.data.existingSessionId;
        localStorage.setItem('rf_active_session', existingId);
        localStorage.setItem('restoflow_session', existingId);
        navigate(`/order/${tenantSlug}/${tableId}/menu`);
      } else {
        setError(err.response?.data?.error || 'Failed to start session');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[color:var(--bg-primary)] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 px-6 pt-16 pb-12 text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Users size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            {customerName ? `Hey ${customerName}!` : 'Almost there!'}
          </h1>
          <p className="text-white/80 text-sm mt-1 font-medium">How many people are dining today?</p>
        </div>
      </div>

      {/* Party Size Selector */}
      <div className="flex-1 px-6 -mt-6 relative z-10">
        <div className="bg-[color:var(--bg-secondary)] rounded-3xl shadow-xl border border-[color:var(--border-primary)] p-6">
          
          {!showCustom ? (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {PARTY_OPTIONS.map((size) => (
                  <button
                    key={size}
                    onClick={() => setPartySize(size)}
                    className={`py-5 rounded-2xl font-black text-2xl transition-all active:scale-95 ${
                      partySize === size
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105'
                        : 'bg-[color:var(--bg-primary)] text-[color:var(--text-primary)] border border-[color:var(--border-primary)] hover:border-blue-300'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowCustom(true)}
                className="w-full text-center text-sm font-bold text-blue-500 py-2 hover:text-blue-600"
              >
                More than 6? Enter custom number
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <input
                type="number"
                min="1"
                max="50"
                value={customSize}
                onChange={(e) => setCustomSize(e.target.value)}
                placeholder="Enter party size"
                className="w-full py-5 text-center text-3xl font-black bg-[color:var(--bg-primary)] border border-[color:var(--border-primary)] rounded-2xl text-[color:var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={() => { setShowCustom(false); setCustomSize(''); }}
                className="w-full text-center text-sm font-bold text-gray-400 py-2"
              >
                ← Back to quick select
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 mt-4 text-red-500 text-sm font-bold bg-red-50 px-4 py-3 rounded-xl">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button
            onClick={handleContinue}
            disabled={loading}
            className="w-full mt-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-500/25 flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98] transition-all text-lg"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Start Dining <ArrowRight size={20} />
              </>
            )}
          </button>

          <p className="text-center text-xs text-[color:var(--text-secondary)] mt-3">
            Your table will be reserved immediately
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
