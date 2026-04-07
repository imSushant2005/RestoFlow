import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, ChevronRight, Star, MapPin, Users } from 'lucide-react';
import { api } from '../lib/api';
import { getCustomerTokenForTenant } from '../lib/tenantStorage';

export function HistoryPage() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const token = getCustomerTokenForTenant(tenantSlug);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data } = await api.get('/customer/history', {
          params: { tenantSlug },
          headers: { Authorization: `Bearer ${token}` },
        });
        setSessions(data);
      } catch {
        // ignore history fetch failures on this view; empty state handles UX
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchHistory();
    else setLoading(false);
  }, [tenantSlug, token]);

  const formatINR = (amt: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
      Number(amt || 0),
    );

  if (loading)
    return (
      <div className="min-h-[100dvh] bg-[color:var(--bg-primary)] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );

  if (!token)
    return (
      <div className="min-h-[100dvh] bg-[color:var(--bg-primary)] flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-[color:var(--text-secondary)] font-bold">Please login to see your order history</p>
        <button onClick={() => navigate(-1)} className="text-blue-500 font-bold text-sm">
          Back
        </button>
      </div>
    );

  return (
    <div className="min-h-[100dvh] bg-[color:var(--bg-primary)]">
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 px-6 pt-14 pb-8 text-white">
        <button onClick={() => navigate(-1)} className="text-white/70 text-sm font-bold mb-4">
          Back
        </button>
        <h1 className="text-2xl font-black tracking-tight">Order History</h1>
        <p className="text-white/80 text-sm font-medium mt-1">{sessions.length} past visits</p>
      </div>

      <div className="px-4 -mt-4 relative z-10 space-y-3 pb-8">
        {sessions.length === 0 && (
          <div className="text-center py-16">
            <Clock size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-[color:var(--text-secondary)] font-bold">No past visits yet</p>
            <p className="text-xs text-[color:var(--text-secondary)] mt-1">Your dining history will appear here</p>
          </div>
        )}

        {sessions.map((s: any) => {
          const totalItems = s.orders?.reduce((sum: number, o: any) => sum + (o.items?.length || 0), 0) || 0;
          const paid = s.bill?.paymentStatus === 'PAID';
          return (
            <button
              key={s.id}
              onClick={() => navigate(`/order/${tenantSlug}/session/${s.id}/bill`)}
              className="w-full bg-[color:var(--bg-secondary)] rounded-2xl border border-[color:var(--border-primary)] p-4 shadow-sm text-left flex justify-between items-center group hover:shadow-md transition-all active:scale-[0.98]"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-black text-[color:var(--text-primary)] text-base truncate">
                    {s.tenant?.businessName || 'Restaurant'}
                  </span>
                  {s.bill?.paymentStatus && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                      style={{
                        background: paid ? 'rgba(16,185,129,0.16)' : 'rgba(245,158,11,0.16)',
                        color: paid ? '#059669' : '#d97706',
                      }}
                    >
                      {paid ? 'Paid' : 'Unpaid'}
                    </span>
                  )}
                  {s.review && (
                    <span className="flex items-center gap-0.5 text-xs text-amber-500 font-bold">
                      <Star size={10} fill="currentColor" /> {s.review.overallRating}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-[color:var(--text-secondary)]">
                  <span className="flex items-center gap-1">
                    <MapPin size={10} /> {s.table?.name || 'Takeaway'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={10} /> {s.partySize}
                  </span>
                  <span>{totalItems} items</span>
                </div>
                <p className="text-xs text-[color:var(--text-secondary)] mt-1">
                  {new Date(s.openedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' | '}
                  {new Date(s.openedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
                {s.review?.comment?.trim() && (
                  <p className="text-xs mt-2 italic line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                    "{s.review.comment.trim()}"
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="font-black text-orange-500 text-lg">{formatINR(s.bill?.totalAmount || 0)}</span>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
