import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { publicApi } from '../lib/api';
import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { ArrowLeft, Star, CheckCircle2, Clock3, ChefHat, Bell, PlusCircle, Share2, Timer } from 'lucide-react';
import { formatINR } from '../lib/currency';
import { getSocketUrl } from '../lib/network';

interface StepConfig {
  label: string;
  icon: React.ReactNode;
  statuses: string[];
}

const STEPS: StepConfig[] = [
  { label: 'Order Placed', icon: <Clock3 size={20} />, statuses: ['NEW'] },
  { label: 'Cooking', icon: <ChefHat size={20} />, statuses: ['ACCEPTED', 'PREPARING'] },
  { label: 'Ready', icon: <Bell size={20} />, statuses: ['READY', 'SERVED'] },
  { label: 'Done', icon: <CheckCircle2 size={20} />, statuses: ['RECEIVED'] },
];

function getStepIndex(status: string) {
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i].statuses.includes(status)) return i;
  }
  return 0;
}

function isActiveOrder(status?: string) {
  return status !== 'RECEIVED' && status !== 'CANCELLED';
}

function statusBadgeClass(status?: string) {
  switch (status) {
    case 'NEW':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'ACCEPTED':
    case 'PREPARING':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'READY':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'RECEIVED':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

export function OrderStatus() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [tab, setTab] = useState<'TRACKING' | 'HISTORY'>('TRACKING');
  const sessionToken = localStorage.getItem('restoflow_session') || localStorage.getItem('dineflow_session');

  const { data, isLoading } = useQuery({
    queryKey: ['session-orders', sessionToken, tenantSlug],
    queryFn: async () => {
      const res = await publicApi.get(`/${tenantSlug}/sessions/${sessionToken}/orders`);
      return res.data;
    },
    refetchInterval: 2500,
    refetchIntervalInBackground: true,
    staleTime: 1000,
  });

  const orders = Array.isArray(data) ? data : [];

  useEffect(() => {
    if (!tenantSlug || !sessionToken) return;

    const socket = io(getSocketUrl(), {
      auth: { tenantSlug, sessionToken },
    });

    socket.on('order:new', (created: any) => {
      queryClient.setQueryData(['session-orders', sessionToken, tenantSlug], (old: any[] = []) => {
        if (old.some((order) => order.id === created.id)) return old;
        return [created, ...old];
      });
    });

    socket.on('order:update', (updated: any) => {
      queryClient.setQueryData(['session-orders', sessionToken, tenantSlug], (old: any[] = []) => {
        return old.map((o: any) => (o.id === updated.id ? updated : o));
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionToken, tenantSlug, queryClient]);

  const activeOrders = useMemo(() => orders.filter((o: any) => isActiveOrder(o.status)), [orders]);
  const historyOrders = useMemo(() => orders.filter((o: any) => !isActiveOrder(o.status)), [orders]);

  // USP 4: ETA calculation
  const getETA = (order: any) => {
    if (!order?.createdAt || order.status === 'READY' || order.status === 'SERVED' || order.status === 'RECEIVED') return null;
    const items = Array.isArray(order.items) ? order.items : [];
    const totalPrepMin = items.reduce((sum: number, i: any) => sum + (Number(i?.menuItem?.prepTimeMinutes) || 8), 0);
    const avgPrepMin = items.length > 0 ? Math.ceil(totalPrepMin / items.length) + Math.min(items.length * 2, 10) : 15;
    const orderTime = new Date(order.createdAt).getTime();
    const etaTime = orderTime + avgPrepMin * 60 * 1000;
    const remainingMs = etaTime - Date.now();
    return Math.max(0, Math.ceil(remainingMs / 60000));
  };

  // USP 6: WhatsApp receipt
  const shareWhatsApp = (order: any) => {
    const items = Array.isArray(order.items) ? order.items : [];
    const itemLines = items.map((i: any) => `- ${i?.name || 'Item'} x${i?.quantity || 1}`).join('\n');
    const msg = `🍽 *RestoFlow Order*\n\nOrder: ${order.orderNumber || ''}\nTable: ${order.table?.name || 'N/A'}\n\n${itemLines}\n\n*Total: ${formatINR(order.totalAmount || 0)}*\n\nThank you! 🙏`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };
  const latestCompletedWithoutReview = useMemo(
    () => historyOrders.find((o: any) => o.status === 'RECEIVED' && !o.hasReview),
    [historyOrders],
  );

  useEffect(() => {
    if (activeOrders.length === 0 && historyOrders.length > 0) {
      setTab('HISTORY');
    }
  }, [activeOrders.length, historyOrders.length]);

  const statusesLive = activeOrders.length > 0 ? activeOrders : historyOrders.filter((o: any) => o.status === 'RECEIVED');
  const currentStepIndex = statusesLive.length > 0 ? Math.max(...statusesLive.map((o: any) => getStepIndex(o.status))) : 0;
  const latestOrder = activeOrders[0] || historyOrders[0] || null;
  const trackingTotal = activeOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);
  const historyTotal = historyOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);

  const addMoreUrl = (() => {
    const fromActive = activeOrders[0]?.tableId;
    const fromHistory = historyOrders[0]?.tableId;
    const tableId = fromActive || fromHistory;
    if (!tenantSlug) return '/';
    return tableId ? `/order/${tenantSlug}/${tableId}/menu` : `/order/${tenantSlug}`;
  })();

  const feedbackMutation = useMutation({
    mutationFn: (data: any) => {
      if (!latestCompletedWithoutReview?.id) throw new Error('No completed order found for feedback');
      return publicApi.post(`/orders/${latestCompletedWithoutReview.id}/feedback`, data);
    },
    onSuccess: async () => {
      setRating(0);
      setFeedback('');
      setTab('HISTORY');
      await queryClient.invalidateQueries({ queryKey: ['session-orders', sessionToken, tenantSlug] });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-16 px-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 p-8 flex flex-col items-center gap-5">
          <div className="w-36 h-6 bg-gray-100 rounded-full shimmer"></div>
          <div className="w-48 h-10 bg-gray-200 rounded-xl shimmer"></div>
          <div className="w-full h-24 bg-gray-100 rounded-2xl shimmer"></div>
          <div className="w-full h-20 bg-gray-100 rounded-2xl shimmer"></div>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 gap-4">
        <div className="text-5xl">🍽️</div>
        <h2 className="text-xl font-black text-gray-800">No orders yet</h2>
        <p className="text-gray-400 text-sm text-center">Start ordering from this restaurant to see tracking and history here.</p>
        <button
          onClick={() => {
            if (tenantSlug) navigate(`/order/${tenantSlug}`);
            else navigate(-1);
          }}
          className="mt-2 bg-orange-500 text-white font-bold px-6 py-3 rounded-2xl shadow-md shadow-orange-500/20 active:scale-95 transition-all"
        >
          Go to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg-primary)] text-[color:var(--text-primary)] pb-20 fade-in transition-colors duration-300">
      <div className="bg-[color:var(--bg-secondary)] border-b border-[color:var(--border-primary)] px-5 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm transition-colors duration-300">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center bg-[color:var(--bg-primary)] border border-[color:var(--border-primary)] rounded-full text-[color:var(--text-secondary)] active:bg-gray-200">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="font-black text-[color:var(--text-primary)] text-base">My Orders</h1>
          <p className="text-xs text-[color:var(--text-secondary)] font-medium">
            {activeOrders.length} active · {historyOrders.length} in history
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-2 bg-[color:var(--bg-primary)] border border-[color:var(--border-primary)] rounded-2xl p-1">
          <button
            onClick={() => setTab('TRACKING')}
            className={`rounded-xl py-2.5 text-sm font-bold transition-all ${tab === 'TRACKING' ? 'bg-[color:var(--bg-secondary)] text-[color:var(--text-primary)] shadow-sm' : 'text-[color:var(--text-secondary)]'}`}
          >
            Tracking
          </button>
          <button
            onClick={() => setTab('HISTORY')}
            className={`rounded-xl py-2.5 text-sm font-bold transition-all ${tab === 'HISTORY' ? 'bg-[color:var(--bg-secondary)] text-[color:var(--text-primary)] shadow-sm' : 'text-[color:var(--text-secondary)]'}`}
          >
            Order History
          </button>
        </div>

        <button
          onClick={() => navigate(addMoreUrl)}
          className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-black py-3.5 rounded-2xl shadow-lg shadow-orange-500/25 transition-all"
        >
          <PlusCircle size={18} />
          Add More Food
        </button>

        {tab === 'TRACKING' && (
          <>
            <div className="bg-[color:var(--bg-secondary)] rounded-[32px] border border-[color:var(--border-primary)] shadow-xl shadow-gray-200/10 p-8 overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-[color:var(--bg-primary)]">
                <div 
                  className="h-full bg-orange-500 transition-all duration-1000 ease-in-out"
                  style={{ width: `${(currentStepIndex / (STEPS.length - 1)) * 100}%` }}
                />
              </div>

              <h2 className="font-black text-[color:var(--text-primary)] text-xl mb-2 text-center mt-2">
                {currentStepIndex === 0 && 'Waiting for the kitchen...'}
                {currentStepIndex === 1 && 'Your food is being prepared'}
                {currentStepIndex === 2 && 'Order is ready to serve!'}
                {currentStepIndex === 3 && 'Order completed!'}
              </h2>

              {/* ETA Timer */}
              {latestOrder && getETA(latestOrder) !== null && getETA(latestOrder)! > 0 && currentStepIndex < 2 && (
                <div className="flex items-center justify-center gap-2 mb-6 text-orange-600">
                  <Timer size={16} className="animate-pulse" />
                  <span className="text-sm font-black">~{getETA(latestOrder)} min remaining</span>
                </div>
              )}
              {latestOrder && (getETA(latestOrder) === 0 || currentStepIndex >= 2) && currentStepIndex < 3 && (
                <div className="flex items-center justify-center gap-2 mb-6 text-emerald-600">
                  <span className="text-sm font-black">🔥 Almost there!</span>
                </div>
              )}
...
              <div className="relative flex justify-between items-start px-2">
                {STEPS.map((step, idx) => {
                  const active = idx <= currentStepIndex;
                  const current = idx === currentStepIndex;
                  return (
                    <div key={idx} className="flex flex-col items-center gap-3 w-16 group">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 transform ${
                          current 
                            ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/40 scale-110 rotate-3' 
                            : active 
                              ? 'bg-orange-100 text-orange-600' 
                              : 'bg-gray-50 text-gray-300'
                        }`}
                      >
                        {step.icon}
                      </div>
                      <span className={`text-[11px] font-black tracking-tight text-center leading-none ${active ? 'text-gray-900' : 'text-gray-300'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {activeOrders.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                <p className="font-bold text-gray-800">No active orders right now</p>
                <p className="text-sm text-gray-400 mt-1">Completed orders are available in Order History.</p>
              </div>
            )}

            {activeOrders.map((order: any) => (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex justify-between items-start mb-4 gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-gray-900">Ticket #{String(order.orderNumber || order.id).replace('#', '').slice(-6).toUpperCase()}</p>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">
                      {order.items?.length || 0} items · {order.table ? `Table ${order.table.name}` : 'Takeaway'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase ${statusBadgeClass(order.status)}`}>
                      {order.status}
                    </span>
                    <p className="font-black text-orange-500 text-base mt-2">{formatINR(order.totalAmount || 0)}</p>
                  </div>
                </div>
                <div className="text-xs font-medium text-gray-500 leading-relaxed border-t border-gray-50 pt-3 space-y-1">
                  {Array.isArray(order.items) &&
                    order.items.map((i: any) => (
                      <p key={i.id}>
                        {i.quantity}x {i.menuItem?.name || i.name}
                      </p>
                    ))}
                </div>
                {/* ETA + Share */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  {getETA(order) !== null && getETA(order)! > 0 ? (
                    <span className="text-xs font-black text-orange-500 flex items-center gap-1">
                      <Timer size={12} /> ~{getETA(order)} min
                    </span>
                  ) : (
                    <span className="text-xs font-black text-emerald-500">Ready soon!</span>
                  )}
                  <button
                    onClick={() => shareWhatsApp(order)}
                    className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-full hover:bg-green-100 transition-colors"
                  >
                    <Share2 size={12} /> WhatsApp
                  </button>
                </div>
              </div>
            ))}

            {activeOrders.length > 1 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex justify-between items-center">
                <span className="font-bold text-gray-600">Tracking total</span>
                <span className="font-black text-gray-900 text-xl">{formatINR(trackingTotal)}</span>
              </div>
            )}
          </>
        )}

        {tab === 'HISTORY' && (
          <>
            {latestCompletedWithoutReview && (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col items-center text-center">
                <h2 className="text-xl font-black text-gray-900 mb-1">Rate your last order</h2>
                <p className="text-gray-400 text-sm mb-6">Share your feedback after completing the meal.</p>

                <div className="flex gap-2 mb-6">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setRating(star)} className="focus:outline-none hover:scale-110 transition-transform active:scale-95">
                      <Star size={40} className={rating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
                    </button>
                  ))}
                </div>

                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Tell us about the food and service (optional)"
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-sm font-medium text-gray-700 focus:border-orange-400 outline-none resize-none mb-4 min-h-[90px] transition-colors"
                />

                <button
                  onClick={() => feedbackMutation.mutate({ rating, feedback })}
                  disabled={rating === 0 || feedbackMutation.isPending}
                  className="w-full bg-orange-500 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-orange-500/20 disabled:opacity-40 transition-all active:scale-[0.98] mb-2"
                >
                  {feedbackMutation.isPending ? 'Submitting...' : 'Submit Review'}
                </button>
                <button onClick={() => feedbackMutation.mutate({ rating: null, feedback: null })} className="text-gray-400 text-sm font-semibold hover:text-gray-600 transition-colors py-2">
                  Skip for now
                </button>
              </div>
            )}

            {historyOrders.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                <p className="font-bold text-gray-800">No history yet</p>
                <p className="text-sm text-gray-400 mt-1">Once an order is completed, it will appear here for this restaurant.</p>
              </div>
            )}

            {historyOrders.map((order: any) => (
              <div key={order.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="absolute top-0 right-0 py-1 px-4 bg-gray-900 text-[10px] font-black text-white rounded-bl-xl tracking-widest uppercase">
                  Receipt
                </div>
                
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="font-black text-gray-900 text-lg leading-none">Order #{String(order.orderNumber || order.id).replace('#', '').slice(-6).toUpperCase()}</h4>
                    <p className="text-xs text-gray-400 font-bold mt-1.5 flex items-center gap-1.5 uppercase tracking-wide">
                      <Clock3 size={12} /> {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest ${statusBadgeClass(order.status)}`}>
                    {order.status}
                  </div>
                </div>

                <div className="space-y-3 mb-6 relative">
                  <div className="absolute -left-6 -right-6 top-0 border-t border-gray-50 border-dashed" />
                  <div className="pt-4 space-y-2">
                    {Array.isArray(order.items) && order.items.map((i: any) => (
                      <div key={i.id} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 font-bold text-xs">{i.quantity}x</span>
                          <span className="font-bold text-gray-700">{i.menuItem?.name || i.name}</span>
                        </div>
                        <span className="font-bold text-gray-900">{formatINR(i.totalPrice || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-5 border-t-2 border-gray-100 border-dashed">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Grand Total</span>
                  <span className="text-xl font-black text-gray-900">{formatINR(order.totalAmount || 0)}</span>
                </div>
              </div>
            ))}

            {historyOrders.length > 1 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex justify-between items-center">
                <span className="font-bold text-gray-600">History total</span>
                <span className="font-black text-gray-900 text-xl">{formatINR(historyTotal)}</span>
              </div>
            )}
          </>
        )}

        <div className="text-center pt-2">
          <p className="text-xs text-gray-300 font-medium">
            Powered by <span className="font-bold text-gray-400">RestoFlow</span>
          </p>
        </div>
      </div>
    </div>
  );
}
