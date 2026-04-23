import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  CheckCircle2, 
  ChevronLeft, 
  CreditCard, 
  Download, 
  Receipt, 
  Share2, 
  Star, 
  Users, 
  Wallet, 
  X,
  ChefHat,
  UtensilsCrossed,
  Clock3
} from 'lucide-react';
import { getTenantPublicAuthHeaders, publicApi } from '../lib/api';
import { formatINR } from '../lib/currency';
import { buildCustomerThemeVars } from '../lib/customerTheme';
import { getSocketUrl } from '../lib/network';
import { getCustomerSessionLabel } from '../lib/serviceMode';
import { getSessionAccessTokenForTenant } from '../lib/tenantStorage';

interface StepConfig {
  label: string;
  icon: any;
  rank: number;
}

const STEPS: StepConfig[] = [
  { label: 'Accepted', icon: CheckCircle2, rank: 1 },
  { label: 'Preparing', icon: ChefHat, rank: 2 },
  { label: 'Ready', icon: UtensilsCrossed, rank: 3 },
  { label: 'Served', icon: Clock3, rank: 5 },
  { label: 'Settle', icon: Star, rank: 6 },
];

function getSessionRank(session: any) {
  if (session?.bill?.paymentStatus === 'PAID') return 6;
  const orders = session?.orders || [];
  if (orders.length === 0) return 0;
  
  const ranks = orders.map((o: any) => {
    switch (o.status) {
      case 'ACCEPTED': return 1;
      case 'PREPARING': return 2;
      case 'READY': return 3;
      case 'SERVED': return 5;
      case 'RECEIVED': return 6;
      default: return 0;
    }
  });
  return Math.max(...ranks);
}

function deriveBillFromSession(session: any) {
  const rawBill = session?.bill;
  if (!rawBill) return null;

  const orders = Array.isArray(session?.orders) ? session.orders : [];
  const subtotal = orders.reduce((sum: number, order: any) => sum + Number(order?.subtotal || 0), 0);
  const taxAmount = orders.reduce((sum: number, order: any) => sum + Number(order?.taxAmount || 0), 0);
  const discountAmount = orders.reduce((sum: number, order: any) => sum + Number(order?.discountAmount || 0), 0);
  const summedTotal = orders.reduce((sum: number, order: any) => sum + Number(order?.totalAmount || 0), 0);
  const computedTotal = summedTotal > 0 ? summedTotal : Math.max(0, subtotal + taxAmount - discountAmount);
  const currentTotal = Number(rawBill.totalAmount || 0);

  if (computedTotal <= 0 || currentTotal > 0) {
    return rawBill;
  }

  return {
    ...rawBill,
    subtotal,
    taxAmount,
    discountAmount,
    totalAmount: computedTotal,
  };
}

