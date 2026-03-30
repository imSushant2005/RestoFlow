import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { publicApi } from '../lib/api';
import { Plus, Receipt, ChefHat, Clock, CheckCircle2, UtensilsCrossed, X } from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: 'Received', color: 'text-blue-500', icon: Clock },
  ACCEPTED: { label: 'Accepted', color: 'text-indigo-500', icon: CheckCircle2 },
  PREPARING: { label: 'Preparing', color: 'text-yellow-500', icon: ChefHat },
  READY: { label: 'Ready!', color: 'text-green-500', icon: UtensilsCrossed },
  SERVED: { label: 'Served', color: 'text-emerald-500', icon: CheckCircle2 },
  COMPLETED: { label: 'Done', color: 'text-gray-400', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', color: 'text-red-500', icon: X },
};

export function SessionTracker() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);

  const sessionId = localStorage.getItem('rf_active_session');
  const tableId = session?.tableId;

  const fetchSession = async () => {
    if (!sessionId) return;
    try {
      const res = await publicApi.get(`/${tenantSlug}/sessions/${sessionId}`);
      setSession(res.data);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const handleFinish = async () => {
    if (!confirm('Finish dining? No more items can be added after this.')) return;
    setFinishing(true);
    try {
      await publicApi.post(`/${tenantSlug}/sessions/${sessionId}/finish`);
      navigate(`/order/${tenantSlug}/session/${sessionId}/bill`);
    } catch (err) {
      alert('Failed to finish session');
    } finally {
      setFinishing(false);
    }
  };

  const formatINR = (amt: number) => `₹${Number(amt || 0).toFixed(0)}`;

  if (loading) return (
    <div className="min-h-[100dvh] bg-[color:var(--bg-primary)] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  if (!session) return (
    <div className="min-h-[100dvh] bg-[color:var(--bg-primary)] flex flex-col items-center justify-center gap-4 p-6">
      <p className="text-[color:var(--text-secondary)] font-bold">No active session found</p>
      <button onClick={() => navigate(-1)} className="text-blue-500 font-bold text-sm">← Go back</button>
    </div>
  );

  const isClosed = ['COMPLETED', 'CANCELLED', 'BILL_GENERATED'].includes(session.sessionStatus);

  return (
    <div className="min-h-[100dvh] bg-[color:var(--bg-primary)] flex flex-col pb-32">
      {/* Session Banner */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-5 text-white">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-black text-lg">{session.tenant?.businessName}</p>
            <p className="text-white/80 text-xs font-medium">
              {session.table?.name || 'Takeaway'} • {session.partySize} guests • Session active
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/70 font-bold uppercase">Running Total</p>
            <p className="text-2xl font-black">{formatINR(session.runningTotal)}</p>
          </div>
        </div>
      </div>

      {/* Running Bill Notice */}
      {!isClosed && (
        <div className="mx-4 mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-xs font-bold text-blue-700 dark:text-blue-300 text-center">
          💡 This is a running bill. Final bill is generated when you finish dining.
        </div>
      )}

      {/* Orders List */}
      <div className="px-4 mt-4 space-y-4 flex-1">
        <h3 className="font-black text-[color:var(--text-primary)] text-lg">Your Orders</h3>
        
        {session.orders?.length === 0 && (
          <p className="text-center text-[color:var(--text-secondary)] text-sm py-8">No orders yet. Add items from the menu!</p>
        )}

        {session.orders?.map((order: any, idx: number) => {
          const status = STATUS_MAP[order.status] || STATUS_MAP.PENDING;
          const StatusIcon = status.icon;
          return (
            <div key={order.id} className="bg-[color:var(--bg-secondary)] rounded-2xl border border-[color:var(--border-primary)] p-4 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-black text-[color:var(--text-primary)]">Order #{idx + 1}</p>
                  <p className="text-xs text-[color:var(--text-secondary)]">{new Date(order.createdAt).toLocaleTimeString()}</p>
                </div>
                <span className={`flex items-center gap-1.5 text-xs font-black ${status.color}`}>
                  <StatusIcon size={14} /> {status.label}
                </span>
              </div>
              <div className="space-y-2">
                {order.items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-[color:var(--text-primary)]">
                      <span className="font-bold text-blue-500 mr-1">{item.quantity}x</span>
                      {item.name}
                    </span>
                    <span className="font-bold text-[color:var(--text-primary)]">{formatINR(item.totalPrice)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-[color:var(--border-primary)] mt-3 pt-2 flex justify-between">
                <span className="text-xs text-[color:var(--text-secondary)] font-bold">Order Total</span>
                <span className="font-black text-[color:var(--text-primary)]">{formatINR(order.totalAmount)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Action Bar */}
      {!isClosed && (
        <div className="fixed bottom-0 left-0 right-0 bg-[color:var(--bg-secondary)] border-t border-[color:var(--border-primary)] px-4 py-4 space-y-3 z-50">
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/order/${tenantSlug}/${tableId}/menu`)}
              className="flex-1 bg-blue-500 text-white font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-blue-500/25"
            >
              <Plus size={18} /> Add More Items
            </button>
            <button
              onClick={handleFinish}
              disabled={finishing}
              className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50"
            >
              {finishing ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><Receipt size={18} /> Finish Dining</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
