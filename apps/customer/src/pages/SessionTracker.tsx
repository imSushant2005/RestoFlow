import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  LayoutDashboard,
  Plus,
  Receipt,
  RotateCcw,
  Star,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { publicApi } from '../lib/api';
import { formatINR } from '../lib/currency';
import { getSocketUrl } from '../lib/network';
import {
  CUSTOMER_PROGRESS_STEPS,
  getCustomerProcessSummary,
  getCustomerStageRank,
  getCustomerStatusMeta,
} from '../lib/orderPresentation';
import { useCartStore } from '../store/cartStore';
import { getActiveSessionForTenant, getSessionAccessTokenForTenant, setLastTableIdForTenant } from '../lib/tenantStorage';

type SocketStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

function getOrderRank(status?: string) {
  return getCustomerStageRank(status);
}

function withSessionMetrics(next: any) {
  const safeOrders = Array.isArray(next?.orders) ? next.orders : [];
  const activeOrders = safeOrders.filter((order: any) => order?.status !== 'CANCELLED');
  const runningTotal = activeOrders.reduce((sum: number, order: any) => sum + Number(order?.totalAmount || 0), 0);
  const itemCount = activeOrders.reduce(
    (sum: number, order: any) =>
      sum +
      (Array.isArray(order?.items)
        ? order.items.reduce((itemSum: number, item: any) => itemSum + Number(item?.quantity || 0), 0)
        : 0),
    0,
  );

  return {
    ...next,
    orders: activeOrders,
    runningTotal,
    itemCount,
  };
}

