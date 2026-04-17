import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChefHat,
  ChevronRight,
  Clock3,
  Share2,
  Star,
  Timer,
  UtensilsCrossed,
} from 'lucide-react';
import { publicApi } from '../lib/api';
import { formatINR } from '../lib/currency';
import { getSocketUrl } from '../lib/network';
import { getActiveSessionForTenant, setLastTableIdForTenant } from '../lib/tenantStorage';
import { useNotifications } from '../components/Notifications';

interface StepConfig {
  label: string;
  icon: ReactNode;
  rank: number;
  glow: string;
}

const STEPS: StepConfig[] = [
  { label: 'Accepted', icon: <CheckCircle2 size={20} />, rank: 1, glow: 'from-blue-500/30 to-indigo-500/10' },
  { label: 'Preparing', icon: <ChefHat size={20} />, rank: 2, glow: 'from-amber-500/30 to-orange-500/10' },
  { label: 'Ready', icon: <UtensilsCrossed size={20} />, rank: 3, glow: 'from-emerald-500/30 to-green-500/10' },
  { label: 'Waiter Pickup', icon: <Bell size={20} />, rank: 4, glow: 'from-cyan-500/30 to-sky-500/10' },
  { label: 'Served', icon: <Clock3 size={20} />, rank: 5, glow: 'from-violet-500/30 to-fuchsia-500/10' },
  { label: 'Complete', icon: <Star size={20} />, rank: 6, glow: 'from-rose-500/30 to-red-500/10' },
];

function isActiveOrder(status?: string) {
  return status !== 'RECEIVED' && status !== 'CANCELLED';
}

function getOrderRank(status: string) {
  switch (status) {
    case 'ACCEPTED':
      return 1;
    case 'PREPARING':
      return 2;
    case 'READY':
      return 3;
    case 'SERVED':
      return 5;
    case 'RECEIVED':
      return 6;
    default:
      return 0;
  }
}

function statusBadgeClass(status?: string) {
  switch (status) {
    case 'NEW':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'ACCEPTED':
    case 'PREPARING':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    case 'READY':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    case 'RECEIVED':
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    case 'CANCELLED':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  }
}

