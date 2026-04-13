import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { formatINR } from '../lib/currency';
import { CreditCard, ReceiptText, RefreshCw, Signal, XCircle, Zap } from 'lucide-react';

type DashboardRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN' | 'WAITER';
type BillWorkflowAction = 'AWAITING_BILL' | 'PAID_CASH' | 'PAID_ONLINE';

const TERMINAL_STATUSES = new Set(['RECEIVED', 'CANCELLED']);

function readRestaurantSlugFromStorage() {
  try {
    const raw = localStorage.getItem('restaurant');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return typeof parsed?.slug === 'string' ? parsed.slug.trim() : '';
  } catch {
    return '';
  }
}

function isValidSlug(value: string) {
  return /^[a-z0-9-]+$/i.test(value);
}

function resolveRole(rawRole?: string | null): DashboardRole {
  const normalized = (rawRole || '').toUpperCase();
  if (normalized === 'MANAGER') return 'MANAGER';
  if (normalized === 'CASHIER') return 'CASHIER';
  if (normalized === 'KITCHEN') return 'KITCHEN';
  if (normalized === 'WAITER') return 'WAITER';
  return 'OWNER';
}

function parseDateValue(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatTimeValue(value: unknown, fallback = '--:--') {
  const parsed = parseDateValue(value);
  if (!parsed) return fallback;
  return format(parsed, 'h:mm a');
}

function asOrderCode(value: unknown) {
  const raw = typeof value === 'string' ? value : String(value || '');
  if (!raw) return '------';
  return raw.slice(-6).toUpperCase();
}

function toAmount(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toValidTimestamp(value: unknown) {
  const parsed = parseDateValue(value);
  return parsed ? parsed.getTime() : 0;
}

function formatElapsedLabel(totalMinutes: number) {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours > 0) return `${days}d ${remainingHours}h`;
  return `${days}d`;
}

function getTableLabel(entity: { table?: { name?: string } | null; orderType?: string | null }) {
  if (entity.table?.name) return `Table ${entity.table.name}`;
  return String(entity.orderType || '').toUpperCase() === 'TAKEAWAY' ? 'Takeaway Pack' : 'Takeaway';
}

function getStatusChipClass(status: string) {
  if (status === 'NEW' || status === 'ACCEPTED') return 'chip-blue';
  if (status === 'PREPARING') return 'chip-yellow';
  if (status === 'READY') return 'chip-green';
  return 'chip-gray';
}

export function Orders({ role }: { role?: string }) {
  const queryClient = useQueryClient();
  const effectiveRole = resolveRole(role || localStorage.getItem('userRole'));
  const onlyPipeline = effectiveRole === 'KITCHEN';
  const canViewSessions = effectiveRole !== 'KITCHEN';
  const canViewHistory = effectiveRole !== 'KITCHEN';
  const canCloseSession = effectiveRole === 'OWNER' || effectiveRole === 'MANAGER' || effectiveRole === 'CASHIER';
  const canBulkClose = effectiveRole === 'OWNER' || effectiveRole === 'MANAGER';
  const canToggleBusyMode = effectiveRole === 'OWNER' || effectiveRole === 'MANAGER';
  const canSetKitchenStages = ['OWNER', 'MANAGER', 'KITCHEN'].includes(effectiveRole);
  const canSetServiceStages = ['OWNER', 'MANAGER', 'CASHIER', 'WAITER'].includes(effectiveRole);
  const [activeTab, setActiveTab] = useState<'PIPELINE' | 'SESSIONS' | 'HISTORY'>('PIPELINE');
  const [busyMode, setBusyMode] = useState(false);
  const [overviewNow, setOverviewNow] = useState(() => new Date());
  const [billSelections, setBillSelections] = useState<Record<string, BillWorkflowAction>>({});

  useEffect(() => {
    if (onlyPipeline && activeTab !== 'PIPELINE') {
      setActiveTab('PIPELINE');
    }
  }, [activeTab, onlyPipeline]);

  useEffect(() => {
    const id = window.setInterval(() => setOverviewNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const { data: businessSettings } = useQuery<{ slug?: string }>({
    queryKey: ['settings-business'],
    queryFn: async () => {
      const res = await api.get('/settings/business');
      return res.data;
    },
    staleTime: 1000 * 60,
  });

  const resolveTenantSlug = useCallback(async () => {
    const fromQuery = (businessSettings?.slug || '').trim();
    if (fromQuery && isValidSlug(fromQuery)) return fromQuery;

    const fromStorage = readRestaurantSlugFromStorage().trim();
    if (fromStorage && isValidSlug(fromStorage)) return fromStorage;
    return '';
  }, [businessSettings?.slug]);

  const openTestOrder = async () => {
    const slug = await resolveTenantSlug();
    if (!slug) {
      alert('Tenant slug missing. Complete Business Profile setup first.');
      return;
    }
    window.open(`/order/${slug}`, '_blank', 'noopener,noreferrer');
  };

  const refreshOperationalData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['live-orders'] });
    queryClient.invalidateQueries({ queryKey: ['order-history'] });
    queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
  }, [queryClient]);

  const { data: liveOrders = [], isLoading } = useQuery<any[]>({
    queryKey: ['live-orders'],
    queryFn: async () => {
      const res = await api.get('/orders');
      return res.data;
    },
    staleTime: 1000 * 10,
  });

  const { data: historyResponse } = useQuery<any>({
    queryKey: ['order-history'],
    queryFn: async () => {
      const res = await api.get('/orders/history');
      return res.data;
    },
    staleTime: 1000 * 30,
  });
  const historyOrders = historyResponse?.data || [];

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, cancelReason }: any) => {
      const res = await api.patch(`/orders/${id}/status`, { status, cancelReason });
      return res.data;
    },
    onSuccess: (updatedOrder: any) => {
      if (TERMINAL_STATUSES.has(updatedOrder.status)) {
        queryClient.setQueryData(['live-orders'], (old: any[] = []) =>
          old.filter((order) => order.id !== updatedOrder.id),
        );
        queryClient.invalidateQueries({ queryKey: ['order-history'] });
        queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
      } else {
        queryClient.setQueryData(['live-orders'], (old: any[] = []) =>
          old.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)),
        );
      }
    },
  });

  const finishSessionMutation = useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      const slug = await resolveTenantSlug();
      if (!slug) {
        throw new Error('Tenant slug missing. Complete Business Profile setup first.');
      }
      return api.post(`/public/${slug}/sessions/${sessionId}/finish`);
    },
    onSuccess: refreshOperationalData,
    onError: (error: any) => {
      window.alert(error?.response?.data?.error || error?.message || 'Could not move this table to billing.');
    },
  });

  const completeSessionMutation = useMutation({
    mutationFn: async ({ sessionId, paymentMethod }: { sessionId: string; paymentMethod: 'cash' | 'online' }) => {
      const slug = await resolveTenantSlug();
      if (!slug) {
        throw new Error('Tenant slug missing. Complete Business Profile setup first.');
      }
      return api.post(`/public/${slug}/sessions/${sessionId}/complete`, { paymentMethod });
    },
    onSuccess: refreshOperationalData,
    onError: (error: any) => {
      window.alert(error?.response?.data?.error || error?.message || 'Could not confirm payment for this bill.');
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-xl p-6 h-48 animate-pulse"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          >
            <div className="w-1/3 h-6 rounded mb-4 shimmer" />
            <div className="w-1/4 h-4 rounded mb-6 shimmer" />
            <div className="space-y-3">
              <div className="w-full h-8 rounded shimmer" />
              <div className="w-5/6 h-8 rounded shimmer" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const groupedLive = Object.values(
    liveOrders.reduce((acc: any, order: any) => {
      const fallbackOrderId = asOrderCode(order?.id);
      const groupId = order?.diningSessionId || `single_${fallbackOrderId}`;
      if (!acc[groupId]) {
        acc[groupId] = {
          id: groupId,
          isSession: Boolean(order?.diningSessionId),
          sessionId: order?.diningSessionId,
          session: order?.diningSession,
          table: order?.table,
          orderType: order?.orderType,
          customerName: order?.diningSession?.customer?.name || order?.customerName,
          customerPhone: order?.diningSession?.customer?.phone || order?.customerPhone,
          orders: [],
          createdAt: order?.diningSession?.openedAt || order?.createdAt,
          totalAmount: 0,
        };
      }
      acc[groupId].orders.push(order);
      acc[groupId].totalAmount += toAmount(order?.totalAmount);
      return acc;
    }, {}),
  ).sort((a: any, b: any) => toValidTimestamp(b?.createdAt) - toValidTimestamp(a?.createdAt));

  const historyTickets = useMemo(
    () =>
      Object.values(
        historyOrders.reduce((acc: any, order: any) => {
          const groupId = order?.diningSessionId ? `history_session_${order.diningSessionId}` : `history_order_${order.id}`;
          if (!acc[groupId]) {
            acc[groupId] = {
              id: groupId,
              isSession: Boolean(order?.diningSessionId),
              sessionId: order?.diningSessionId,
              session: order?.diningSession,
              table: order?.table,
              orderType: order?.orderType,
              customerName: order?.diningSession?.customer?.name || order?.customerName,
              customerPhone: order?.diningSession?.customer?.phone || order?.customerPhone,
              orders: [],
              createdAt: order?.diningSession?.openedAt || order?.createdAt,
              totalAmount: 0,
            };
          }
          acc[groupId].orders.push(order);
          acc[groupId].totalAmount += toAmount(order?.totalAmount);
          return acc;
        }, {}),
      ).sort((a: any, b: any) => toValidTimestamp(b?.createdAt) - toValidTimestamp(a?.createdAt)),
    [historyOrders],
  );

  const connectionTone = {
    label: 'Synced',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  const overviewTimestamp = format(overviewNow, 'MMM d, yyyy | h:mm a');
  const readyOrders = liveOrders.filter((order: any) => order.status === 'READY');

  const TicketCard = ({ ticket }: { ticket: any }) => {
    const ticketOrders = Array.isArray(ticket?.orders) ? ticket.orders : [];
    const sessionStatus = String(ticket?.session?.sessionStatus || '').toUpperCase();
    const sessionPaymentMethod = String(ticket?.session?.bill?.paymentMethod || '').toUpperCase();
    const isCancelled = ticketOrders.length > 0 && ticketOrders.every((o: any) => o?.status === 'CANCELLED');
    const isClosedSession = ticket.isSession && sessionStatus === 'CLOSED';
    const createdAtMs = toValidTimestamp(ticket?.createdAt);
    const elapsedMin = createdAtMs > 0 ? Math.max(0, Math.floor((Date.now() - createdAtMs) / 60000)) : 0;
    const guestDots =
      ticket.session?.partySize > 0 ? Array.from({ length: Math.min(ticket.session.partySize, 6) }) : [];
    const activeBatches = ticketOrders.filter((order: any) => order?.status !== 'CANCELLED');
    const outstandingBatches = activeBatches.filter(
      (order: any) => !['SERVED', 'RECEIVED'].includes(String(order?.status || '').toUpperCase()),
    );
    const canGenerateBill =
      ticket.isSession &&
      canCloseSession &&
      ticket.sessionId &&
      sessionStatus !== 'AWAITING_BILL' &&
      sessionStatus !== 'CLOSED' &&
      activeBatches.length > 0 &&
      outstandingBatches.length === 0;
    const canCapturePayment = ticket.isSession && canCloseSession && ticket.sessionId && sessionStatus === 'AWAITING_BILL';
    const selectedBillAction = ticket.sessionId ? billSelections[ticket.sessionId] || 'AWAITING_BILL' : 'AWAITING_BILL';
    const finishPending =
      finishSessionMutation.isPending && finishSessionMutation.variables?.sessionId === ticket.sessionId;
    const paymentPending =
      completeSessionMutation.isPending && completeSessionMutation.variables?.sessionId === ticket.sessionId;

    return (
      <div
        className={`pipeline-card card-hover flex flex-col animate-in fade-in duration-300 ${isCancelled ? 'opacity-60' : ''}`}
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        <div
          className={`pipeline-card-stripe ${isCancelled ? 'bg-red-400' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`}
        />

        <div className="p-4 flex flex-col gap-3">
          <div className="flex justify-between items-start">
            <div>
              <span className="font-black text-base block leading-tight" style={{ color: 'var(--text-1)' }}>
                {getTableLabel(ticket)}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                {ticket.isSession ? 'Open Tab' : `#${asOrderCode(ticketOrders?.[0]?.id)}`} | {formatTimeValue(ticket?.createdAt)}
                {elapsedMin > 0 && ` | ${formatElapsedLabel(elapsedMin)}`}
              </span>
            </div>
            <div className="text-right">
              <span className="font-black text-blue-600 text-lg">{formatINR(ticket.totalAmount || 0)}</span>
              {ticket.isSession && sessionStatus && (
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                  {sessionStatus.replace(/_/g, ' ')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            {guestDots.length > 0 && (
              <div className="flex items-center gap-1">
                {guestDots.map((_, i) => (
                  <span
                    key={i}
                    className="w-5 h-5 bg-slate-100 border border-slate-200 rounded-full text-[9px] flex items-center justify-center font-black text-slate-500"
                  >
                    {i + 1}
                  </span>
                ))}
                {ticket.session?.partySize > 6 && (
                  <span className="text-xs text-slate-400 font-bold">+{ticket.session.partySize - 6}</span>
                )}
              </div>
            )}
            {ticket.customerName && (
              <span className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                {ticket.customerName}
              </span>
            )}
          </div>

          <div className="space-y-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            {ticketOrders.map((order: any, idx: number) => (
              <div
                key={order.id}
                className="rounded-xl p-3"
                style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
              >
                <div className="flex justify-between items-center gap-3 mb-2">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                      Batch {idx + 1}
                    </span>
                    <p className="text-[11px] font-semibold mt-1" style={{ color: 'var(--text-3)' }}>
                      {order.orderNumber || `#${asOrderCode(order.id)}`} | {formatTimeValue(order.createdAt)}
                    </p>
                  </div>
                  <span className={`chip ${getStatusChipClass(String(order.status || '').toUpperCase())}`}>
                    {order.status}
                  </span>
                </div>
                <ul className="space-y-1">
                  {order.items?.map((item: any) => (
                    <li key={item.id} className="text-sm font-medium flex gap-2" style={{ color: 'var(--text-1)' }}>
                      <span className="font-black text-blue-600">{item.quantity}x</span>
                      {item.menuItem?.name || item.name || 'Item'}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {ticket.isSession && (
            <div
              className="rounded-2xl p-3"
              style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
            >
              {isClosedSession ? (
                <>
                  <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                    Session Closed
                  </p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                    Payment settled{sessionPaymentMethod ? ` via ${sessionPaymentMethod.toLowerCase()}.` : '.'} This full bill is now archived in today&apos;s history.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                    Bill Workflow
                  </p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                    {outstandingBatches.length > 0
                      ? `${outstandingBatches.length} active batch${outstandingBatches.length > 1 ? 'es are' : ' is'} still moving through the pipeline.`
                      : sessionStatus === 'AWAITING_BILL'
                        ? 'The final bill is with the guest. Mark the payment once it is settled.'
                        : 'All served batches will merge into one full bill for this table.'}
                  </p>
                  {canCloseSession && ticket.sessionId && (
                    <div className="mt-3 flex gap-2">
                      <select
                        value={selectedBillAction}
                        onChange={(event) =>
                          setBillSelections((previous) => ({
                            ...previous,
                            [ticket.sessionId]: event.target.value as BillWorkflowAction,
                          }))
                        }
                        className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm font-black outline-none"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                      >
                        <option value="AWAITING_BILL">Waiting for Bill</option>
                        <option value="PAID_CASH">Paid Cash</option>
                        <option value="PAID_ONLINE">Paid Online</option>
                      </select>
                      <button
                        onClick={() => {
                          if (!ticket.sessionId) return;
                          if (selectedBillAction === 'AWAITING_BILL') {
                            if (!canGenerateBill && sessionStatus !== 'AWAITING_BILL') {
                              window.alert('Serve every active batch before moving this table to billing.');
                              return;
                            }
                            if (sessionStatus === 'AWAITING_BILL') {
                              return;
                            }
                            finishSessionMutation.mutate({ sessionId: ticket.sessionId });
                            return;
                          }

                          if (!canCapturePayment) {
                            window.alert('Generate the final bill first, then mark the payment method.');
                            return;
                          }

                          completeSessionMutation.mutate({
                            sessionId: ticket.sessionId,
                            paymentMethod: selectedBillAction === 'PAID_ONLINE' ? 'online' : 'cash',
                          });
                        }}
                        disabled={finishPending || paymentPending}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-500 disabled:opacity-60"
                      >
                        <ReceiptText size={15} />
                        {finishPending
                          ? 'Sharing Bill...'
                          : paymentPending
                            ? 'Saving...'
                            : selectedBillAction === 'AWAITING_BILL'
                              ? sessionStatus === 'AWAITING_BILL'
                                ? 'Bill Shared'
                                : 'Update'
                              : 'Update'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const PipelineCard = ({ order }: { order: any }) => {
    const createdAtMs = toValidTimestamp(order?.createdAt);
    const elapsedMinutes = createdAtMs > 0 ? Math.max(0, Math.floor((Date.now() - createdAtMs) / 60000)) : 0;
    const isUrgent = elapsedMinutes >= 15 && ['NEW', 'ACCEPTED', 'PREPARING'].includes(String(order?.status || '').toUpperCase());
    const stripeClass =
      order.status === 'NEW' || order.status === 'ACCEPTED'
        ? 'stripe-new'
        : order.status === 'PREPARING'
          ? 'stripe-preparing'
          : order.status === 'READY'
            ? 'stripe-ready'
            : 'stripe-served';
    const sessionStatus = String(order?.diningSession?.sessionStatus || '').toUpperCase();
    const isSessionOrder = Boolean(order?.diningSessionId);

    return (
      <div
        className={`pipeline-card card-hover animate-in fade-in duration-300 ${isUrgent ? 'ring-1 ring-red-300' : ''}`}
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        <div className={`pipeline-card-stripe ${stripeClass}`} />
        <div className="p-4">
          <div className="flex justify-between items-start mb-1">
            <div>
              <span className="font-black text-sm block" style={{ color: 'var(--text-1)' }}>
                {order.orderNumber || `#${asOrderCode(order?.id)}`}
              </span>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--text-3)' }}>
                {getTableLabel(order)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold" style={{ color: 'var(--text-3)' }}>
                {formatTimeValue(order?.createdAt)}
              </span>
              {isUrgent && (
                <div className="text-[10px] font-black text-red-500 mt-0.5">
                  Alert: {formatElapsedLabel(elapsedMinutes)}
                </div>
              )}
            </div>
          </div>

          <ul className="mt-3 mb-4 space-y-1.5">
            {order.items?.map((item: any) => (
              <li key={item.id} className="flex gap-2 text-sm font-medium items-start" style={{ color: 'var(--text-1)' }}>
                <span className="bg-blue-50 text-blue-700 text-xs font-black px-1.5 py-0.5 rounded-md flex-shrink-0 mt-0.5">
                  {item.quantity}x
                </span>
                <span className="leading-tight">{item.menuItem?.name || item.name}</span>
              </li>
            ))}
          </ul>

          {order.status === 'NEW' && canSetKitchenStages && (
            <button
              onClick={() => statusMutation.mutate({ id: order.id, status: 'ACCEPTED' })}
              disabled={statusMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 shadow-md shadow-blue-600/20 text-sm"
            >
              Accept Order
            </button>
          )}
          {order.status === 'ACCEPTED' && canSetKitchenStages && (
            <button
              onClick={() => statusMutation.mutate({ id: order.id, status: 'PREPARING' })}
              disabled={statusMutation.isPending}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 shadow-md shadow-amber-500/20 text-sm"
            >
              Start Preparing
            </button>
          )}
          {order.status === 'PREPARING' && canSetKitchenStages && (
            <button
              onClick={() => statusMutation.mutate({ id: order.id, status: 'READY' })}
              disabled={statusMutation.isPending}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 shadow-md shadow-orange-500/20 text-sm"
            >
              Mark Ready
            </button>
          )}
          {order.status === 'READY' && canSetServiceStages && (
            <button
              onClick={() => statusMutation.mutate({ id: order.id, status: 'SERVED' })}
              disabled={statusMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 shadow-md shadow-emerald-600/20 text-sm"
            >
              Mark Served
            </button>
          )}
          {order.status === 'SERVED' && isSessionOrder && (
            <div
              className="rounded-xl border px-3 py-3 text-sm font-bold"
              style={{ background: 'var(--surface-3)', borderColor: 'var(--border)', color: 'var(--text-2)' }}
            >
              <p className="font-black uppercase text-[11px] tracking-[0.14em]" style={{ color: 'var(--text-3)' }}>
                Final Billing
              </p>
              <p className="mt-1">
                {sessionStatus === 'AWAITING_BILL' ? 'Bill generated. Waiting for payment.' : 'Waiting for the final table bill.'}
              </p>
            </div>
          )}
          {order.status === 'SERVED' && !isSessionOrder && canSetServiceStages && (
            <button
              onClick={() => statusMutation.mutate({ id: order.id, status: 'RECEIVED' })}
              disabled={statusMutation.isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 transition-all active:scale-[0.97] disabled:opacity-50 shadow-md shadow-slate-800/20 text-sm"
            >
              <CreditCard size={15} />
              Mark Paid
            </button>
          )}
          {((order.status === 'NEW' && !canSetKitchenStages) ||
            (order.status === 'ACCEPTED' && !canSetKitchenStages) ||
            (order.status === 'PREPARING' && !canSetKitchenStages) ||
            (order.status === 'READY' && !canSetServiceStages) ||
            (order.status === 'SERVED' && !canSetServiceStages && !isSessionOrder)) && (
            <div
              className="w-full rounded-xl py-2 text-center text-xs font-semibold"
              style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-3)' }}
            >
              Read-only for your role
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col p-3 sm:p-5 lg:p-8">
      <div className="mb-4 flex flex-col gap-3 lg:mb-6">
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-2"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${connectionTone.className}`}>
              <Signal size={12} />
              {connectionTone.label}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--text-3)' }}>
              {overviewTimestamp}
            </span>
            {busyMode && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-black text-rose-600">
                <Zap size={12} /> Busy Mode
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={refreshOperationalData}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
            >
              <RefreshCw size={12} /> Sync
            </button>
            {canToggleBusyMode && (
              <button
                onClick={() => setBusyMode(!busyMode)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${busyMode ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : ''}`}
                style={busyMode ? undefined : { background: 'var(--surface-3)', color: 'var(--text-2)' }}
              >
                <Zap size={14} /> {busyMode ? 'Busy ON' : 'Busy Mode'}
              </button>
            )}
            {canBulkClose && (
              <button
                onClick={() => {
                  if (readyOrders.length === 0) return;
                  if (confirm('Mark every READY order as served?')) {
                    readyOrders.forEach((order: any) => statusMutation.mutate({ id: order.id, status: 'SERVED' }));
                  }
                }}
                disabled={readyOrders.length === 0}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all disabled:opacity-40"
                style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
              >
                <XCircle size={14} /> Serve Ready
              </button>
            )}
          </div>
        </div>
        <div
          className="flex w-full max-w-full overflow-x-auto rounded-xl p-1.5 sm:p-2"
          style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
        >
          <button
            onClick={() => setActiveTab('PIPELINE')}
            className="px-4 py-2 rounded-lg text-sm font-bold transition-all focus-visible:outline-none sm:px-6"
            style={activeTab === 'PIPELINE' ? { background: 'var(--card-bg)', color: 'var(--brand)', boxShadow: 'var(--card-shadow)' } : { color: 'var(--text-3)' }}
          >
            Order Pipeline
          </button>
          {canViewSessions && (
            <button
              onClick={() => setActiveTab('SESSIONS')}
              className="px-4 py-2 rounded-lg text-sm font-bold transition-all focus-visible:outline-none sm:px-6"
              style={activeTab === 'SESSIONS' ? { background: 'var(--card-bg)', color: 'var(--brand)', boxShadow: 'var(--card-shadow)' } : { color: 'var(--text-3)' }}
            >
              Table Sessions
            </button>
          )}
          {canViewHistory && (
            <button
              onClick={() => setActiveTab('HISTORY')}
              className="px-4 py-2 rounded-lg text-sm font-bold transition-all focus-visible:outline-none sm:px-6"
              style={activeTab === 'HISTORY' ? { background: 'var(--card-bg)', color: 'var(--brand)', boxShadow: 'var(--card-shadow)' } : { color: 'var(--text-3)' }}
            >
              Order History
            </button>
          )}
        </div>
      </div>

      {activeTab === 'PIPELINE' ? (
        <div
          className="flex flex-1 flex-col gap-4 overflow-y-auto custom-scrollbar p-3 sm:p-4 lg:h-full lg:flex-row lg:gap-6 lg:overflow-x-auto lg:overflow-y-hidden lg:p-6"
          style={{ background: 'var(--kanban-bg)' }}
        >
          {[
            { label: 'NEW ORDERS', color: 'text-blue-700', bg: 'bg-blue-50 border-b border-blue-100', badge: 'bg-blue-100 text-blue-800', filter: (o: any) => o.status === 'NEW', pulse: true },
            { label: 'IN KITCHEN', color: 'text-amber-700', bg: 'bg-amber-50 border-b border-amber-100', badge: 'bg-amber-100 text-amber-800', filter: (o: any) => o.status === 'ACCEPTED' || o.status === 'PREPARING', pulse: false },
            { label: 'READY TO SERVE', color: 'text-emerald-700', bg: 'bg-emerald-50 border-b border-emerald-100', badge: 'bg-emerald-100 text-emerald-800', filter: (o: any) => o.status === 'READY', pulse: false },
            { label: 'SERVED', color: 'text-slate-600', bg: 'bg-slate-100 border-b border-slate-200', badge: 'bg-slate-200 text-slate-600', filter: (o: any) => o.status === 'SERVED', pulse: false },
          ].map(({ label, color, bg, badge, filter, pulse }) => {
            const colOrders = liveOrders.filter(filter);
            return (
              <div key={label} className="kanban-col flex-shrink-0">
                <div className={`kanban-col-header shadow-sm z-10 ${bg}`}>
                  <div className="flex items-center gap-2.5">
                    {pulse && colOrders.length > 0 && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                      </span>
                    )}
                    <span className={`font-black text-[11px] tracking-[0.15em] ${color}`}>{label}</span>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${badge}`}>{colOrders.length}</span>
                </div>
                <div className="kanban-col-body custom-scrollbar">
                  {colOrders.map((order: any) => (
                    <PipelineCard key={order.id} order={order} />
                  ))}
                  {colOrders.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full py-16 text-center px-4">
                      <p className="text-slate-500 text-sm font-semibold">No orders yet</p>
                      <p className="text-slate-400 text-xs mt-1">Start by scanning a QR or placing a test order.</p>
                      <button
                        onClick={openTestOrder}
                        className="mt-3 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                      >
                        Create Test Order
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : activeTab === 'SESSIONS' ? (
        <div
          className="flex-1 overflow-y-auto custom-scrollbar p-3 rounded-3xl sm:p-4 lg:p-6"
          style={{ background: 'var(--kanban-bg)', border: '1px solid var(--border)' }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6 items-start">
            {groupedLive.map((ticket: any) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
            {groupedLive.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center mt-20">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl font-black text-slate-500">Table</span>
                </div>
                <p className="text-gray-600 font-bold text-lg">No active sessions</p>
                <p className="text-gray-400 text-sm mt-1">Start by scanning a QR or placing a test order.</p>
                <button
                  onClick={openTestOrder}
                  className="mt-3 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
                >
                  Create Test Order
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto custom-scrollbar p-3 rounded-3xl sm:p-4 lg:p-6"
          style={{ background: 'var(--kanban-bg)', border: '1px solid var(--border)' }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6 items-start">
            {historyTickets.map((ticket: any) => (
              <TicketCard key={`history_${ticket.id}`} ticket={ticket} />
            ))}
            {historyTickets.length === 0 && (
              <div className="col-span-full text-center mt-20">
                <p className="text-gray-500 font-semibold">No completed orders recorded today</p>
                <p className="text-gray-400 text-sm mt-1">History now resets daily and shows only the current day.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
