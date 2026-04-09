import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { format } from 'date-fns';
import { formatINR } from '../lib/currency';
import { Zap, XCircle, Signal, RefreshCw } from 'lucide-react';

type DashboardRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN' | 'WAITER';

const TERMINAL_STATUSES = new Set(['RECEIVED', 'CANCELLED']);
const ORDER_STATUS_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'PREPARING', label: 'Preparing' },
  { value: 'READY', label: 'Ready' },
  { value: 'SERVED', label: 'Served' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;
const ORDER_STATUS_OPTION_STYLE: CSSProperties = {
  backgroundColor: '#ffffff',
  color: '#0f172a',
};

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
  const canEditSessionBatchStatus = effectiveRole === 'OWNER' || effectiveRole === 'MANAGER';
  const [activeTab, setActiveTab] = useState<'PIPELINE' | 'SESSIONS' | 'HISTORY'>('PIPELINE');
  const [busyMode, setBusyMode] = useState(false);
  const [overviewNow, setOverviewNow] = useState(() => new Date());

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
          old.filter((order) => order.id !== updatedOrder.id)
        );
        queryClient.invalidateQueries({ queryKey: ['order-history'] });
        queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
      } else {
        queryClient.setQueryData(['live-orders'], (old: any[] = []) =>
          old.map((order) => order.id === updatedOrder.id ? updatedOrder : order)
        );
      }
    }
  });

  if (isLoading) return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="rounded-xl p-6 h-48 animate-pulse" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <div className="w-1/3 h-6 rounded mb-4 shimmer"></div>
          <div className="w-1/4 h-4 rounded mb-6 shimmer"></div>
          <div className="space-y-3">
            <div className="w-full h-8 rounded shimmer"></div>
            <div className="w-5/6 h-8 rounded shimmer"></div>
          </div>
        </div>
      ))}
    </div>
  );

  const groupedLive = Object.values(
    liveOrders.reduce((acc: any, order: any) => {
      const fallbackOrderId = asOrderCode(order?.id);
      const gId = order?.diningSessionId || `single_${fallbackOrderId}`;
      if (!acc[gId]) {
        acc[gId] = {
          id: gId,
          isSession: Boolean(order?.diningSessionId),
          sessionId: order?.diningSessionId,
          session: order?.diningSession,
          table: order?.table,
          customerName: order?.diningSession?.customer?.name || order?.customerName,
          customerPhone: order?.diningSession?.customer?.phone || order?.customerPhone,
          orders: [],
          createdAt: order?.diningSession?.openedAt || order?.createdAt,
          totalAmount: 0,
        };
      }
      acc[gId].orders.push(order);
      acc[gId].totalAmount += toAmount(order?.totalAmount);
      return acc;
    }, {})
  ).sort((a: any, b: any) => toValidTimestamp(b?.createdAt) - toValidTimestamp(a?.createdAt));

  const TicketCard = ({ ticket }: { ticket: any }) => {
    const ticketOrders = Array.isArray(ticket?.orders) ? ticket.orders : [];
    const isCancelled = ticketOrders.length > 0 && ticketOrders.every((o: any) => o?.status === 'CANCELLED');
    const createdAtMs = toValidTimestamp(ticket?.createdAt);
    const elapsedMin = createdAtMs > 0 ? Math.max(0, Math.floor((Date.now() - createdAtMs) / 60000)) : 0;
    const guestDots = ticket.session?.partySize > 0
      ? Array.from({ length: Math.min(ticket.session.partySize, 6) })
      : [];

    const handleCloseSession = async (method: 'cash' | 'online') => {
      if (!canCloseSession) return;
      if (!confirm(`Finalize payment via ${method.toUpperCase()} and checkout?`)) return;
      const slug = await resolveTenantSlug();
      if (!slug) {
        alert('Tenant slug missing. Complete Business Profile setup first.');
        return;
      }
      try {
        await api.post(`/public/${slug}/sessions/${ticket.sessionId}/finish`);
        await api.post(`/public/${slug}/sessions/${ticket.sessionId}/complete`, { paymentMethod: method });
        queryClient.invalidateQueries({ queryKey: ['live-orders'] });
        queryClient.invalidateQueries({ queryKey: ['order-history'] });
        queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
      } catch (err: any) {
        alert(err?.response?.data?.error || err?.message || 'Failed to close session');
      }
    };

    return (
      <div className={`pipeline-card card-hover flex flex-col animate-in fade-in duration-300 ${isCancelled ? 'opacity-60' : ''}`} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        {/* Top stripe */}
        <div className={`pipeline-card-stripe ${isCancelled ? 'bg-red-400' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`} />

        <div className="p-4 flex flex-col gap-3">
          {/* Table + Time */}
          <div className="flex justify-between items-start">
            <div>
              <span className="font-black text-base block leading-tight" style={{ color: 'var(--text-1)' }}>
                {ticket.table ? `Table ${ticket.table.name}` : 'Takeaway'}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                {ticket.isSession ? 'Open Tab' : `#${asOrderCode(ticketOrders?.[0]?.id)}`} | {formatTimeValue(ticket?.createdAt)}
                {elapsedMin > 0 && ` | ${elapsedMin}m`}
              </span>
            </div>
            <span className="font-black text-blue-600 text-lg">{formatINR(ticket.totalAmount || 0)}</span>
          </div>

          {/* Guest dots + Customer */}
          <div className="flex items-center justify-between">
            {guestDots.length > 0 && (
              <div className="flex items-center gap-1">
                {guestDots.map((_, i) => <span key={i} className="w-5 h-5 bg-slate-100 border border-slate-200 rounded-full text-[9px] flex items-center justify-center font-black text-slate-500">{i + 1}</span>)}
                {ticket.session?.partySize > 6 && <span className="text-xs text-slate-400 font-bold">+{ticket.session.partySize - 6}</span>}
              </div>
            )}
            {ticket.customerName && (
              <span className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">{ticket.customerName}</span>
            )}
          </div>

          {/* Batch list */}
          <div className="space-y-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            {ticketOrders.map((order: any, idx: number) => (
              <div key={order.id} className="rounded-xl p-3" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Batch {idx + 1}</span>
                  <span className={`chip ${
                    order.status === 'NEW' ? 'chip-blue' :
                    order.status === 'PREPARING' ? 'chip-yellow' :
                    order.status === 'READY' ? 'chip-green' :
                    order.status === 'SERVED' ? 'chip-gray' : 'chip-gray'
                  }`}>{order.status}</span>
                </div>
                <ul className="space-y-1 mb-2">
                  {order.items?.map((item: any) => (
                    <li key={item.id} className="text-sm font-medium flex gap-2" style={{ color: 'var(--text-1)' }}>
                      <span className="font-black text-blue-600">{item.quantity}x</span>
                      {item.menuItem?.name || 'Item'}
                    </li>
                  ))}
                </ul>
                {canEditSessionBatchStatus ? (
                  <select
                    value={order.status}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === 'CANCELLED') {
                        const reason = window.prompt('Reason for cancellation?');
                        if (reason === null) return;
                        statusMutation.mutate({ id: order.id, status: next, cancelReason: reason });
                      } else {
                        statusMutation.mutate({ id: order.id, status: next });
                      }
                    }}
                    className="w-full text-xs rounded-lg font-bold px-3 py-1.5 outline-none cursor-pointer"
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      color: 'var(--input-text)',
                      colorScheme: 'light',
                      WebkitTextFillColor: 'var(--input-text)',
                    }}
                  >
                    {ORDER_STATUS_OPTIONS.map((statusOption) => (
                      <option key={statusOption.value} value={statusOption.value} style={ORDER_STATUS_OPTION_STYLE}>
                        {statusOption.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
                    Read-only for your role
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Close session CTA */}
          {ticket.isSession && (
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => handleCloseSession('cash')}
                disabled={!canCloseSession}
                className="flex-1 text-[11px] font-black uppercase tracking-wider bg-gradient-to-br from-orange-500 to-amber-600 text-white py-2.5 rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-orange-500/10 disabled:opacity-50"
              >
                Paid Cash
              </button>
              <button
                onClick={() => handleCloseSession('online')}
                disabled={!canCloseSession}
                className="flex-1 text-[11px] font-black uppercase tracking-wider bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-2.5 rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-blue-500/10 disabled:opacity-50"
              >
                Paid Online
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const PipelineCard = ({ order }: { order: any }) => {
    const createdAtMs = toValidTimestamp(order?.createdAt);
    const elapsed = createdAtMs > 0 ? Math.max(0, Math.floor((Date.now() - createdAtMs) / 60000)) : 0;
    const isUrgent = elapsed >= 15 && (order.status === 'NEW' || order.status === 'PREPARING');
    const stripeClass =
      order.status === 'NEW' || order.status === 'ACCEPTED' ? 'stripe-new' :
      order.status === 'PREPARING' ? 'stripe-preparing' :
      order.status === 'READY' ? 'stripe-ready' : 'stripe-served';

    return (
      <div className={`pipeline-card card-hover animate-in fade-in duration-300 ${isUrgent ? 'ring-1 ring-red-300' : ''}`} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <div className={`pipeline-card-stripe ${stripeClass}`} />
        <div className="p-4">
          <div className="flex justify-between items-start mb-1">
            <div>
              <span className="font-black text-sm block" style={{ color: 'var(--text-1)' }}>
                {order.orderNumber || `#${asOrderCode(order?.id)}`}
              </span>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--text-3)' }}>
                {order.table?.name ? `Table ${order.table.name}` : 'Takeaway'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold" style={{ color: 'var(--text-3)' }}>{formatTimeValue(order?.createdAt)}</span>
              {isUrgent && <div className="text-[10px] font-black text-red-500 mt-0.5">Alert: {elapsed}m</div>}
            </div>
          </div>

          <ul className="mt-3 mb-4 space-y-1.5">
            {order.items?.map((item: any) => (
              <li key={item.id} className="flex gap-2 text-sm font-medium items-start" style={{ color: 'var(--text-1)' }}>
                <span className="bg-blue-50 text-blue-700 text-xs font-black px-1.5 py-0.5 rounded-md flex-shrink-0 mt-0.5">{item.quantity}x</span>
                <span className="leading-tight">{item.menuItem?.name || item.name}</span>
              </li>
            ))}
          </ul>

          {order.status === 'NEW' && canSetKitchenStages && (
            <button onClick={() => statusMutation.mutate({ id: order.id, status: 'ACCEPTED' })} disabled={statusMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 shadow-md shadow-blue-600/20 text-sm">
              Accept Order
            </button>
          )}
          {order.status === 'ACCEPTED' && canSetKitchenStages && (
            <button onClick={() => statusMutation.mutate({ id: order.id, status: 'PREPARING' })} disabled={statusMutation.isPending}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 shadow-md shadow-amber-500/20 text-sm">
              Start Preparing
            </button>
          )}
          {order.status === 'PREPARING' && canSetKitchenStages && (
            <button onClick={() => statusMutation.mutate({ id: order.id, status: 'READY' })} disabled={statusMutation.isPending}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 shadow-md shadow-orange-500/20 text-sm">
              Mark Ready
            </button>
          )}
          {order.status === 'READY' && canSetServiceStages && (
            <button onClick={() => statusMutation.mutate({ id: order.id, status: 'SERVED' })} disabled={statusMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 shadow-md shadow-emerald-600/20 text-sm">
              Mark Served
            </button>
          )}
          {order.status === 'SERVED' && canSetServiceStages && (
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-50 border border-gray-200 text-gray-500 py-2.5 rounded-xl text-center text-sm font-bold">
                Awaiting Receipt
              </div>
              <button onClick={() => statusMutation.mutate({ id: order.id, status: 'RECEIVED' })}
                className="px-3 bg-gray-200 hover:bg-gray-300 text-gray-600 font-bold rounded-xl text-xs transition-all">
                Done
              </button>
            </div>
          )}
          {((order.status === 'NEW' && !canSetKitchenStages) ||
            (order.status === 'ACCEPTED' && !canSetKitchenStages) ||
            (order.status === 'PREPARING' && !canSetKitchenStages) ||
            (order.status === 'READY' && !canSetServiceStages) ||
            (order.status === 'SERVED' && !canSetServiceStages)) && (
            <div className="w-full rounded-xl py-2 text-center text-xs font-semibold" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
              Read-only for your role
            </div>
          )}
        </div>
      </div>
    );
  };

  const connectionTone = {
    label: 'Synced',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  const overviewTimestamp = format(overviewNow, 'MMM d, yyyy | h:mm a');

  return (
    <div className="flex h-full min-h-0 flex-col p-3 sm:p-5 lg:p-8">
      <div className="mb-4 flex flex-col gap-3 lg:mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-2" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
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
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                  busyMode ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : ''
                }`}
                style={busyMode ? undefined : { background: 'var(--surface-3)', color: 'var(--text-2)' }}
              >
                <Zap size={14} /> {busyMode ? 'Busy ON' : 'Busy Mode'}
              </button>
            )}
            {canBulkClose && (
              <button
                onClick={() => {
                  if (confirm('Close ALL live kitchen batches? This will mark them as Served.')) {
                    liveOrders.forEach((o: any) => statusMutation.mutate({ id: o.id, status: 'SERVED' }));
                  }
                }}
                disabled={liveOrders.length === 0}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all disabled:opacity-40"
                style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
              >
                <XCircle size={14} /> Close All
              </button>
            )}
          </div>
        </div>

        <div className="flex w-full max-w-full overflow-x-auto rounded-xl p-1.5" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
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
        <div className="flex-1 overflow-x-auto custom-scrollbar p-6 flex gap-6 h-full" style={{ background: 'var(--kanban-bg)' }}>
          {[
            { label: 'NEW ORDERS', color: 'text-blue-700', bg: 'bg-blue-50 border-b border-blue-100', badge: 'bg-blue-100 text-blue-800', filter: (o: any) => o.status === 'NEW', stripe: 'stripe-new', pulse: true },
            { label: 'IN KITCHEN', color: 'text-amber-700', bg: 'bg-amber-50 border-b border-amber-100', badge: 'bg-amber-100 text-amber-800', filter: (o: any) => o.status === 'ACCEPTED' || o.status === 'PREPARING', stripe: 'stripe-preparing', pulse: false },
            { label: 'READY TO SERVE', color: 'text-emerald-700', bg: 'bg-emerald-50 border-b border-emerald-100', badge: 'bg-emerald-100 text-emerald-800', filter: (o: any) => o.status === 'READY', stripe: 'stripe-ready', pulse: false },
            { label: 'SERVED', color: 'text-slate-600', bg: 'bg-slate-100 border-b border-slate-200', badge: 'bg-slate-200 text-slate-600', filter: (o: any) => o.status === 'SERVED', stripe: 'stripe-served', pulse: false },
          ].map(({ label, color, bg, badge, filter, pulse }) => {
            const colOrders = liveOrders.filter(filter);
            return (
              <div key={label} className="kanban-col flex-shrink-0">
                <div className={`kanban-col-header shadow-sm z-10 ${bg}`}>
                  <div className="flex items-center gap-2.5">
                    {pulse && colOrders.length > 0 && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                    )}
                    <span className={`font-black text-[11px] tracking-[0.15em] ${color}`}>
                      {label}
                    </span>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${badge}`}>{colOrders.length}</span>
                </div>
                <div className="kanban-col-body custom-scrollbar">
                  {colOrders.map((order: any) => <PipelineCard key={order.id} order={order} />)}
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
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 rounded-3xl" style={{ background: 'var(--kanban-bg)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
            {groupedLive.map((ticket: any) => <TicketCard key={ticket.id} ticket={ticket} />)}
            {groupedLive.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center mt-20">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4"><span className="text-2xl font-black text-slate-500">Table</span></div>
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
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 rounded-3xl" style={{ background: 'var(--kanban-bg)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
            {historyOrders.map((order: any) => <TicketCard key={`history_${order.id}`} ticket={{ ...order, isSession: false, orders: [order] }} />)}
            {historyOrders.length === 0 && (
              <div className="col-span-full text-center mt-20">
                <p className="text-gray-500 font-semibold">No completed orders yet</p>
                <p className="text-gray-400 text-sm mt-1">Complete a live order to populate billing and history.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
