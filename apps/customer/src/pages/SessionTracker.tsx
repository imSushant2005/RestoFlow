import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  CheckCircle2,
  CreditCard,
  ChevronRight,
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
import { buildCustomerThemeVars } from '../lib/customerTheme';
import { getSocketUrl } from '../lib/network';
import { getCustomerSessionLabel } from '../lib/serviceMode';
import {
  CUSTOMER_PROGRESS_STEPS,
  getCustomerProcessSummary,
  getCustomerStageRank,
  getCustomerStatusMeta,
} from '../lib/orderPresentation';
import { useCartStore } from '../store/cartStore';
import {
  clearCustomerContextForTenant,
  clearPendingMiniPaymentForTenant,
  getActiveSessionForTenant,
  getPendingMiniPaymentForTenant,
  getSessionAccessTokenForTenant,
  getTenantStorageItem,
  setLastTableIdForTenant,
  setPendingMiniPaymentForTenant,
} from '../lib/tenantStorage';

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

function speakTrackerReadyUpdate(message: string) {
  if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') return;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore unsupported browsers/devices.
  }
}

function TimerDisplay({ order }: { order: any }) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isOverdue, setIsOverdue] = useState(false);
  const [finalTime, setFinalTime] = useState<string | null>(null);

  useEffect(() => {
    if (!order) return;

    if (['SERVED', 'RECEIVED'].includes(order.status)) {
      const start = new Date(order.createdAt).getTime();
      const end = new Date(order.completedAt || order.servedAt || Date.now()).getTime();
      const diffMins = Math.round((end - start) / (60 * 1000));
      setFinalTime(`${diffMins} min`);
      return;
    }

    if (!['ACCEPTED', 'PREPARING', 'READY'].includes(order.status)) {
      setTimeLeft(null);
      return;
    }

    const startTime = new Date(order.acceptedAt || order.createdAt).getTime();
    const durationMins = order.estimatedPrepMins || 18;
    const targetTime = startTime + durationMins * 60 * 1000;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft(0);
        setIsOverdue(true);
      } else {
        setTimeLeft(Math.floor(diff / 1000));
        setIsOverdue(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [order]);

  if (finalTime) {
    return (
      <div className="rounded-3xl border border-dashed p-6 text-center shadow-sm" style={{ background: 'var(--surface-3)', borderColor: 'var(--brand)' }}>
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Service timing</p>
        <p className="text-xl font-black" style={{ color: 'var(--text-1)' }}>
          Completed in <span style={{ color: 'var(--brand)' }}>{finalTime}</span>
        </p>
      </div>
    );
  }

  if (timeLeft === null) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="rounded-3xl border border-dashed p-6 text-center shadow-sm transition-all" style={{ background: isOverdue ? 'rgba(239, 68, 68, 0.05)' : 'var(--surface-3)', borderColor: isOverdue ? 'rgba(239, 68, 68, 0.4)' : 'var(--brand)' }}>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-2">
        {isOverdue ? 'Kitchen update' : 'Estimated ready time'}
      </p>
      
      {isOverdue ? (
        <div className="space-y-2">
          <p className="line-clamp-2 px-4 text-sm font-bold leading-relaxed" style={{ color: 'var(--text-1)' }}>
            Your order is taking a little longer than planned. The kitchen is still working on it.
          </p>
          <p className="text-[11px] font-black uppercase tracking-widest text-red-500">Items coming soon</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black tabular-nums tracking-tighter" style={{ color: 'var(--text-1)' }}>
              {minutes}
            </span>
            <span className="text-lg font-black" style={{ color: 'var(--text-3)' }}>m</span>
            <span className="text-4xl font-black tabular-nums tracking-tighter" style={{ color: 'var(--text-1)' }}>
              {seconds < 10 ? `0${seconds}` : seconds}
            </span>
            <span className="text-lg font-black" style={{ color: 'var(--text-3)' }}>s</span>
          </div>
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Freshly preparing</p>
        </div>
      )}
    </div>
  );
}