function RatingStars({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
        {label}
      </p>
      <div className="mt-3 flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="transition-transform hover:scale-105 active:scale-95"
          >
            <Star size={28} className={value >= star ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function BillPage() {
  const { tenantSlug, sessionId } = useParams();
  const navigate = useNavigate();
  const sessionAccessToken = getSessionAccessTokenForTenant(tenantSlug);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSplit, setShowSplit] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewDismissed, setReviewDismissed] = useState(false);
  const [foodRating, setFoodRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [tipAmount, setTipAmount] = useState(0);
  const [activeTipType, setActiveTipType] = useState<number | 'custom' | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [requestingMethod, setRequestingMethod] = useState<'cash' | 'online' | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [paymentSubmittedAt, setPaymentSubmittedAt] = useState<number | null>(null);
  const [verificationNow, setVerificationNow] = useState(() => Date.now());
  const [paymentLink, setPaymentLink] = useState<{
    sessionId: string;
    amount: number;
    upiId: string;
    upiUri: string;
  } | null>(null);
  const fetchInFlightRef = useRef(false);
  const lastFetchStartedAtRef = useRef(0);
  const lastAutoOpenedPaymentLinkRef = useRef('');

  const fetchBill = useCallback(
    async (silent = false) => {
      if (!tenantSlug || !sessionId) {
        setLoading(false);
        return;
      }

      if (fetchInFlightRef.current) {
        return;
      }

      if (!silent) {
        setLoading(true);
      }

      try {
        fetchInFlightRef.current = true;
        lastFetchStartedAtRef.current = Date.now();
        const res = await publicApi.get(`/${tenantSlug}/sessions/${sessionId}/bill`);
        setSession(res.data);
      } catch (error) {
        console.error('[BILL_FETCH_ERROR]', error);
        if (!silent) {
          setSession(null);
        }
      } finally {
        fetchInFlightRef.current = false;
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [sessionId, tenantSlug],
  );

  useEffect(() => {
    void fetchBill();
  }, [fetchBill]);

  const openUpiApp = useCallback((upiUri: string) => {
    if (!upiUri || typeof window === 'undefined') return;
    const isMobileCheckout =
      /android|iphone|ipad|ipod/i.test(window.navigator.userAgent || '') ||
      window.matchMedia('(max-width: 768px)').matches;
    if (!isMobileCheckout) return;
    if (lastAutoOpenedPaymentLinkRef.current === upiUri) return;

    lastAutoOpenedPaymentLinkRef.current = upiUri;
    window.setTimeout(() => {
      window.location.assign(upiUri);
    }, 160);
  }, []);

  useEffect(() => {
    if (!tenantSlug || !sessionId || !sessionAccessToken) return;

    const socket = io(getSocketUrl(), {
      auth: { tenantSlug, sessionAccessToken, client: 'customer-bill' },
      transports: ['websocket'],
      rememberUpgrade: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 10000,
    });

    const refreshBill = () => {
      if (Date.now() - lastFetchStartedAtRef.current < 1500) return;
      void fetchBill(true);
    };

    socket.on('connect', refreshBill);
    socket.on('session:finished', refreshBill);
    socket.on('session:settled', refreshBill);
    socket.on('session:completed', refreshBill);
    socket.on('session:update', refreshBill);
    socket.on('orders:bulk_status', refreshBill);
    socket.on('session:payment_link', (payload: any) => {
      if (payload?.sessionId !== sessionId) return;
      const nextPaymentLink = {
        sessionId: payload.sessionId,
        amount: Number(payload.amount || 0),
        upiId: String(payload.upiId || ''),
        upiUri: String(payload.upiUri || ''),
      };
      setPaymentLink(nextPaymentLink);
      setPaymentSubmitted(false);
      setPaymentSubmittedAt(null);
      setPaymentMessage('The restaurant sent your exact-amount UPI link. Complete the payment, come back here, then tap I have paid.');
      openUpiApp(nextPaymentLink.upiUri);
    });
    socket.on('session:payment_rejected', (payload: any) => {
      if (payload?.sessionId !== sessionId) return;
      setPaymentLink(null);
      setPaymentSubmitted(false);
      setPaymentSubmittedAt(null);
      setPaymentMessage(
        typeof payload?.message === 'string' && payload.message.trim()
          ? payload.message
          : 'Payment is not visible yet. Please show it to the desk manager.',
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchBill, openUpiApp, sessionAccessToken, sessionId, tenantSlug]);

  useEffect(() => {
    if (!tenantSlug || !sessionId) return;
    if (session?.bill?.paymentStatus === 'PAID') return;

    const intervalId = window.setInterval(() => {
      void fetchBill(true);
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [fetchBill, session?.bill?.paymentStatus, sessionId, tenantSlug]);

  useEffect(() => {
    if (session?.review) {
      setReviewOpen(false);
      return;
    }

    if (session?.bill?.paymentStatus === 'PAID' && !reviewDismissed) {
      setReviewOpen(true);
    }
  }, [reviewDismissed, session?.bill?.paymentStatus, session?.review]);

  useEffect(() => {
    if (String(session?.bill?.paymentStatus || '').toUpperCase() !== 'PAID') return;
    setCheckoutOpen(false);
    setPaymentSubmitted(false);
    setPaymentSubmittedAt(null);
    setPaymentLink(null);
    setPaymentMessage('');
  }, [session?.bill?.paymentStatus]);

  useEffect(() => {
    if (!paymentSubmittedAt) return;
    if (String(session?.bill?.paymentStatus || '').toUpperCase() === 'PAID') return;

    const tickId = window.setInterval(() => {
      setVerificationNow(Date.now());
    }, 1000);

    const timeoutId = window.setTimeout(() => {
      setPaymentMessage('We have not received the confirmation yet. Please go to the counter and show the payment to the desk manager.');
    }, 120000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(tickId);
    };
  }, [paymentSubmittedAt, session?.bill?.paymentStatus]);

  const splitValues = useMemo(() => {
    const bill = deriveBillFromSession(session);
    const count = Math.max(1, splitCount);
    if (!bill) return { perHead: 0 };
    return { perHead: Number(bill.totalAmount || 0) / count };
  }, [session, splitCount]);

  const latestReviewableOrder = useMemo(() => {
    if (!session?.orders || session?.review) return null;
    const nonCancelled = session.orders.filter((order: any) => order.status !== 'CANCELLED');
    if (nonCancelled.length === 0) return null;
    return nonCancelled.sort(
      (a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    )[0];
  }, [session?.orders, session?.review]);
  const serviceLabel = getCustomerSessionLabel({
    tableName: session?.table?.name,
    orderType: session?.orders?.[0]?.orderType,
  });

  const shareWhatsApp = () => {
    const resolvedBill = deriveBillFromSession(session);
    if (!resolvedBill) return;
    const items = session.orders?.flatMap((order: any) => order.items || []) || [];
    const itemLines = items.map((item: any) => `- ${item.name} x${item.quantity}: ${formatINR(item.totalPrice)}`).join('\n');
    const message = [
      `Final Bill - ${session.tenant?.businessName || 'BHOJFLOW'}`,
      '',
      `Table: ${serviceLabel}`,
      itemLines,
      '',
      `Subtotal: ${formatINR(resolvedBill.subtotal)}`,
      `Tax: ${formatINR(resolvedBill.taxAmount)}`,
      `Total: ${formatINR(resolvedBill.totalAmount)}`,
    ]
      .filter(Boolean)
      .join('\n');

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const submitReview = async () => {
    if (!tenantSlug || !sessionId || !latestReviewableOrder) return;
    if (foodRating <= 0 || serviceRating <= 0) {
      window.alert('Please rate both the food and the service.');
      return;
    }

    setSubmittingReview(true);
    try {
      await publicApi.post(`/orders/${latestReviewableOrder.id}/feedback`, {
        foodRating,
        serviceRating,
        comment: reviewComment.trim() || undefined,
        tipAmount,
        serviceStaffName: session?.attendedByName || undefined,
        ...(sessionAccessToken ? { sessionAccessToken } : {}),
      }, {
        headers: getTenantPublicAuthHeaders(tenantSlug),
      });
      await fetchBill(true);
      setReviewOpen(false);
      setReviewDismissed(false);
      setFoodRating(0);
      setServiceRating(0);
      setReviewComment('');
      setTipAmount(0);
    } catch (error: any) {
      window.alert(error?.response?.data?.error || 'Failed to submit your review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const requestPaymentMethod = async (method: 'cash' | 'online') => {
    if (!tenantSlug || !sessionId) return;

    setRequestingMethod(method);
    setPaymentMessage('');

    try {
      const response = await publicApi.post(`/${tenantSlug}/sessions/${sessionId}/payment-request`, {
        method,
        tipAmount,
      }, {
        headers: getTenantPublicAuthHeaders(tenantSlug),
      });
      setSession(response.data);
      setCheckoutOpen(false);
      setPaymentSubmitted(false);
      setPaymentSubmittedAt(null);
      if (method === 'cash') {
        setPaymentLink(null);
        setPaymentMessage(
          response.data?.tenant?.hasWaiterService
            ? 'Cash selected. Your waiter is coming with the bill. Please keep the amount ready for payment.'
            : 'Cash selected. Please go to the billing counter with this bill screen and pay the exact amount there.',
        );
      } else {
        if (response.data?.paymentLink) {
          const nextPaymentLink = {
            sessionId: String(response.data.paymentLink.sessionId || sessionId),
            amount: Number(response.data.paymentLink.amount || 0),
            upiId: String(response.data.paymentLink.upiId || ''),
            upiUri: String(response.data.paymentLink.upiUri || ''),
          };
          setPaymentLink(nextPaymentLink);
          setPaymentMessage('Online payment selected. We are opening your exact-amount UPI checkout now. Return here after payment and tap I have paid.');
          openUpiApp(nextPaymentLink.upiUri);
        } else {
          setPaymentMessage('Online payment selected. The restaurant will send a fixed-amount UPI link here.');
        }
      }
    } catch (error: any) {
      window.alert(error?.response?.data?.error || 'Could not start checkout right now.');
    } finally {
      setRequestingMethod(null);
    }
  };

  const submitOnlinePayment = useCallback(async () => {
    if (!tenantSlug || !sessionId) return;
    if (submittingPayment) return;

    setSubmittingPayment(true);
    try {
      await publicApi.post(`/${tenantSlug}/sessions/${sessionId}/payment-submitted`);
      setPaymentSubmitted(true);
      setPaymentSubmittedAt(Date.now());
      setPaymentMessage('Payment submitted. Please wait while the cashier checks the account.');
    } catch (error: any) {
      window.alert(error?.response?.data?.error || 'Could not notify the restaurant about your payment.');
    } finally {
      setSubmittingPayment(false);
    }
  }, [tenantSlug, sessionId, submittingPayment]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        paymentLink &&
        !paymentSubmitted &&
        !submittingPayment
      ) {
        // Automatically submit online payment when returning from the UPI app
        submitOnlinePayment();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [paymentLink, paymentSubmitted, submittingPayment, submitOnlinePayment]);

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

  const bill = deriveBillFromSession(session);

  if (!bill || typeof bill.totalAmount !== 'number') {
    return (
      <div
        className="min-h-[100dvh] flex flex-col items-center justify-center gap-6 p-10 text-center"
        style={{ background: 'var(--bg)' }}
      >
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
        >
          <Receipt size={40} />
        </div>
        <div>
          <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--text-1)' }}>
            Bill not generated yet
          </h2>
          <p className="font-medium" style={{ color: 'var(--text-3)' }}>
            The restaurant is preparing your final bill. Please wait a moment and refresh this page.
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

  const allItems = session.orders?.flatMap((order: any) => order.items || []) || [];
  const customerThemeVars = buildCustomerThemeVars(session?.tenant);
  const serviceStaffName = session?.review?.serviceStaffName || session?.attendedByName || 'Restaurant team';
  const tipSummary = Number(session?.review?.tipAmount || 0);
  const paymentMethod = String(bill.paymentMethod || '').toUpperCase();
  const sessionStatus = String(session?.sessionStatus || '').toUpperCase();
  const unpaidBill = String(bill.paymentStatus || '').toUpperCase() !== 'PAID';
  const isAwaitingBill = sessionStatus === 'AWAITING_BILL';
  const requestedMethod = String(bill.paymentMethod || '').toLowerCase();
  const hasOnlineRequest = isAwaitingBill && unpaidBill && requestedMethod === 'online';
  const hasCashRequest = isAwaitingBill && unpaidBill && requestedMethod === 'cash';
  const showCheckoutControls = isAwaitingBill && unpaidBill;
  const onlineAvailable = Boolean(session?.tenant?.upiConfigured);
  const totalPayable = (bill.totalAmount || 0) + tipAmount;
  const isDineIn = session?.orders?.[0]?.orderType === 'DINE_IN';
  const verificationSecondsLeft =
    paymentSubmittedAt && unpaidBill
      ? Math.max(0, 120 - Math.floor((verificationNow - paymentSubmittedAt) / 1000))
      : 0;
  const paymentBannerLabel = bill.paymentStatus === 'PAID'
    ? 'Payment Confirmed'
    : paymentSubmitted
      ? 'Payment Verification in Progress'
      : paymentLink
        ? 'Exact UPI Amount Ready'
        : hasOnlineRequest
          ? 'Waiting for Online Payment Link'
          : hasCashRequest
            ? 'Cash Payment Requested'
            : showCheckoutControls
              ? 'Choose Payment Method'
              : 'Waiting for Restaurant Payment Confirmation';

  return (
    <div
      className="min-h-[100dvh] pb-12 transition-colors duration-400 print:bg-white"
      style={{ background: 'var(--bg)', ...customerThemeVars } as any}
    >
      <div className="px-6 pt-12 pb-24 text-center relative overflow-hidden print:hidden" style={{ background: 'var(--surface)' }}>
        <div className="absolute top-0 right-0 w-64 h-64 blur-[100px] rounded-full opacity-10" style={{ background: 'var(--brand)' }} />
        <button
          onClick={() => navigate(-1)}
          className="absolute left-6 top-10 w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90"
          style={{ background: 'var(--surface-3)', color: 'var(--text-1)' }}
        >
          <ChevronLeft size={20} />
        </button>

        <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-3)' }}>
          Final Bill
        </p>
        <h1 className="text-5xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
          {formatINR(bill.totalAmount)}
        </h1>
        <p className="text-sm font-bold mt-3 opacity-60" style={{ color: 'var(--text-2)' }}>
          {[session.tenant?.businessName, serviceLabel].filter(Boolean).join(' | ')}
        </p>

        {/* Live Tracking Journey Indicator */}
        <div className="mt-8 flex items-center justify-center gap-2 max-w-[280px] mx-auto opacity-80">
          {STEPS.map((step, idx) => {
            const currentRank = getSessionRank(session);
            const isCompleted = currentRank >= step.rank;
            const Icon = step.icon;
            
            return (
              <div key={step.label} className="flex items-center flex-1 last:flex-none">
                <div 
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/30'}`}
                  title={step.label}
                >
                  <Icon size={14} />
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`h-[2px] flex-1 mx-1 rounded-full ${isCompleted && currentRank > step.rank ? 'bg-emerald-500' : 'bg-white/10'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-screen-sm mx-auto px-6 -mt-12 relative z-10 print:mt-0 print:px-0">
        <div
          className="rounded-[40px] shadow-2xl overflow-hidden border print:shadow-none print:border-none print:rounded-none"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ background: bill.paymentStatus === 'PAID' ? 'var(--success)' : 'var(--brand)', color: 'white' }}
          >
            <div className="flex items-center gap-2">
              {bill.paymentStatus === 'PAID' ? <CheckCircle2 size={16} /> : <CreditCard size={16} />}
              <span className="text-xs font-black uppercase tracking-widest">
                {paymentBannerLabel}
              </span>
            </div>
            <span className="text-[10px] font-black opacity-80">
              {bill.paymentStatus === 'PAID' && paymentMethod ? paymentMethod : 'Pending'}
            </span>
          </div>

          <div className="p-8 space-y-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-8 border-b border-dashed" style={{ borderColor: 'var(--border)' }}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>
                  Session Date
                </p>
                <p className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>
                  {new Date(session.openedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>
                  Service Staff
                </p>
                <p className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>
                  {serviceStaffName}
                </p>
              </div>
            </div>

            <section
              className="rounded-3xl border p-5"
              style={{ background: 'var(--surface-3)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                  <Wallet size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                    Billing Note
                  </p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                    {bill.paymentStatus === 'PAID'
                      ? `This bill has been settled${paymentMethod ? ` via ${paymentMethod.toLowerCase()}` : ''}.`
                      : showCheckoutControls
                        ? 'Choose how you want to pay. The restaurant will confirm the payment and close the session from the billing desk.'
                        : 'The restaurant will mark this bill as paid after they receive cash or online payment.'}
                  </p>
                  {tipSummary > 0 && (
                    <p className="mt-2 text-xs font-black uppercase tracking-[0.14em]" style={{ color: 'var(--brand)' }}>
                      Tip shared: {formatINR(tipSummary)}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {showCheckoutControls && (
              <section
                className="rounded-3xl border p-5"
                style={{ background: 'var(--surface-3)', borderColor: 'var(--border)' }}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                      Bill Checkout
                    </p>
                    <h3 className="mt-2 text-xl font-black" style={{ color: 'var(--text-1)' }}>
                      Choose how you want to pay {formatINR(totalPayable)}
                    </h3>
                    <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                      Cash keeps the checkout simple. Online payment stays locked to the exact bill amount sent by the restaurant.
                    </p>
                    {!onlineAvailable && (
                      <p className="mt-2 text-xs font-black uppercase tracking-[0.14em]" style={{ color: 'var(--brand)' }}>
                        Online payment is not configured yet for this restaurant.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCheckoutOpen(true)}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black text-white transition-all active:scale-[0.98]"
                    style={{ background: 'var(--brand)' }}
                  >
                    <Wallet size={16} />
                    Bill / Checkout
                  </button>
                </div>

                {paymentMessage && (
                  <div
                    className="mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-2)' }}
                  >
                    {paymentMessage}
                  </div>
                )}

                {hasCashRequest && (
                  <div
                    className="mt-4 rounded-2xl border px-4 py-4"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--brand)' }}>
                      Cash Selected
                    </p>
                    <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                      {session?.tenant?.hasWaiterService
                        ? 'Please keep the cash ready. Your waiter is coming with the bill for final payment.'
                        : 'Please go to the billing counter. Show this screen if the restaurant asks for the final amount.'}
                    </p>
                  </div>
                )}

                {hasOnlineRequest && !paymentLink && (
                  <div
                    className="mt-4 rounded-2xl border px-4 py-4"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--brand)' }}>
                      Waiting for UPI Link
                    </p>
                    <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                      The restaurant will send an exact-amount online payment link here. The amount will stay locked to {formatINR(totalPayable)}.
                    </p>
                  </div>
                )}

                {paymentLink && (
                  <div
                    className="mt-4 rounded-[28px] border p-5"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--brand)' }}>
                          Exact Amount UPI Link
                        </p>
                        <h4 className="mt-2 text-2xl font-black" style={{ color: 'var(--text-1)' }}>
                          {formatINR(paymentLink.amount || totalPayable)}
                        </h4>
                        <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                          Pay to {paymentLink.upiId}. The amount is fixed and cannot be changed from this checkout step.
                        </p>
                      </div>
                      <div
                        className="rounded-2xl px-4 py-3 text-center"
                        style={{ background: 'var(--surface-3)', color: 'var(--text-1)' }}
                      >
                        <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                          Amount Locked
                        </p>
                        <p className="mt-1 text-lg font-black">{formatINR(paymentLink.amount || totalPayable)}</p>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <a
                        href={paymentLink.upiUri}
                        className="flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-black text-white transition-all active:scale-[0.98]"
                        style={{ background: '#2563eb' }}
                      >
                        <CreditCard size={16} />
                        Open UPI App
                      </a>
                      <button
                        type="button"
                        onClick={submitOnlinePayment}
                        disabled={submittingPayment || paymentSubmitted}
                        className="flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-black text-white transition-all active:scale-[0.98] disabled:opacity-60"
                        style={{ background: paymentSubmitted ? 'var(--success)' : 'var(--brand)' }}
                      >
                        <CheckCircle2 size={16} />
                        {paymentSubmitted ? 'Payment Submitted' : submittingPayment ? 'Sending...' : 'I Have Paid'}
                      </button>
                    </div>

                    {paymentSubmitted && (
                      <div className="mt-4 rounded-2xl border px-4 py-4" style={{ background: 'var(--surface-3)', borderColor: 'var(--border)' }}>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--brand)' }}>
                          Cashier Checking Payment
                        </p>
                        <div className="mt-3 flex items-center gap-3">
                          <div
                            className="h-10 w-10 rounded-full border-4 animate-spin"
                            style={{ borderColor: 'var(--brand-soft)', borderTopColor: 'var(--brand)' }}
                          />
                          <div>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                              Please wait while the cashier checks the account. Once they confirm the amount, this session will close automatically.
                            </p>
                            <p className="mt-1 text-xs font-black uppercase tracking-[0.14em]" style={{ color: 'var(--text-3)' }}>
                              {verificationSecondsLeft > 0
                                ? `${verificationSecondsLeft}s remaining before fallback help`
                                : 'If this takes too long, please go to the counter and show the payment.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            <section>
              <h3 className="text-xs font-black uppercase tracking-widest mb-6" style={{ color: 'var(--text-3)' }}>
                Ordered Items
              </h3>
              <div className="space-y-4">
                {allItems.map((item: any, index: number) => (
                  <div key={`${item.id}_${index}`} className="flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-black"
                        style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
                      >
                        {item.quantity}
                      </span>
                      <span className="font-bold text-sm" style={{ color: 'var(--text-2)' }}>
                        {item.name}
                      </span>
                    </div>
                    <span className="font-black text-sm" style={{ color: 'var(--text-1)' }}>
                      {formatINR(item.totalPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="pt-8 border-t border-dashed space-y-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex justify-between text-sm font-bold">
                <span style={{ color: 'var(--text-3)' }}>Subtotal</span>
                <span style={{ color: 'var(--text-1)' }}>{formatINR(bill.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span style={{ color: 'var(--text-3)' }}>Tax & GST</span>
                <span style={{ color: 'var(--text-1)' }}>{formatINR(bill.taxAmount)}</span>
              </div>
              {bill.discountAmount > 0 && (
                <div className="flex justify-between text-sm font-black">
                  <span className="text-emerald-500">Discount</span>
                  <span className="text-emerald-500">-{formatINR(bill.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-8 mt-2">
                <span className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
                  Total
                </span>
                <div className="text-right">
                  <p className="text-4xl font-black" style={{ color: 'var(--brand)' }}>
                    {formatINR(totalPayable)}
                  </p>
                  {tipAmount > 0 && (
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-emerald-500">
                      Incl. {formatINR(tipAmount)} Tip
                    </p>
                  )}
                </div>
              </div>

              {isDineIn && !bill.paymentStatus && !showCheckoutControls && (
                <div className="mt-8 space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                      Support your waiter
                    </h4>
                    {tipAmount > 0 && (
                      <button 
                        onClick={() => { setTipAmount(0); setActiveTipType(null); }}
                        className="text-[10px] font-black uppercase tracking-widest text-red-500"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[30, 50, 100].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => { setTipAmount(amount); setActiveTipType(amount); }}
                        className="rounded-2xl border py-3 text-sm font-black transition-all active:scale-95"
                        style={{
                          background: activeTipType === amount ? 'var(--brand)' : 'var(--surface-3)',
                          borderColor: activeTipType === amount ? 'var(--brand)' : 'var(--border)',
                          color: activeTipType === amount ? 'white' : 'var(--text-1)',
                        }}
                      >
                        {formatINR(amount)}
                      </button>
                    ))}
                    <button
                      onClick={() => setActiveTipType('custom')}
                      className="rounded-2xl border py-3 text-sm font-black transition-all active:scale-95"
                      style={{
                        background: activeTipType === 'custom' ? 'var(--brand)' : 'var(--surface-3)',
                        borderColor: activeTipType === 'custom' ? 'var(--brand)' : 'var(--border)',
                        color: activeTipType === 'custom' ? 'white' : 'var(--text-1)',
                      }}
                    >
                      {activeTipType === 'custom' ? 'Custom' : 'Edit'}
                    </button>
                  </div>
                  {activeTipType === 'custom' && (
                    <div className="relative fade-in">
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="Enter custom tip (e.g. 150)"
                        value={tipAmount || ''}
                        onChange={(e) => setTipAmount(Math.max(0, Number(e.target.value)))}
                        className="w-full rounded-2xl border px-5 py-4 font-black outline-none transition-all focus:ring-2 focus:ring-blue-500/20"
                        style={{ background: 'var(--surface-3)', borderColor: 'var(--brand-soft)', color: 'var(--text-1)' }}
                      />
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-black uppercase tracking-widest text-emerald-500">
                        Custom Support
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30" style={{ color: 'var(--text-3)' }}>
                Thank you for dining with us
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 print:hidden">
          <button
            onClick={() => setShowSplit(true)}
            className="flex flex-col items-center justify-center gap-2 p-5 rounded-3xl border transition-all active:scale-95 group"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center group-hover:rotate-6 transition-transform" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}>
              <Users size={20} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-1)' }}>
              Split Bill
            </span>
          </button>

          {showCheckoutControls ? (
            <button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              className="flex flex-col items-center justify-center gap-2 p-5 rounded-3xl border text-center transition-all active:scale-[0.98]"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                <Wallet size={20} />
              </div>
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-1)' }}>
                Bill / Checkout
              </span>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--text-3)' }}>
                {paymentSubmitted
                  ? 'Waiting for payment verification'
                  : paymentLink
                    ? 'UPI link ready'
                    : hasOnlineRequest
                      ? 'Online selected'
                      : hasCashRequest
                        ? 'Cash selected'
                        : 'Choose cash or online'}
              </span>
            </button>
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-2 p-5 rounded-3xl border text-center"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--surface-3)', color: bill.paymentStatus === 'PAID' ? 'var(--success)' : 'var(--brand)' }}>
                {bill.paymentStatus === 'PAID' ? <CheckCircle2 size={20} /> : <CreditCard size={20} />}
              </div>
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-1)' }}>
                {bill.paymentStatus === 'PAID' ? 'Settled' : 'Awaiting Vendor'}
              </span>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--text-3)' }}>
                {bill.paymentStatus === 'PAID'
                  ? paymentMethod || 'Paid'
                  : 'Restaurant will confirm cash or online payment here'}
              </span>
            </div>
          )}

          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all active:scale-95 text-sm font-black"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
          >
            <Download size={18} /> Save PDF
          </button>

          <button
            onClick={shareWhatsApp}
            className="flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all active:scale-95 text-sm font-black text-white"
            style={{ background: '#25D366', borderColor: '#25D366' }}
          >
            <Share2 size={18} /> WhatsApp
          </button>
        </div>

        {session?.review && (
          <div className="mt-8 rounded-[32px] border p-6 print:hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>
              Your Review
            </p>
            <div className="mt-3 flex items-center gap-2 text-amber-500">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={18}
                  className={session.review.overallRating >= star ? 'fill-current text-amber-500' : 'text-gray-300'}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm font-bold">
              <div>
                <p style={{ color: 'var(--text-3)' }}>Food</p>
                <p style={{ color: 'var(--text-1)' }}>{session.review.foodRating || session.review.overallRating}/5</p>
              </div>
              <div>
                <p style={{ color: 'var(--text-3)' }}>Service</p>
                <p style={{ color: 'var(--text-1)' }}>{session.review.serviceRating || session.review.overallRating}/5</p>
              </div>
            </div>
            <p className="mt-4 text-sm font-bold" style={{ color: 'var(--text-1)' }}>
              {session.review.comment?.trim() ? session.review.comment : 'Thanks for rating your dining experience.'}
            </p>
            <p className="mt-3 text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--brand)' }}>
              Service by {session.review.serviceStaffName || serviceStaffName}
              {tipSummary > 0 ? ` | Tip ${formatINR(tipSummary)}` : ''}
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 print:hidden">
          <button
            onClick={() => navigate(`/order/${tenantSlug}/session/${sessionId}`)}
            className="w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)', color: 'white' }}
          >
            <Receipt size={18} /> Back to Tracker
          </button>
          <button
            onClick={() => navigate(`/order/${tenantSlug}/history`)}
            className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all hover:opacity-100 opacity-60"
            style={{ color: 'var(--text-3)' }}
          >
            Session History
          </button>
        </div>
      </div>

      {showSplit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 print:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowSplit(false)} />
          <div className="bg-[color:var(--surface)] rounded-[40px] shadow-2xl relative z-10 w-full max-w-sm overflow-hidden" style={{ background: 'var(--surface)' }}>
            <div className="p-8 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black" style={{ color: 'var(--text-1)' }}>
                  Split Bill
                </h3>
                <button onClick={() => setShowSplit(false)} style={{ color: 'var(--text-3)' }}>
                  <X size={24} />
                </button>
              </div>

              <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>
                Split between how many?
              </p>
              <div className="flex items-center gap-4 p-2 rounded-2xl" style={{ background: 'var(--surface-3)' }}>
                <button
                  onClick={() => setSplitCount(Math.max(1, splitCount - 1))}
                  className="w-12 h-12 rounded-xl flex items-center justify-center bg-white shadow-sm transition-all active:scale-90"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="flex-1 text-center text-xl font-black" style={{ color: 'var(--text-1)' }}>
                  {splitCount}
                </span>
                <button
                  onClick={() => setSplitCount(splitCount + 1)}
                  className="w-12 h-12 rounded-xl flex items-center justify-center bg-white shadow-sm transition-all active:scale-90"
                  style={{ transform: 'rotate(180deg)' }}
                >
                  <ChevronLeft size={20} />
                </button>
              </div>

              <div className="mt-8 p-6 rounded-3xl text-center" style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-soft)' }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--brand)' }}>
                  Contribution per head
                </p>
                <p className="text-4xl font-black" style={{ color: 'var(--brand)' }}>
                  {formatINR(splitValues.perHead)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 print:hidden">
          <div className="absolute inset-0 bg-black/65 backdrop-blur-md" onClick={() => setCheckoutOpen(false)} />
          <div
            className="relative z-10 w-full max-w-md rounded-[32px] border p-6 shadow-2xl"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--text-3)' }}>
                  Bill Checkout
                </p>
                <h3 className="mt-2 text-2xl font-black" style={{ color: 'var(--text-1)' }}>
                  How would you like to pay?
                </h3>
                <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                  Total payable: {formatINR(totalPayable)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                className="rounded-xl p-2"
                style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => void requestPaymentMethod('cash')}
                disabled={requestingMethod !== null}
                className="flex items-center justify-between rounded-3xl border px-5 py-4 text-left transition-all active:scale-[0.98] disabled:opacity-60"
                style={{ background: 'var(--surface-3)', borderColor: 'var(--border)' }}
              >
                <div>
                  <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>Pay Cash</p>
                  <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
                    Pay the restaurant directly in cash and let them confirm the checkout.
                  </p>
                </div>
                <Wallet size={18} style={{ color: 'var(--brand)' }} />
              </button>

              <button
                type="button"
                onClick={() => void requestPaymentMethod('online')}
                disabled={requestingMethod !== null || !onlineAvailable}
                className="flex items-center justify-between rounded-3xl border px-5 py-4 text-left transition-all active:scale-[0.98] disabled:opacity-60"
                style={{ background: 'var(--surface-3)', borderColor: 'var(--border)' }}
              >
                <div>
                  <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>Pay Online</p>
                  <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
                    {onlineAvailable
                      ? 'Receive a locked UPI link from the restaurant for the exact final amount.'
                      : 'Online payment will appear here after the restaurant saves a UPI ID in settings.'}
                  </p>
                </div>
                <CreditCard size={18} style={{ color: 'var(--brand)' }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewOpen && !session?.review && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/65 backdrop-blur-md" />
          <div
            className="relative z-10 w-full max-w-md rounded-[32px] border p-6 shadow-2xl"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>
                  One-time Review
                </p>
                <h3 className="mt-2 text-2xl font-black" style={{ color: 'var(--text-1)' }}>
                  How was your experience?
                </h3>
                <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                  Payment is confirmed. Rate the food, service, and leave an optional tip for {serviceStaffName}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReviewDismissed(true);
                  setReviewOpen(false);
                }}
                className="rounded-xl p-2"
                style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 space-y-6">
              <RatingStars label="Food Rating" value={foodRating} onChange={setFoodRating} />
              <RatingStars label="Service Rating" value={serviceRating} onChange={setServiceRating} />

              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                  Tip for {serviceStaffName}
                </p>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[0, 50, 100, 200].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setTipAmount(amount)}
                      className="rounded-2xl px-3 py-3 text-sm font-black transition-all active:scale-[0.98]"
                      style={{
                        background: tipAmount === amount ? 'var(--brand)' : 'var(--surface-3)',
                        color: tipAmount === amount ? '#fff' : 'var(--text-1)',
                      }}
                    >
                      {amount === 0 ? 'No Tip' : formatINR(amount)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                  Comment
                </p>
                <textarea
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  placeholder="Tell us what stood out for you"
                  className="mt-3 min-h-[96px] w-full rounded-2xl p-4 text-sm font-semibold outline-none"
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setReviewDismissed(true);
                  setReviewOpen(false);
                }}
                className="flex-1 rounded-2xl py-3.5 text-sm font-black"
                style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
              >
                Later
              </button>
              <button
                type="button"
                onClick={submitReview}
                disabled={submittingReview || foodRating === 0 || serviceRating === 0 || !latestReviewableOrder}
                className="flex-1 rounded-2xl py-3.5 text-sm font-black text-white transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'var(--brand)' }}
              >
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