export function SessionTracker() {
  const { tenantSlug, sessionId: routeSessionId } = useParams();
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('connecting');

  const refreshTimerRef = useRef<number | null>(null);
  const sessionId =
    routeSessionId || getActiveSessionForTenant(tenantSlug);
  const sessionAccessToken = getSessionAccessTokenForTenant(tenantSlug);
  const tableId = session?.tableId;

  const fetchSession = useCallback(async () => {
    if (!sessionId || !tenantSlug) {
      setLoading(false);
      return;
    }

    try {
      const res = await publicApi.get(`/${tenantSlug}/sessions/${sessionId}`);
      setSession(withSessionMetrics(res.data));
    } catch (err) {
      console.error('[SESSION_FETCH_ERROR]', err);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId, tenantSlug]);

  const scheduleRefresh = useCallback(
    (delayMs = 220) => {
      if (!sessionId || !tenantSlug) return;
      if (refreshTimerRef.current != null) return;
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        void fetchSession();
      }, delayMs);
    },
    [fetchSession, sessionId, tenantSlug],
  );

  const upsertOrder = useCallback(
    (incomingOrder: any) => {
      if (!incomingOrder || incomingOrder.diningSessionId !== sessionId) return;
      setSession((prev: any) => {
        if (!prev) return prev;
        const existingOrders = Array.isArray(prev.orders) ? prev.orders : [];
        const hasMatch = existingOrders.some((order: any) => order.id === incomingOrder.id);
        const nextOrders = hasMatch
          ? existingOrders.map((order: any) => (order.id === incomingOrder.id ? incomingOrder : order))
          : [...existingOrders, incomingOrder];

        return withSessionMetrics({
          ...prev,
          orders: nextOrders,
        });
      });
    },
    [sessionId],
  );

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (tenantSlug && session?.tableId) {
      setLastTableIdForTenant(tenantSlug, session.tableId);
    }
  }, [session?.tableId, tenantSlug]);

  useEffect(() => {
    if (!sessionId || !tenantSlug || !sessionAccessToken) return;

    const socket = io(getSocketUrl(), {
      auth: { tenantSlug, sessionAccessToken, client: 'customer-session' },
      transports: ['websocket'],
      rememberUpgrade: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 10000,
    });

    socket.on('connect', () => {
      setSocketStatus('connected');
      scheduleRefresh(80);
    });

    socket.on('connect_error', () => {
      setSocketStatus('reconnecting');
    });

    socket.on('disconnect', () => {
      setSocketStatus('offline');
    });

    socket.on('order:new', (order: any) => {
      upsertOrder(order);
    });

    socket.on('order:update', (order: any) => {
      upsertOrder(order);
    });

    socket.on('session:update', (payload: { sessionId?: string; status?: string }) => {
      if (!payload?.sessionId || payload.sessionId !== sessionId) return;
      setSession((prev: any) => (prev ? { ...prev, sessionStatus: payload.status || prev.sessionStatus } : prev));
      scheduleRefresh(220);
    });

    socket.on('session:finished', (payload: { sessionId?: string; totalAmount?: number }) => {
      if (!payload?.sessionId || payload.sessionId !== sessionId) return;
      setSession((prev: any) =>
        prev
          ? {
              ...prev,
              sessionStatus: 'AWAITING_BILL',
              runningTotal: Number(payload.totalAmount || prev.runningTotal || 0),
            }
          : prev,
      );
      scheduleRefresh(120);
      navigate(`/order/${tenantSlug}/session/${sessionId}/bill`);
    });

    socket.on('session:completed', (payload: { sessionId?: string }) => {
      if (!payload?.sessionId || payload.sessionId !== sessionId) return;
      setSession((prev: any) => (prev ? { ...prev, sessionStatus: 'CLOSED' } : prev));
      scheduleRefresh(120);
      navigate(`/order/${tenantSlug}/session/${sessionId}/bill`);
    });

    return () => {
      if (refreshTimerRef.current != null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      socket.disconnect();
    };
  }, [navigate, scheduleRefresh, sessionAccessToken, sessionId, tenantSlug, upsertOrder]);

  const [error, setError] = useState<string | null>(null);

  const handleFinish = async () => {
    if (!sessionId || !tenantSlug) return;
    setError(null);
    
    if (!window.confirm('Request the final bill now? This will lock the table for billing and notify the staff.')) return;

    const orders = (session?.orders || []).filter((order: any) => order.status !== 'CANCELLED');
    if (orders.length === 0) {
      setError('You need at least one active order before requesting the bill.');
      return;
    }

    setFinishing(true);
    try {
      await publicApi.post(`/${tenantSlug}/sessions/${sessionId}/finish`);
      navigate(`/order/${tenantSlug}/session/${sessionId}/bill`);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to finish session';
      setError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setFinishing(false);
    }
  };


  const handleReorder = (order: any) => {
    if (!Array.isArray(order?.items) || order.items.length === 0) return;

    for (const item of order.items) {
      addItem({
        id: `reorder-${item.id}-${Date.now()}`,
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

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div
          className="w-10 h-10 border-4 rounded-full animate-spin"
          style={{ borderColor: 'var(--brand-soft)', borderTopColor: 'var(--brand)' }}
        />
      </div>
    );
  }

  if (!session) {
    return (
      <div
        className="min-h-[100dvh] flex flex-col items-center justify-center gap-6 p-10 text-center"
        style={{ background: 'var(--bg)' }}
      >
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
        >
          <RotateCcw size={40} />
        </div>
        <div>
          <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--text-1)' }}>
            No active session found
          </h2>
          <p className="font-medium" style={{ color: 'var(--text-3)' }}>
            We could not link you to a dining session. Try scanning the QR code again.
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="px-8 py-3.5 rounded-2xl font-black text-sm transition-all active:scale-95"
          style={{ background: 'var(--brand)', color: 'white' }}
        >
          Go Back
        </button>
      </div>
    );
  }

  const isAwaitingBill = session.sessionStatus === 'AWAITING_BILL';
  const isClosed = ['CLOSED', 'CANCELLED'].includes(session.sessionStatus);
  const brandColor = session.tenant?.primaryColor || '#f97316';
  const maxOrderRank = (session?.orders || []).reduce(
    (max: number, order: any) => Math.max(max, getOrderRank(order?.status)),
    0,
  );
  const processRank = session.sessionStatus === 'CLOSED' ? 4 : maxOrderRank;
  const nextPendingRank =
    CUSTOMER_PROGRESS_STEPS.find((step) => processRank < step.rank)?.rank ||
    CUSTOMER_PROGRESS_STEPS[CUSTOMER_PROGRESS_STEPS.length - 1].rank;
  const orderType = session.orders?.[0]?.orderType;
  const processSummary = getCustomerProcessSummary({
    orderType,
    stageRank: processRank,
    isAwaitingBill,
    isClosed,
  });
  const socketTone =
    socketStatus === 'connected'
      ? { label: 'Realtime live', className: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20' }
      : socketStatus === 'reconnecting' || socketStatus === 'connecting'
        ? { label: 'Realtime reconnecting', className: 'bg-amber-500/15 text-amber-500 border-amber-500/20' }
        : { label: 'Realtime offline', className: 'bg-red-500/15 text-red-500 border-red-500/20' };

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{
        background: 'var(--bg)',
        '--brand': brandColor,
        paddingBottom: 'calc(var(--customer-nav-space) + var(--customer-page-action-height) + 2rem)',
      } as any}
    >
      <div
        className="relative overflow-hidden px-6 pb-20 pt-12 rounded-b-[40px] shadow-2xl"
        style={{ background: 'var(--surface)' }}
      >
        <div
          className="absolute top-0 right-0 h-64 w-64 rounded-full opacity-10 blur-[100px]"
          style={{ background: 'var(--brand)' }}
        />

        <div className="relative z-10 mb-8 flex items-start justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90"
            style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
          >
            <X size={20} />
          </button>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${socketTone.className}`}
            >
              {socketTone.label}
            </span>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>
                Running Total
              </span>
              <span className="text-4xl font-black" style={{ color: 'var(--brand)' }}>
                {formatINR(session.runningTotal)}
              </span>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="text-3xl font-black tracking-tight mb-1" style={{ color: 'var(--text-1)' }}>
            {session.tenant?.businessName}
          </h1>
          <div className="mb-8 flex items-center gap-2">
            <LayoutDashboard size={14} style={{ color: 'var(--brand)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--text-3)' }}>
              {session.table?.name || 'Takeaway'} | {session.partySize} guests
            </span>
            <div className="h-1 w-1 rounded-full bg-gray-300" />
            <span className="text-xs font-black uppercase tracking-widest text-emerald-500">Live</span>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
              Order Progress
            </p>
            <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>
              {processSummary}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CUSTOMER_PROGRESS_STEPS.map((step) => {
                const completed = processRank >= step.rank;
                const active = !completed && step.rank === nextPendingRank;
                const Icon = step.icon;
                return (
                  <div
                    key={step.label}
                    className={`relative overflow-hidden rounded-2xl border p-2.5 transition-all ${active ? 'scale-[1.01] shadow-xl' : ''}`}
                    style={{
                      borderColor: completed || active ? 'rgba(59,130,246,0.35)' : 'var(--border)',
                      background: completed || active ? 'var(--brand-soft)' : 'var(--surface-3)',
                    }}
                  >
                    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${step.tone} ${completed || active ? 'opacity-100' : 'opacity-0'} transition-opacity`} />
                    <div className="relative z-10 mb-1 flex items-center gap-2">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-lg"
                        style={{
                          background: completed ? 'var(--brand)' : active ? 'rgba(59,130,246,0.16)' : 'rgba(148,163,184,0.2)',
                          color: completed ? '#fff' : active ? 'var(--brand)' : 'var(--text-3)',
                        }}
                      >
                        <Icon size={14} />
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--text-1)' }}>
                        {step.label}
                      </span>
                    </div>
                    <p className="relative z-10 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: completed ? 'var(--brand)' : 'var(--text-3)' }}>
                      {completed ? 'Done' : active ? 'In Progress' : 'Pending'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-8 relative z-20 space-y-6">
        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex flex-col gap-1 items-center text-center fade-in">
             <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center mb-1">
                <X size={20} />
             </div>
             <p className="font-black text-sm uppercase">Bill Request Blocked</p>
             <p className="text-xs font-bold opacity-80">{error}</p>
             <button onClick={() => setError(null)} className="mt-2 text-[10px] font-black uppercase tracking-widest bg-red-500 text-white px-4 py-1.5 rounded-full">Dismiss</button>
          </div>
        )}

        {!isClosed && !error && (

          <div
            className="rounded-2xl border p-4 shadow-lg fade-in flex items-start gap-3"
            style={{ background: 'var(--glass-bg)', borderColor: 'var(--brand-soft)', backdropFilter: 'blur(20px)' }}
          >
            <div className="p-1.5 rounded-lg" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
              <Star size={14} fill="currentColor" />
            </div>
            <p className="text-[11px] font-bold leading-relaxed" style={{ color: 'var(--text-2)' }}>
              {isAwaitingBill
                ? 'Your final bill is ready. The restaurant will confirm payment, then this session will move into history.'
                : 'This is a live session. You can keep adding items until you tap Bill to request the final settlement.'}
            </p>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-lg font-black px-1" style={{ color: 'var(--text-1)' }}>
            Live Timeline
          </h3>

          {session.orders?.length === 0 && (
            <div className="py-20 text-center rounded-3xl border-2 border-dashed" style={{ borderColor: 'var(--border)' }}>
              <UtensilsCrossed size={40} className="mx-auto mb-4 opacity-20" />
              <p className="font-bold" style={{ color: 'var(--text-3)' }}>
                No dishes ordered yet
              </p>
            </div>
          )}

          {session.orders?.map((order: any, index: number) => {
            const status = getCustomerStatusMeta(order.status, order.orderType);
            const StatusIcon = status.icon;

            return (
              <div
                key={order.id}
                className="rounded-3xl border p-5 shadow-sm transition-all hover:shadow-xl"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'var(--surface-3)', color: 'var(--text-1)' }}
                    >
                      <Receipt size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>
                        {index === 0 ? 'Primary Order' : `Add-on Order #${index}`}
                        <span className="ml-2 text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100">
                          #{order.orderNumber || order.id?.slice(-6).toUpperCase()}
                        </span>
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${status.toneClass}`}>
                    <StatusIcon size={12} strokeWidth={3} />
                    {status.label}
                  </div>
                </div>

                <div className="mb-6 space-y-3">
                  {order.items?.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black"
                          style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
                        >
                          {item.quantity}
                        </span>
                        <span className="text-sm font-bold" style={{ color: 'var(--text-2)' }}>
                          {item.name}
                        </span>
                      </div>
                      <span className="text-sm font-black" style={{ color: 'var(--text-1)' }}>
                        {formatINR(item.totalPrice)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                  <button
                    onClick={() => handleReorder(order)}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                    style={{ color: 'var(--brand)' }}
                  >
                    <RotateCcw size={12} />
                    Reorder Again
                  </button>
                    <div className="text-right">
                      <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                        Order Total
                      </p>
                      <p className="font-black" style={{ color: 'var(--text-1)' }}>
                        {formatINR(order.totalAmount)}
                      </p>
                      <p className="mt-1 text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
                        {status.detail}
                      </p>
                    </div>
                  </div>
                </div>
            );
          })}
        </div>
      </div>

      {!isClosed && !isAwaitingBill && (
        <div className="fixed left-0 right-0 z-[60] p-6 pointer-events-none" style={{ bottom: 'var(--customer-action-bottom)' }}>
          <div className="mx-auto flex max-w-md gap-3 pointer-events-auto">
            <button
              onClick={() => {
                if (tableId && tableId !== 'undefined') navigate(`/order/${tenantSlug}/${tableId}/menu`);
                else navigate(`/order/${tenantSlug}`);
              }}
              className="flex-1 rounded-3xl py-4 font-black text-white shadow-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: 'var(--brand)' }}
            >
              <Plus size={18} strokeWidth={3} />
              Add More
            </button>
            <button
              onClick={handleFinish}
              disabled={finishing}
              className="flex-1 rounded-3xl bg-[#1a1c23] py-4 font-black text-white shadow-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {finishing ? (
                <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  <Receipt size={18} />
                  Bill
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {(isAwaitingBill || isClosed) && (
        <div className="fixed left-0 right-0 z-[60] p-6 pointer-events-none" style={{ bottom: 'var(--customer-action-bottom)' }}>
          <div className="mx-auto max-w-md pointer-events-auto">
            <button
              onClick={() => navigate(`/order/${tenantSlug}/session/${sessionId}/bill`)}
              className="w-full rounded-3xl bg-[#1a1c23] py-4 font-black text-white shadow-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Receipt size={18} />
              View Bill
            </button>
          </div>
        </div>
      )}

      <div className="py-10 text-center opacity-30">
        <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>
          Powered by RestoFlow
        </p>
      </div>
    </div>
  );
}