export function SessionTracker() {
  const { tenantSlug, sessionId: routeSessionId } = useParams();
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const tenantPlan = useCartStore((state) => state.tenantPlan);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('connecting');
  const [miniPendingPayment, setMiniPendingPayment] = useState(() => getPendingMiniPaymentForTenant(tenantSlug));
  const [submittingMiniPayment, setSubmittingMiniPayment] = useState(false);
  const [miniVerificationNow, setMiniVerificationNow] = useState(() => Date.now());

  const refreshTimerRef = useRef<number | null>(null);
  const lastFetchStartedAtRef = useRef(0);
  const fetchInFlightRef = useRef(false);
  const orderStatusMapRef = useRef<Record<string, string>>({});
  const sessionId =
    routeSessionId || getActiveSessionForTenant(tenantSlug);
  const sessionAccessToken = getSessionAccessTokenForTenant(tenantSlug);
  const tableId = session?.tableId;
  const isMiniTokenFlow = String(tenantPlan || '').toUpperCase() === 'MINI';
  const isCounterEntry = getTenantStorageItem(tenantSlug, 'entry_mode') === 'counter';

  const persistMiniPendingPayment = useCallback(
    (next: ReturnType<typeof getPendingMiniPaymentForTenant>) => {
      setMiniPendingPayment(next);
      if (!tenantSlug) return;
      if (next) {
        setPendingMiniPaymentForTenant(tenantSlug, next);
      } else {
        clearPendingMiniPaymentForTenant(tenantSlug);
      }
    },
    [tenantSlug],
  );

  const fetchSession = useCallback(async () => {
    if (!sessionId || !tenantSlug) {
      setLoading(false);
      return;
    }

    if (fetchInFlightRef.current) {
      return;
    }

    try {
      fetchInFlightRef.current = true;
      lastFetchStartedAtRef.current = Date.now();
      const res = await publicApi.get(`/${tenantSlug}/sessions/${sessionId}`);
      setSession(withSessionMetrics(res.data));
    } catch (err) {
      console.error('[SESSION_FETCH_ERROR]', err);
      setSession(null);
    } finally {
      fetchInFlightRef.current = false;
      setLoading(false);
    }
  }, [sessionId, tenantSlug]);

  const scheduleRefresh = useCallback(
    (delayMs = 220) => {
      if (!sessionId || !tenantSlug) return;
      if (refreshTimerRef.current != null) return;
      if (Date.now() - lastFetchStartedAtRef.current < 1500) return;
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
    setMiniPendingPayment(getPendingMiniPaymentForTenant(tenantSlug));
  }, [tenantSlug]);

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
      scheduleRefresh(180);
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

    socket.on('session:payment_link', (payload: any) => {
      if (!payload?.sessionId || payload.sessionId !== sessionId || !isMiniTokenFlow) return;
      persistMiniPendingPayment({
        sessionId,
        method: 'online',
        state: 'OPEN_LINK',
        paymentLink: {
          amount: Number(payload.amount || 0),
          upiId: String(payload.upiId || ''),
          upiUri: String(payload.upiUri || ''),
        },
        submittedAt: null,
      });
    });

    socket.on('session:update', (payload: { sessionId?: string; status?: string; bill?: any }) => {
      if (!payload?.sessionId || payload.sessionId !== sessionId) return;
      setSession((prev: any) =>
        prev
          ? withSessionMetrics({
              ...prev,
              sessionStatus: payload.status || prev.sessionStatus,
              bill: payload.bill ? { ...prev.bill, ...payload.bill } : prev.bill,
            })
          : prev,
      );
      scheduleRefresh(payload.bill ? 140 : 220);
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

    socket.on('session:settled', (payload: { sessionId?: string; status?: string; totalAmount?: number; bill?: any }) => {
      if (!payload?.sessionId || payload.sessionId !== sessionId) return;
      setSession((prev: any) =>
        prev
          ? withSessionMetrics({
              ...prev,
              sessionStatus: payload.status || prev.sessionStatus,
              runningTotal: Number(payload.totalAmount || prev.runningTotal || 0),
              bill: payload.bill ? { ...prev.bill, ...payload.bill } : prev.bill,
            })
          : prev,
      );
      scheduleRefresh(160);
      if (payload.status === 'AWAITING_BILL') {
        navigate(`/order/${tenantSlug}/session/${sessionId}/bill`);
      }
    });

    socket.on('session:completed', (payload: { sessionId?: string; bill?: any }) => {
      if (!payload?.sessionId || payload.sessionId !== sessionId) return;
      setSession((prev: any) =>
        prev
          ? withSessionMetrics({
              ...prev,
              sessionStatus: 'CLOSED',
              bill: payload.bill ? { ...prev.bill, ...payload.bill } : prev.bill,
            })
          : prev,
      );
      scheduleRefresh(120);
      navigate(`/order/${tenantSlug}/session/${sessionId}/bill`);
    });

    socket.on('session:payment_rejected', (payload: any) => {
      if (!payload?.sessionId || payload.sessionId !== sessionId || !isMiniTokenFlow) return;
      persistMiniPendingPayment({
        sessionId,
        method: String(payload?.method || '').toLowerCase() === 'cash' ? 'cash' : 'online',
        state: 'REJECTED',
        paymentLink: miniPendingPayment?.paymentLink || null,
        submittedAt: null,
        message:
          typeof payload?.message === 'string' && payload.message.trim().length > 0
            ? payload.message.trim()
            : 'Payment is not visible yet. Please show the token and payment at the counter.',
      });
    });

    return () => {
      if (refreshTimerRef.current != null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      socket.disconnect();
    };
  }, [isMiniTokenFlow, miniPendingPayment?.paymentLink, navigate, persistMiniPendingPayment, scheduleRefresh, sessionAccessToken, sessionId, tenantSlug, upsertOrder]);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug || !sessionId || !isMiniTokenFlow) return;
    if (!miniPendingPayment || miniPendingPayment.sessionId !== sessionId) return;
    if (miniPendingPayment.method !== 'online' || miniPendingPayment.state !== 'OPEN_LINK' || !miniPendingPayment.paymentLink?.upiUri) {
      return;
    }

    const paymentStatus = String(session?.bill?.paymentStatus || '').toUpperCase();
    if (paymentStatus === 'PENDING_VERIFICATION' || paymentStatus === 'PAID') return;

    persistMiniPendingPayment({
      ...miniPendingPayment,
      state: 'AWAITING_RETURN',
    });

    const timeoutId = window.setTimeout(() => {
      window.location.assign(miniPendingPayment.paymentLink!.upiUri);
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [isMiniTokenFlow, miniPendingPayment, persistMiniPendingPayment, session?.bill?.paymentStatus, sessionId, tenantSlug]);

  const submitMiniOnlinePayment = useCallback(async () => {
    if (!tenantSlug || !sessionId || submittingMiniPayment) return;

    setSubmittingMiniPayment(true);
    try {
      await publicApi.post(`/${tenantSlug}/sessions/${sessionId}/payment-submitted`);
      persistMiniPendingPayment({
        sessionId,
        method: 'online',
        state: 'PENDING_VENDOR',
        paymentLink: miniPendingPayment?.paymentLink || null,
        submittedAt: Date.now(),
      });
    } catch (err) {
      console.error('[MINI_PAYMENT_SUBMIT_ERROR]', err);
    } finally {
      setSubmittingMiniPayment(false);
    }
  }, [miniPendingPayment?.paymentLink, persistMiniPendingPayment, sessionId, submittingMiniPayment, tenantSlug]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (!isMiniTokenFlow || !miniPendingPayment || miniPendingPayment.sessionId !== sessionId) return;
      if (miniPendingPayment.method !== 'online' || miniPendingPayment.state !== 'AWAITING_RETURN') return;

      const paymentStatus = String(session?.bill?.paymentStatus || '').toUpperCase();
      if (paymentStatus === 'PENDING_VERIFICATION' || paymentStatus === 'PAID') return;

      void submitMiniOnlinePayment();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isMiniTokenFlow, miniPendingPayment, session?.bill?.paymentStatus, sessionId, submitMiniOnlinePayment]);

  useEffect(() => {
    if (!miniPendingPayment?.submittedAt) return;
    const intervalId = window.setInterval(() => setMiniVerificationNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [miniPendingPayment?.submittedAt]);

  useEffect(() => {
    const paymentStatus = String(session?.bill?.paymentStatus || '').toUpperCase();
    const sessionStatus = String(session?.sessionStatus || '').toUpperCase();
    if (!isMiniTokenFlow) return;
    if (!miniPendingPayment || miniPendingPayment.sessionId !== sessionId) return;
    if (paymentStatus === 'PAID' || sessionStatus === 'CLOSED' || sessionStatus === 'CANCELLED') {
      persistMiniPendingPayment(null);
    }
  }, [isMiniTokenFlow, miniPendingPayment, persistMiniPendingPayment, session?.bill?.paymentStatus, session?.sessionStatus, sessionId]);

  useEffect(() => {
    const orders = Array.isArray(session?.orders) ? session.orders : [];
    if (orders.length === 0) return;

    orders.forEach((order: any) => {
      if (!order?.id) return;

      const nextStatus = String(order.status || '').toUpperCase();
      const previousStatus = orderStatusMapRef.current[order.id];
      orderStatusMapRef.current[order.id] = nextStatus;

      if (nextStatus !== 'READY' || previousStatus === 'READY') return;

      const readyMessage =
        String(order?.orderType || '').toUpperCase() === 'TAKEAWAY'
          ? 'Order is ready to pick.'
          : 'Order is ready.';
      speakTrackerReadyUpdate(readyMessage);
    });
  }, [session?.orders]);

  const handleFinish = async () => {
    if (!sessionId || !tenantSlug) return;
    setError(null);

    const paymentStatus = String(session?.bill?.paymentStatus || '').toUpperCase();
    if (paymentStatus === 'PAID') {
      navigate(`/order/${tenantSlug}/session/${sessionId}/bill`);
      return;
    }

    if (isMiniTokenFlow) {
      setError('Payment is still waiting for counter verification. The bill opens after the vendor confirms it.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
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
      if (
        session?.bill &&
        (
          String(msg).toLowerCase().includes('already closed') ||
          String(msg).toLowerCase().includes('no longer open')
        )
      ) {
        navigate(`/order/${tenantSlug}/session/${sessionId}/bill`);
        return;
      }
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
  const billPaymentStatus = String(session?.bill?.paymentStatus || '').toUpperCase();
  const hasPaidBill = billPaymentStatus === 'PAID';
  const paymentMethodLabel = String(session?.bill?.paymentMethod || miniPendingPayment?.method || '').toUpperCase();
  const shouldLockMiniAddMore =
    isMiniTokenFlow &&
    (Boolean(paymentMethodLabel) || billPaymentStatus === 'PENDING_VERIFICATION' || billPaymentStatus === 'PAID');
  const shouldDisableMiniBillAction = isMiniTokenFlow && !hasPaidBill && !isAwaitingBill;
  const miniVerificationRemainingSeconds =
    miniPendingPayment?.submittedAt && billPaymentStatus !== 'PAID'
      ? Math.max(0, 120 - Math.floor((miniVerificationNow - miniPendingPayment.submittedAt) / 1000))
      : null;
  const miniVerificationProgress =
    miniVerificationRemainingSeconds !== null
      ? Math.min(100, Math.max(6, ((120 - miniVerificationRemainingSeconds) / 120) * 100))
      : 0;
  const miniBillButtonLabel = hasPaidBill
    ? 'View Bill'
    : shouldDisableMiniBillAction
      ? billPaymentStatus === 'PENDING_VERIFICATION'
        ? 'Verification Pending'
        : paymentMethodLabel
          ? `${paymentMethodLabel} Pending`
          : 'Payment Pending'
      : 'Bill';
  const sortedOrders = [...(session.orders || [])].sort(
    (a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
  );
  const latestOrder = sortedOrders.length > 0 ? sortedOrders[sortedOrders.length - 1] : null;
  const activeOrderCount = sortedOrders.filter((order: any) => !['SERVED', 'RECEIVED'].includes(String(order?.status || '').toUpperCase())).length;
  const customerThemeVars = buildCustomerThemeVars(session?.tenant);
  const maxOrderRank = sortedOrders.reduce(
    (max: number, order: any) => Math.max(max, getOrderRank(order?.status)),
    0,
  );
  const processRank = session.sessionStatus === 'CLOSED' ? 4 : maxOrderRank;
  const nextPendingRank =
    CUSTOMER_PROGRESS_STEPS.find((step) => processRank < step.rank)?.rank ||
    CUSTOMER_PROGRESS_STEPS[CUSTOMER_PROGRESS_STEPS.length - 1].rank;
  const orderType = session.orders?.[0]?.orderType;
  const serviceLabel = getCustomerSessionLabel({ tableName: session.table?.name, orderType });
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
        ...customerThemeVars,
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
              {serviceLabel} | {session.partySize} guests
            </span>
            <div className="h-1 w-1 rounded-full bg-gray-300" />
            <span className="text-xs font-black uppercase tracking-widest text-emerald-500">Live</span>
          </div>

          <div className="space-y-5">
            <TimerDisplay order={latestOrder} />

            {isMiniTokenFlow && (miniPendingPayment || paymentMethodLabel || billPaymentStatus === 'PAID') && !isClosed && (
              <div
                className="rounded-3xl border p-5 shadow-sm"
                style={{ background: 'var(--surface-3)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--text-3)' }}>
                      Counter payment
                    </p>
                    <p className="mt-2 text-base font-black" style={{ color: 'var(--text-1)' }}>
                      {billPaymentStatus === 'PAID'
                        ? 'Payment verified. The order can move through preparation now.'
                        : billPaymentStatus === 'PENDING_VERIFICATION'
                          ? 'Waiting for the vendor to verify your payment.'
                          : miniPendingPayment?.method === 'online'
                            ? 'Complete the UPI payment and come back here.'
                            : 'The counter will verify your payment before preparation starts.'}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-relaxed" style={{ color: 'var(--text-2)' }}>
                      {miniPendingPayment?.state === 'REJECTED'
                        ? miniPendingPayment.message || 'Please show your payment at the counter with this token.'
                        : paymentMethodLabel
                          ? `${paymentMethodLabel} selected for this token.`
                          : 'This token stays in the new column until payment is verified.'}
                    </p>
                  </div>
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ background: 'var(--surface)', color: billPaymentStatus === 'PAID' ? 'var(--success)' : 'var(--brand)' }}
                  >
                    {billPaymentStatus === 'PAID' ? <CheckCircle2 size={22} /> : <CreditCard size={22} />}
                  </div>
                </div>

                {miniVerificationRemainingSeconds !== null && billPaymentStatus !== 'PAID' && (
                  <div className="mt-4 rounded-2xl border border-blue-500/20 bg-blue-500/8 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-500">Verification window</p>
                    <p className="mt-2 text-2xl font-black text-blue-500">
                      {Math.floor(miniVerificationRemainingSeconds / 60)}:
                      {String(miniVerificationRemainingSeconds % 60).padStart(2, '0')}
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${miniVerificationProgress}%`, background: 'var(--brand)' }}
                      />
                    </div>
                    <p className="mt-2 text-xs font-semibold text-blue-400/80">
                      Show this screen, your token number, and the payment if the vendor asks at the counter.
                    </p>
                  </div>
                )}

                {miniPendingPayment?.method === 'online' && miniPendingPayment?.paymentLink?.upiUri && billPaymentStatus !== 'PAID' && billPaymentStatus !== 'PENDING_VERIFICATION' && (
                  <button
                    onClick={() => {
                      persistMiniPendingPayment({
                        ...miniPendingPayment,
                        state: 'AWAITING_RETURN',
                      });
                      window.location.assign(miniPendingPayment.paymentLink!.upiUri);
                    }}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white"
                    style={{ background: 'var(--brand)' }}
                  >
                    <CreditCard size={16} />
                    Open UPI App
                  </button>
                )}

                {sortedOrders[0]?.orderNumber && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]" style={{ background: 'var(--surface)', color: 'var(--text-3)' }}>
                      Token
                    </span>
                    <span className="rounded-full px-3 py-1 text-sm font-black" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                      {sortedOrders.map((order: any) => order.orderNumber || order.id?.slice(-6).toUpperCase()).filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                Service progress
              </p>
              <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>
                {processSummary}
              </p>
            </div>
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
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { label: 'Open batches', value: String(activeOrderCount) },
                { label: 'Dishes', value: String(session.itemCount || 0) },
                { label: 'Running bill', value: formatINR(session.runningTotal || 0) },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border p-3 text-left"
                  style={{ background: 'var(--surface-3)', borderColor: 'var(--border)' }}
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                    {metric.label}
                  </p>
                  <p className="mt-1 text-sm font-black leading-tight" style={{ color: 'var(--text-1)' }}>
                    {metric.value}
                  </p>
                </div>
              ))}
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
                ? session?.tenant?.hasWaiterService
                  ? 'Your final bill is ready. A waiter will bring the bill and confirm payment before this session moves into history.'
                  : 'Your final bill is ready. Please go to the billing counter or open the bill page to complete payment.'
                : hasPaidBill
                  ? 'Payment is already received. We will keep showing live kitchen and pickup updates here until the order is completed.'
                : shouldDisableMiniBillAction
                  ? 'This token is waiting for counter verification. We will unlock the bill after the vendor confirms the payment.'
                  : 'This is a live session. You can keep adding items until you tap Bill to request the final settlement.'}
            </p>
          </div>
        )}

        {(isAwaitingBill || isClosed) && (
          <div
            className="rounded-3xl border p-5 shadow-sm"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--text-3)' }}>
              Billing status
            </p>
            <p className="mt-2 text-base font-black" style={{ color: 'var(--text-1)' }}>
              {isClosed ? 'Service closed and bill settled.' : 'Service closed. Final bill is ready for payment.'}
            </p>
            <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
              {isClosed
                ? 'You can open the final invoice or check your session history anytime.'
                : 'Open the bill page to complete payment or show this session to the billing desk.'}
            </p>
          </div>
        )}

        {isCounterEntry && !session?.tableId && (
          <button
            onClick={() => {
              clearCart();
              clearCustomerContextForTenant(tenantSlug);
              navigate(`/order/${tenantSlug}?mode=counter&source=staff`, { replace: true });
            }}
            className="flex w-full items-center justify-between rounded-3xl border px-5 py-4 text-left shadow-sm transition-all hover:translate-y-[-1px]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--text-3)' }}>
                Counter flow
              </p>
              <p className="mt-1 text-base font-black" style={{ color: 'var(--text-1)' }}>
                Start next guest
              </p>
              <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                Clears this shared device and opens a fresh counter order for the next customer.
              </p>
            </div>
            <ChevronRight size={18} style={{ color: 'var(--text-3)' }} />
          </button>
        )}

        <div className="space-y-4">
          <h3 className="text-lg font-black px-1" style={{ color: 'var(--text-1)' }}>
            Service Timeline
          </h3>

          {sortedOrders.length === 0 && (
            <div className="py-20 text-center rounded-3xl border-2 border-dashed" style={{ borderColor: 'var(--border)' }}>
              <UtensilsCrossed size={40} className="mx-auto mb-4 opacity-20" />
              <p className="font-bold" style={{ color: 'var(--text-3)' }}>
                No dishes ordered yet
              </p>
            </div>
          )}

          {sortedOrders.map((order: any, index: number) => {
            const status = getCustomerStatusMeta(order.status, order.orderType);
            const StatusIcon = status.icon;
            const orderRank = getOrderRank(order.status);

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
                  <div className="grid grid-cols-4 gap-1.5">
                    {CUSTOMER_PROGRESS_STEPS.map((step) => {
                      const complete = orderRank >= step.rank;
                      return (
                        <div
                          key={`${order.id}_${step.key}`}
                          className="rounded-full px-2 py-1 text-center text-[9px] font-black uppercase tracking-[0.12em]"
                          style={{
                            background: complete ? 'var(--brand-soft)' : 'var(--surface-3)',
                            color: complete ? 'var(--brand)' : 'var(--text-3)',
                          }}
                        >
                          {step.label}
                        </div>
                      );
                    })}
                  </div>
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
                  {order.specialInstructions ? (
                    <div
                      className="rounded-2xl border px-4 py-3 text-sm font-semibold"
                      style={{ background: 'var(--surface-3)', borderColor: 'var(--border)', color: 'var(--text-2)' }}
                    >
                      Kitchen note: {order.specialInstructions}
                    </div>
                  ) : null}
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
            {!shouldLockMiniAddMore && (
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
            )}
            <button
              onClick={hasPaidBill ? () => navigate(`/order/${tenantSlug}/session/${sessionId}/bill`) : handleFinish}
              disabled={finishing || shouldDisableMiniBillAction}
              className={`${shouldLockMiniAddMore ? 'w-full' : 'flex-1'} rounded-3xl bg-[#1a1c23] py-4 font-black text-white shadow-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50`}
            >
              {finishing ? (
                <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  <Receipt size={18} />
                  {miniBillButtonLabel}
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
          Powered by BHOJFLOW
        </p>
      </div>
    </div>
  );
}