export function OrderStatus() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useNotifications();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [tab, setTab] = useState<'TRACKING' | 'HISTORY'>('TRACKING');
  const sessionToken = getActiveSessionForTenant(tenantSlug);
  const shouldRedirectToTracker = Boolean(tenantSlug && sessionToken);
  const queryKey = useMemo(
    () => ['session-orders', sessionToken || 'no-session', tenantSlug || 'no-tenant'],
    [sessionToken, tenantSlug],
  );

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!sessionToken || !tenantSlug) return [];
      const res = await publicApi.get(`/${tenantSlug}/sessions/${sessionToken}/orders`);
      return res.data;
    },
    enabled: Boolean(sessionToken && tenantSlug && !shouldRedirectToTracker),
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 15,
  });

  const orders = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const activeOrders = useMemo(() => orders.filter((order: any) => isActiveOrder(order.status)), [orders]);
  const historyOrders = useMemo(() => orders.filter((order: any) => !isActiveOrder(order.status)), [orders]);

  const latestCompletedWithoutReview = useMemo(
    () => historyOrders.find((order: any) => order.status === 'RECEIVED' && !order.hasReview),
    [historyOrders],
  );

  const feedbackMutation = useMutation({
    mutationFn: async ({ rating, feedback }: { rating: number; feedback: string }) => {
      if (!latestCompletedWithoutReview?.id) {
        throw new Error('No completed order available for review');
      }
      return publicApi.post(`/orders/${latestCompletedWithoutReview.id}/feedback`, { rating, feedback });
    },
    onSuccess: () => {
      setRating(0);
      setFeedback('');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: any) => {
      alert(error?.response?.data?.error || error?.message || 'Unable to submit feedback right now.');
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ orderId, status, version }: { orderId: string; status: string; version: number }) => {
      return publicApi.patch(`/${tenantSlug}/orders/${orderId}/status`, { status, sessionToken, version });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: any) => {
      alert(error?.response?.data?.error || error?.message || 'Unable to update order status.');
    },
  });

  useEffect(() => {
    if (!tenantSlug || !sessionToken || shouldRedirectToTracker) return;

    const socket = io(getSocketUrl(), {
      auth: { tenantSlug, sessionToken, client: 'customer-status' },
      transports: ['websocket'],
      rememberUpgrade: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 10000,
    });

    const upsertOrderInCache = (incomingOrder: any) => {
      if (!incomingOrder) return;
      // Read previous state to decide if we should notify
      const prev = (queryClient.getQueryData(queryKey) as any[]) || [];
      const existing = prev.find((o: any) => o.id === incomingOrder.id);

      try {
        if (existing && existing.status !== incomingOrder.status) {
          if (incomingOrder.status === 'READY') {
            notify({ title: 'Order Ready', message: `Order is ready, pick your order.`, type: 'success' });
          } else if (incomingOrder.status === 'PREPARING') {
            notify({ title: 'Order Update', message: `Your order is being prepared.`, type: 'info' });
          } else if (incomingOrder.status === 'SERVED' || incomingOrder.status === 'RECEIVED') {
            notify({ title: 'Order Served', message: `Order #${String(incomingOrder.orderNumber || incomingOrder.id).slice(-6).toUpperCase()} served.`, type: 'success' });
          }
        }
      } catch (e) {
        // ignore notification errors
      }

      queryClient.setQueryData(queryKey, (old: any) => {
        const safe = Array.isArray(old) ? old : [];
        const hasMatch = safe.some((order: any) => order.id === incomingOrder.id);
        if (!hasMatch) return [...safe, incomingOrder];
        return safe.map((order: any) => (order.id === incomingOrder.id ? incomingOrder : order));
      });
    };

    const handleSessionFinished = (payload?: { sessionId?: string }) => {
      if (payload?.sessionId && payload.sessionId !== sessionToken) return;
      queryClient.invalidateQueries({ queryKey });
      navigate(`/order/${tenantSlug}/history`);
    };
    const handleSessionCompleted = (payload?: { sessionId?: string }) => {
      if (payload?.sessionId && payload.sessionId !== sessionToken) return;
      queryClient.invalidateQueries({ queryKey });
      navigate(`/order/${tenantSlug}/history`);
    };

    socket.on('order:new', upsertOrderInCache);
    socket.on('order:update', upsertOrderInCache);
    // generic waiter notifications if emitted by backend
    socket.on('waiter:call', (payload: any) => {
      try {
        if (payload?.type) {
          notify?.({ title: 'Staff Alert', message: `${payload.type} request received.`, type: 'info' });
        } else {
          notify?.({ title: 'Staff Alert', message: `A waiter has been called for your table.`, type: 'info' });
        }
      } catch (e) {}
    });
    socket.on('session:finished', handleSessionFinished);
    socket.on('session:completed', handleSessionCompleted);

    return () => {
      socket.off('order:new', upsertOrderInCache);
      socket.off('order:update', upsertOrderInCache);
      socket.off('session:finished', handleSessionFinished);
      socket.off('session:completed', handleSessionCompleted);
      socket.disconnect();
    };
  }, [navigate, notify, queryClient, queryKey, sessionToken, shouldRedirectToTracker, tenantSlug]);

  useEffect(() => {
    if (activeOrders.length === 0 && historyOrders.length > 0) {
      setTab('HISTORY');
    }
  }, [activeOrders.length, historyOrders.length]);

  const getETA = (order: any) => {
    if (!order?.createdAt || ['READY', 'SERVED', 'RECEIVED'].includes(order.status)) return null;
    const items = Array.isArray(order.items) ? order.items : [];
    const totalPrepMin = items.reduce(
      (sum: number, item: any) => sum + (Number(item?.menuItem?.prepTimeMinutes) || 12),
      0,
    );
    const avgPrepMin = items.length > 0 ? Math.ceil(totalPrepMin / items.length) + 5 : 15;
    const orderTime = new Date(order.createdAt).getTime();
    return Math.max(0, Math.ceil((orderTime + avgPrepMin * 60000 - Date.now()) / 60000));
  };

  const shareWhatsApp = (order: any) => {
    const items = Array.isArray(order.items) ? order.items : [];
    const itemLines = items.map((item: any) => `- ${item?.name || 'Item'} x${item?.quantity || 1}`).join('\n');
    const message = `RestoFlow Order Summary\n\nOrder: ${order.orderNumber || ''}\nTable: ${order.table?.name || 'Takeaway'}\n\n${itemLines}\n\nTotal: ${formatINR(order.totalAmount || 0)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const maxOrderRank = useMemo(
    () => (orders.length > 0 ? Math.max(...orders.map((order: any) => getOrderRank(order.status))) : 0),
    [orders],
  );
  const currentStepRank = activeOrders.length === 0 && historyOrders.some((order: any) => order.status === 'RECEIVED')
    ? 6
    : maxOrderRank;
  const nextPendingRank = (STEPS.find((step) => currentStepRank < step.rank)?.rank || STEPS[STEPS.length - 1].rank);
  const currentStepMessage =
    currentStepRank >= 6
      ? 'Checkout completed'
      : currentStepRank >= 5
        ? 'Served, finalizing checkout'
        : currentStepRank >= 3
          ? 'Food is ready, waiter pickup in progress'
          : currentStepRank >= 2
            ? 'Kitchen is preparing your order'
            : currentStepRank >= 1
              ? 'Order accepted by restaurant'
              : 'Waiting for kitchen acceptance';
  const firstTableId = activeOrders[0]?.tableId || orders[0]?.tableId;
  const addMoreUrl = firstTableId ? `/order/${tenantSlug}/${firstTableId}/menu` : `/order/${tenantSlug}`;
  const brandColor = orders[0]?.tenant?.primaryColor || '#f97316';

  useEffect(() => {
    if (tenantSlug && firstTableId) {
      setLastTableIdForTenant(tenantSlug, firstTableId);
    }
  }, [firstTableId, tenantSlug]);

  if (shouldRedirectToTracker && tenantSlug && sessionToken) {
    return <Navigate to={`/order/${tenantSlug}/session/${sessionToken}`} replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div
          className="w-10 h-10 border-4 rounded-full animate-spin"
          style={{ borderColor: 'var(--brand-soft)', borderTopColor: 'var(--brand)' }}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen transition-colors duration-400"
      style={{
        background: 'var(--bg)',
        '--brand': brandColor,
        paddingBottom: 'calc(var(--customer-nav-space) + var(--customer-page-action-height) + 2rem)',
      } as any}
    >
      <div className="sticky top-0 z-40 border-b px-4 py-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'transparent', color: 'var(--text-1)' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--text-1)' }}>Orders</h1>
            <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{activeOrders.length} active</p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-screen-sm flex-col gap-8 px-6 py-8">
        <div className="flex rounded-2xl border p-1.5" style={{ background: 'var(--surface-3)', borderColor: 'var(--border)' }}>
          <button
            onClick={() => setTab('TRACKING')}
            className={`flex-1 rounded-xl py-3 text-sm font-black transition-all ${tab === 'TRACKING' ? 'scale-[1.02] shadow-xl' : 'opacity-40 grayscale-[0.5]'}`}
            style={{
              background: tab === 'TRACKING' ? 'var(--surface)' : 'transparent',
              color: tab === 'TRACKING' ? 'var(--text-1)' : 'var(--text-3)',
            }}
          >
            Tracking
          </button>
          <button
            onClick={() => setTab('HISTORY')}
            className={`flex-1 rounded-xl py-3 text-sm font-black transition-all ${tab === 'HISTORY' ? 'scale-[1.02] shadow-xl' : 'opacity-40 grayscale-[0.5]'}`}
            style={{
              background: tab === 'HISTORY' ? 'var(--surface)' : 'transparent',
              color: tab === 'HISTORY' ? 'var(--text-1)' : 'var(--text-3)',
            }}
          >
            History
          </button>
        </div>

        {tab === 'TRACKING' && (
          <div className="space-y-8 fade-in">
            {activeOrders.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-center">
                <div
                  className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl"
                  style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
                >
                  <Bell size={40} />
                </div>
                <h2 className="mb-2 text-2xl font-black" style={{ color: 'var(--text-1)' }}>
                  No active orders
                </h2>
                <p className="mb-8 font-medium" style={{ color: 'var(--text-3)' }}>
                  All your orders are completed or cancelled.
                </p>
                <button
                  onClick={() => navigate(`/order/${tenantSlug}`)}
                  className="rounded-3xl bg-[#1a1c23] px-8 py-4 font-black text-white transition-all hover:bg-black active:scale-95"
                >
                  Go to Menu
                </button>
              </div>
            ) : (
              <>
                <div
                  className="relative overflow-hidden rounded-[40px] border p-8 shadow-2xl"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <h2 className="mb-8 text-center text-2xl font-black" style={{ color: 'var(--text-1)' }}>
                    {currentStepMessage}
                  </h2>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {STEPS.map((step) => {
                      const completed = currentStepRank >= step.rank;
                      const current = !completed && step.rank === nextPendingRank;
                      return (
                        <div
                          key={step.label}
                          className={`relative overflow-hidden rounded-2xl border p-3 transition-all ${current ? 'scale-[1.01] shadow-xl' : ''}`}
                          style={{
                            borderColor: completed || current ? 'rgba(59,130,246,0.35)' : 'var(--border)',
                            background: completed || current ? 'var(--brand-soft)' : 'var(--surface-3)',
                          }}
                        >
                          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${step.glow} ${completed || current ? 'opacity-100' : 'opacity-0'} transition-opacity`} />
                          <div
                            className="relative z-10 mb-2 flex h-10 w-10 items-center justify-center rounded-xl"
                            style={{
                              background: completed ? 'var(--brand)' : current ? 'rgba(59,130,246,0.16)' : 'rgba(148,163,184,0.2)',
                              color: completed ? '#fff' : current ? 'var(--brand)' : 'var(--text-3)',
                            }}
                          >
                            {step.icon}
                          </div>
                          <span className="relative z-10 block text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--text-1)' }}>
                            {step.label}
                          </span>
                          <span className="relative z-10 mt-1 block text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: completed ? 'var(--brand)' : 'var(--text-3)' }}>
                            {completed ? 'Done' : current ? 'In Progress' : 'Pending'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <h3 className="px-1 text-lg font-black" style={{ color: 'var(--text-1)' }}>
                    Order Details
                  </h3>
                  {activeOrders.map((order: any) => (
                    <div
                      key={order.id}
                      className="flex flex-col gap-5 rounded-3xl border p-6 shadow-sm"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="mb-1 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                            Order ID
                          </p>
                          <h4 className="text-lg font-black" style={{ color: 'var(--text-1)' }}>
                            #{String(order.orderNumber || order.id).slice(-6).toUpperCase()}
                          </h4>
                        </div>
                        <div className={`rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${statusBadgeClass(order.status)}`}>
                          {order.status}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {order.items?.map((item: any) => (
                          <div key={item.id} className="flex justify-between text-sm font-bold">
                            <span style={{ color: 'var(--text-2)' }}>
                              <span style={{ color: 'var(--brand)' }}>{item.quantity}x </span>
                              {item.name}
                            </span>
                            <span style={{ color: 'var(--text-1)' }}>{formatINR(item.totalPrice)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col gap-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Timer size={14} style={{ color: 'var(--text-3)' }} />
                            <span className="text-xs font-black uppercase" style={{ color: 'var(--text-3)' }}>
                              {getETA(order) ? `~${getETA(order)} min` : order.status === 'READY' ? 'Ready for Pickup' : 'Soon'}
                            </span>
                          </div>
                          <button
                            onClick={() => shareWhatsApp(order)}
                            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#25D366] transition-all active:scale-95"
                          >
                            <Share2 size={12} />
                            Share Bill
                          </button>
                        </div>
                        
                        {order.status === 'READY' && (
                          <button
                            onClick={() => statusMutation.mutate({ orderId: order.id, status: 'SERVED', version: order.version })}
                            disabled={statusMutation.isPending}
                            className="w-full py-3.5 rounded-2xl bg-[#1a1c23] text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-black/20 hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 size={16} className="text-emerald-400" />
                            {statusMutation.isPending ? 'Updating...' : "I've Received My Order"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'HISTORY' && (
          <div className="space-y-6 fade-in">
            {latestCompletedWithoutReview && (
              <div
                className="relative overflow-hidden rounded-[40px] border p-8 text-center shadow-2xl"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <h3 className="mb-2 text-2xl font-black" style={{ color: 'var(--text-1)' }}>
                  How was your meal?
                </h3>
                <p className="mb-8 font-medium" style={{ color: 'var(--text-3)' }}>
                  Share your feedback to help us improve.
                </p>

                <div className="mb-10 flex justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className="transition-transform hover:scale-110 active:scale-75"
                    >
                      <Star size={44} className={rating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
                    </button>
                  ))}
                </div>

                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Tell us what you loved..."
                  className="mb-6 min-h-[120px] w-full rounded-2xl p-5 font-bold outline-none transition-all placeholder:font-medium"
                  style={{ background: 'var(--surface-3)', border: '2px solid var(--border)', color: 'var(--text-1)' }}
                />

                <button
                  onClick={() => feedbackMutation.mutate({ rating, feedback })}
                  disabled={rating === 0 || feedbackMutation.isPending}
                  className="w-full rounded-2xl bg-[#1a1c23] py-4 font-black text-white shadow-xl transition-all active:scale-[0.98] disabled:opacity-40"
                >
                  {feedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
                </button>
                <button
                  onClick={() => {
                    setRating(0);
                    setFeedback('');
                  }}
                  className="mt-6 text-[10px] font-black uppercase tracking-widest opacity-30"
                >
                  Skip Review
                </button>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="px-1 text-lg font-black" style={{ color: 'var(--text-1)' }}>
                Order Archive
              </h3>
              {historyOrders.map((order: any) => (
                <div
                  key={order.id}
                  className="group relative overflow-hidden rounded-3xl border p-6 shadow-sm"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-base font-black" style={{ color: 'var(--text-1)' }}>
                        Order #{String(order.orderNumber || order.id).slice(-6).toUpperCase()}
                      </h4>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                        {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black" style={{ color: 'var(--text-1)' }}>
                        {formatINR(order.totalAmount)}
                      </p>
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Delivered</span>
                    </div>
                  </div>
                  <div className="border-t pt-4 text-xs font-medium italic" style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                    {order.items?.map((item: any) => item.name).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="fixed left-0 right-0 z-[60] p-6 pointer-events-none" style={{ bottom: 'var(--customer-action-bottom)' }}>
        <div className="mx-auto max-w-screen-sm pointer-events-auto">
          <button
            onClick={() => navigate(addMoreUrl)}
            className="flex w-full items-center justify-center gap-3 rounded-3xl py-[1.125rem] font-black text-white shadow-2xl transition-all active:scale-[0.98]"
            style={{ background: 'var(--brand)' }}
          >
            <UtensilsCrossed size={18} strokeWidth={3} />
            Add More Dishes
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
