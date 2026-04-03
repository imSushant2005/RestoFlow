import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { publicApi } from '../lib/api';
import { Plus, Receipt, ChefHat, Clock, CheckCircle2, UtensilsCrossed, X, RotateCcw } from 'lucide-react';
import { useCartStore } from '../store/cartStore';

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  NEW: { label: 'Received', color: 'text-blue-500', icon: Clock },
  ACCEPTED: { label: 'Accepted', color: 'text-indigo-500', icon: CheckCircle2 },
  PREPARING: { label: 'Preparing', color: 'text-yellow-500', icon: ChefHat },
  READY: { label: 'Ready', color: 'text-green-500', icon: UtensilsCrossed },
  SERVED: { label: 'Served', color: 'text-emerald-500', icon: CheckCircle2 },
  RECEIVED: { label: 'Done', color: 'text-gray-400', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', color: 'text-red-500', icon: X },
};

const FLOW_STEPS = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'RECEIVED'];

export function SessionTracker() {
  const { tenantSlug, sessionId: routeSessionId } = useParams();
  const navigate = useNavigate();
  const addItem = useCartStore((s) => s.addItem);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);

  const sessionId = routeSessionId || localStorage.getItem('rf_active_session');
  const tableId = session?.tableId;

  const fetchSession = async () => {
    if (!sessionId) return;
    try {
      const res = await publicApi.get(`/${tenantSlug}/sessions/${sessionId}`);
      setSession(res.data);
    } catch {
      // ignore transient polling errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 5000);
    return () => clearInterval(interval);
  }, [sessionId, tenantSlug]);

  const handleFinish = async () => {
    if (!confirm('Finish dining? No more items can be added after this.')) return;
    setFinishing(true);
    try {
      await publicApi.post(`/${tenantSlug}/sessions/${sessionId}/finish`);
      navigate(`/order/${tenantSlug}/session/${sessionId}/bill`);
    } catch {
      alert('Failed to finish session');
    } finally {
      setFinishing(false);
    }
  };

  const handleReorder = (order: any) => {
    if (!Array.isArray(order?.items) || order.items.length === 0) return;
    for (const item of order.items) {
      addItem({
        id: Math.random().toString(36).slice(2),
        menuItem: {
          id: item.menuItemId || item.id,
          name: item.name,
          price: Number(item.unitPrice || item.totalPrice || 0),
          imageUrl: item.imageUrl || null,
        },
        quantity: Number(item.quantity || 1),
        modifiers: Array.isArray(item.selectedModifiers) ? item.selectedModifiers : [],
        notes: item.specialNote || '',
        totalPrice: Number(item.unitPrice || item.totalPrice || 0),
      });
    }

    if (tableId) navigate(`/order/${tenantSlug}/${tableId}/menu`);
    else navigate(`/order/${tenantSlug}`);
  };

  const sessionProgress = useMemo(() => {
    const activeOrders = (session?.orders || []).filter((order: any) => order.status !== 'CANCELLED');
    if (activeOrders.length === 0) return 0;
    const progressValues = activeOrders.map((order: any) => {
      const idx = FLOW_STEPS.indexOf(order.status);
      return idx < 0 ? 0 : (idx / (FLOW_STEPS.length - 1)) * 100;
    });
    return Math.round(progressValues.reduce((sum: number, val: number) => sum + val, 0) / progressValues.length);
  }, [session?.orders]);

  const formatINR = (amt: number) => `₹${Number(amt || 0).toFixed(0)}`;

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[color:var(--bg-primary)] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-[100dvh] bg-[color:var(--bg-primary)] flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-[color:var(--text-secondary)] font-bold">No active session found</p>
        <button onClick={() => navigate(-1)} className="text-blue-500 font-bold text-sm">← Go back</button>
      </div>
    );
  }

  const isClosed = ['CLOSED', 'CANCELLED', 'AWAITING_BILL'].includes(session.sessionStatus);

  return (
    <div className="min-h-[100dvh] bg-[color:var(--bg-primary)] flex flex-col pb-32">
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
        <div className="mt-4">
          <div className="flex justify-between text-[11px] font-bold text-white/85 mb-1">
            <span>Session Progress</span>
            <span>{sessionProgress}%</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${sessionProgress}%` }}
            />
          </div>
        </div>
      </div>

      {!isClosed && (
        <div className="mx-4 mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs font-bold text-blue-700 text-center">
          This is a running bill. Final bill is generated when you finish dining.
        </div>
      )}

      <div className="px-4 mt-4 space-y-4 flex-1">
        <h3 className="font-black text-[color:var(--text-primary)] text-lg">Live Order Timeline</h3>

        {session.orders?.length === 0 && (
          <p className="text-center text-[color:var(--text-secondary)] text-sm py-8">No orders yet. Add items from the menu.</p>
        )}

        {session.orders?.map((order: any, idx: number) => {
          const status = STATUS_MAP[order.status] || STATUS_MAP.NEW;
          const StatusIcon = status.icon;
          const activeStep = Math.max(0, FLOW_STEPS.indexOf(order.status));

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

              <div className="mb-3">
                <div className="flex items-center justify-between text-[10px] font-bold text-[color:var(--text-secondary)] mb-1">
                  <span>Order Progress</span>
                  <span>{Math.round((activeStep / (FLOW_STEPS.length - 1)) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-[color:var(--border-primary)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.round((activeStep / (FLOW_STEPS.length - 1)) * 100)}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-[color:var(--text-secondary)]">
                  {FLOW_STEPS.map((step, stepIndex) => (
                    <span
                      key={step}
                      className={`px-1.5 py-0.5 rounded ${
                        stepIndex <= activeStep ? 'bg-blue-50 text-blue-600 font-bold' : ''
                      }`}
                    >
                      {STATUS_MAP[step]?.label || step}
                    </span>
                  ))}
                </div>
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

              <div className="border-t border-[color:var(--border-primary)] mt-3 pt-2 flex justify-between items-center">
                <div>
                  <span className="text-xs text-[color:var(--text-secondary)] font-bold">Order Total</span>
                  <p className="font-black text-[color:var(--text-primary)]">{formatINR(order.totalAmount)}</p>
                </div>
                <button
                  onClick={() => handleReorder(order)}
                  className="text-xs font-bold px-3 py-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center gap-1.5"
                >
                  <RotateCcw size={13} />
                  Reorder
                </button>
              </div>
            </div>
          );
        })}
      </div>

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
                <>
                  <Receipt size={18} /> Finish Dining
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
