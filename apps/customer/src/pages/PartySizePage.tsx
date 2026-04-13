import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, Users } from 'lucide-react';
import { publicApi } from '../lib/api';
import { getTenantStorageItem, setActiveSessionForTenant } from '../lib/tenantStorage';

const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6];

export function PartySizePage() {
  const { tenantSlug, tableId } = useParams();
  const navigate = useNavigate();
  const [partySize, setPartySize] = useState(2);
  const [customSize, setCustomSize] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const customerName = getTenantStorageItem(tenantSlug, 'customer_name') || '';
  const customerPhone = getTenantStorageItem(tenantSlug, 'customer_phone') || '';
  const customerId = getTenantStorageItem(tenantSlug, 'customer_id');

  const handleContinue = async () => {
    if (!customerId) {
      navigate(`/order/${tenantSlug}/${tableId}`);
      return;
    }

    const finalSize = showCustom ? parseInt(customSize, 10) || 1 : partySize;

    setLoading(true);
    setError('');

    try {
      const response = await publicApi.post(`/${tenantSlug}/sessions`, {
        customerId,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        tableId,
        partySize: finalSize,
      });

      setActiveSessionForTenant(tenantSlug, response.data.id);
      navigate(`/order/${tenantSlug}/${tableId}/menu`);
    } catch (requestError: any) {
      if (requestError?.response?.status === 409) {
        const existingId = requestError.response.data.existingSessionId;
        setActiveSessionForTenant(tenantSlug, existingId);
        navigate(`/order/${tenantSlug}/${tableId}/menu`);
      } else {
        setError(requestError?.response?.data?.error || 'Failed to start session');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[color:var(--bg-primary)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 px-6 pb-12 pt-16 text-center text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <Users size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            {customerName ? `Hey ${customerName}!` : 'Almost there!'}
          </h1>
          <p className="mt-1 text-sm font-medium text-white/80">How many people are dining today?</p>
        </div>
      </div>

      <div className="relative z-10 -mt-6 flex-1 px-6">
        <div className="rounded-3xl border border-[color:var(--border-primary)] bg-[color:var(--bg-secondary)] p-6 shadow-xl">
          {!showCustom ? (
            <>
              <div className="mb-4 grid grid-cols-3 gap-3">
                {PARTY_OPTIONS.map((size) => (
                  <button
                    key={size}
                    onClick={() => setPartySize(size)}
                    className={`rounded-2xl py-5 text-2xl font-black transition-all active:scale-95 ${
                      partySize === size
                        ? 'scale-105 bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                        : 'border border-[color:var(--border-primary)] bg-[color:var(--bg-primary)] text-[color:var(--text-primary)] hover:border-blue-300'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowCustom(true)}
                className="w-full py-2 text-center text-sm font-bold text-blue-500 transition-colors hover:text-blue-600"
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
                onChange={(event) => setCustomSize(event.target.value)}
                placeholder="Enter party size"
                className="w-full rounded-2xl border border-[color:var(--border-primary)] bg-[color:var(--bg-primary)] py-5 text-center text-3xl font-black text-[color:var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={() => {
                  setShowCustom(false);
                  setCustomSize('');
                }}
                className="w-full py-2 text-center text-sm font-bold text-gray-400"
              >
                ← Back to quick select
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-500">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button
            onClick={handleContinue}
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 py-4 text-lg font-black text-white shadow-xl shadow-blue-500/25 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                Start Dining <ArrowRight size={20} />
              </>
            )}
          </button>

          <p className="mt-3 text-center text-xs text-[color:var(--text-secondary)]">
            Your table will be reserved immediately
          </p>
        </div>
      </div>

      <div className="py-6 text-center">
        <p className="text-xs font-medium text-gray-300">
          Powered by <span className="font-bold text-gray-400">RestoFlow</span>
        </p>
      </div>
    </div>
  );
}
