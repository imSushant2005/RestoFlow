import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Clock3, HelpCircle, IndianRupee, Loader2, Receipt, UtensilsCrossed } from 'lucide-react';
import { io } from 'socket.io-client';
import { api } from '../lib/api';
import { getSocketUrl } from '../lib/network';

type WaiterCallType = 'WAITER' | 'BILL' | 'WATER' | 'EXTRA' | 'HELP';
type LanguageKey = 'en' | 'hi' | 'hinglish';

type WaiterCallAlert = {
  id: string;
  dedupeKey: string;
  tableId?: string;
  tableName?: string;
  sessionId?: string;
  type?: WaiterCallType | string;
  timestamp?: string;
};

type ReadyPickupCard = {
  orderId: string;
  orderNumber: string;
  destinationLabel: string;
  tableName: string | null;
  floorName: string | null;
  orderType: string;
  itemCount: number;
  readyAt?: string;
  version?: number;
  items: Array<{ id: string; name: string; quantity: number }>;
};

const COPY = {
  en: {
    title: 'Waiter Desk',
    subtitle: 'Prioritized pickup, bill requests, and guest assistance in one place.',
    active: 'Active now',
    ready: 'Ready to deliver',
    bills: 'Bill calls',
    help: 'Help calls',
    tips: 'Tips today',
    requests: 'Guest requests',
    queue: 'Delivery queue',
    noRequests: 'No active guest requests right now.',
    noQueue: 'Kitchen is quiet right now. New ready orders will appear here.',
    zone: 'Floor',
    items: 'Items',
    readyAt: 'Ready at',
    serve: 'Mark served',
    notify: 'Done',
    notifying: 'Sending...',
    serving: 'Serving...',
    localOnly: 'Local alert only',
    guestPing: 'Guest will be notified',
    takeaway: 'Takeaway Pack',
    dining: 'Dining Service',
  },
  hi: {
    title: 'वेटर डेस्क',
    subtitle: 'Pickup, bill request और guest help को एक जगह से संभालिए।',
    active: 'अभी सक्रिय',
    ready: 'डिलीवरी के लिए तैयार',
    bills: 'बिल कॉल',
    help: 'मदद कॉल',
    tips: 'आज की टिप',
    requests: 'गेस्ट रिक्वेस्ट',
    queue: 'डिलीवरी कतार',
    noRequests: 'अभी कोई सक्रिय guest request नहीं है।',
    noQueue: 'किचन अभी शांत है। नए ready orders यहाँ दिखेंगे।',
    zone: 'फ्लोर',
    items: 'आइटम',
    readyAt: 'तैयार समय',
    serve: 'Served mark करें',
    notify: 'Done',
    notifying: 'भेजा जा रहा है...',
    serving: 'अपडेट हो रहा है...',
    localOnly: 'सिर्फ local alert',
    guestPing: 'Guest को notification जाएगा',
    takeaway: 'Takeaway Pack',
    dining: 'Dining Service',
  },
  hinglish: {
    title: 'Waiter Desk',
    subtitle: 'Pickup, bill requests aur guest help ko ek jagah se handle karo.',
    active: 'Abhi active',
    ready: 'Deliver karne ke liye ready',
    bills: 'Bill calls',
    help: 'Help calls',
    tips: 'Aaj ki tips',
    requests: 'Guest requests',
    queue: 'Delivery queue',
    noRequests: 'Abhi koi active guest request nahi hai.',
    noQueue: 'Kitchen abhi quiet hai. Naye ready orders yahan dikhte rahenge.',
    zone: 'Floor',
    items: 'Items',
    readyAt: 'Ready time',
    serve: 'Served mark karo',
    notify: 'Done',
    notifying: 'Send ho raha hai...',
    serving: 'Update ho raha hai...',
    localOnly: 'Sirf local alert',
    guestPing: 'Guest ko notification jayega',
    takeaway: 'Takeaway Pack',
    dining: 'Dining Service',
  },
} as const;

const CALL_LABELS = {
  WAITER: { en: 'Waiter requested', hi: 'वेटर बुलाया गया', hinglish: 'Waiter bulaya gaya', tone: '#b45309' },
  BILL: { en: 'Bill requested', hi: 'बिल माँगा गया', hinglish: 'Bill manga gaya', tone: '#047857' },
  SPOON: { en: 'Spoon / Tissue', hi: 'चम्मच / टिश्यू', hinglish: 'Spoon / Tissue manga', tone: '#4338ca' },
  ASSISTANCE: { en: 'Needs assistance', hi: 'मदद चाहिए', hinglish: 'Madad chahiye', tone: '#c2410c' },
  WATER: { en: 'Water requested', hi: 'पानी माँगा गया', hinglish: 'Pani manga gaya', tone: '#0f766e' },
  EXTRA: { en: 'Extra item requested', hi: 'अतिरिक्त आइटम माँगा गया', hinglish: 'Extra item manga gaya', tone: '#4338ca' },
  HELP: { en: 'Needs assistance', hi: 'मदद चाहिए', hinglish: 'Madad chahiye', tone: '#c2410c' },
} as const;

function getLanguage(value?: string): LanguageKey {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'hi') return 'hi';
  if (normalized === 'hinglish') return 'hinglish';
  return 'en';
}

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

function normalizeReadyOrder(order: any): ReadyPickupCard | null {
  const orderId = String(order?.orderId || order?.id || '');
  if (!orderId) return null;
  const orderType = String(order?.orderType || '').toUpperCase();
  const tableName = order?.tableName ?? order?.table?.name ?? null;
  const floorName = order?.zoneName ?? order?.table?.zone?.name ?? null;
  const destinationLabel =
    order?.destinationLabel ||
    (orderType === 'TAKEAWAY'
      ? COPY.en.takeaway
      : [tableName ? `Table ${tableName}` : null, floorName ? `Floor ${floorName}` : null].filter(Boolean).join(' • ') || COPY.en.dining);

  return {
    orderId,
    orderNumber: String(order?.orderNumber || `#${orderId.slice(-6).toUpperCase()}`),
    destinationLabel,
    tableName,
    floorName,
    orderType,
    itemCount: Number(order?.itemCount) || (Array.isArray(order?.items) ? order.items.reduce((sum: number, item: any) => sum + Number(item?.quantity || 0), 0) : 0),
    readyAt: order?.readyAt || order?.updatedAt || undefined,
    version: typeof order?.version === 'number' ? order.version : undefined,
    items: Array.isArray(order?.items)
      ? order.items.map((item: any) => ({
          id: String(item?.id || `${orderId}_${item?.menuItemId || item?.name || Math.random()}`),
          name: String(item?.name || item?.menuItem?.name || 'Item'),
          quantity: Number(item?.quantity || 0),
        }))
      : [],
  };
}

function safeTime(value?: string) {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return format(parsed, 'h:mm a');
}

function normalizeWaiterCall(call: any): WaiterCallAlert | null {
  const sessionId = typeof call?.sessionId === 'string' ? call.sessionId : undefined;
  const tableId = typeof call?.tableId === 'string' ? call.tableId : undefined;
  const type = String(call?.type || 'WAITER').toUpperCase();
  const timestamp = typeof call?.timestamp === 'string' ? call.timestamp : new Date().toISOString();
  const dedupeKey = [sessionId || 'no-session', tableId || 'no-table', type].join(':');

  return {
    id: `${dedupeKey}:${timestamp}`,
    dedupeKey,
    sessionId,
    tableId,
    tableName: typeof call?.tableName === 'string' ? call.tableName : undefined,
    type,
    timestamp,
  };
}

function mergeWaiterCalls(previous: WaiterCallAlert[] | undefined, incoming: WaiterCallAlert) {
  const current = Array.isArray(previous) ? previous : [];
  const deduped = current.filter((entry) => entry.dedupeKey !== incoming.dedupeKey);
  return [incoming, ...deduped].slice(0, 10);
}

function mergeReadyAlerts(
  previous: ReadyPickupCard[] | undefined,
  incoming: ReadyPickupCard,
  dismissedReadyOrderIds: string[],
) {
  if (dismissedReadyOrderIds.includes(incoming.orderId)) {
    return Array.isArray(previous) ? previous : [];
  }

  const current = Array.isArray(previous) ? previous : [];
  const existing = current.find((entry) => entry.orderId === incoming.orderId);
  if (
    existing &&
    typeof existing.version === 'number' &&
    typeof incoming.version === 'number' &&
    incoming.version <= existing.version
  ) {
    return current;
  }

  return [{ ...incoming }, ...current.filter((entry) => entry.orderId !== incoming.orderId)].slice(0, 8);
}

export function WaiterPage() {
  const queryClient = useQueryClient();
  const [dismissedReadyOrderIds, setDismissedReadyOrderIds] = useState<string[]>([]);
  const [resolvingCallId, setResolvingCallId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'live' | 'reconnecting'>('connecting');

  const { data: businessSettings } = useQuery<{ slug?: string }>({
    queryKey: ['settings-business'],
    queryFn: async () => (await api.get('/settings/business')).data,
    staleTime: 1000 * 60,
    retry: false,
  });

  const { data: authMe } = useQuery<any>({
    queryKey: ['auth-me'],
    queryFn: async () => (await api.get('/auth/me?includeTips=true')).data,
    staleTime: 1000 * 60,
    retry: false,
  });

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await api.get('/auth/profile')).data,
  });

  const tipsToday = profile?.tipSummary?.totalAmount || 0;

  const language = getLanguage(authMe?.user?.preferredLanguage);
  const t = COPY[language];

  const { data: readyOrders = [], isLoading } = useQuery<ReadyPickupCard[]>({
    queryKey: ['waiter-ready-orders'],
    queryFn: async () => {
      const response = await api.get('/orders');
      return (response.data as any[])
        .filter((order) => String(order?.status || '').toUpperCase() === 'READY')
        .map((order) => normalizeReadyOrder(order))
        .filter((order): order is ReadyPickupCard => Boolean(order));
    },
    staleTime: 1000 * 20,
    refetchOnWindowFocus: false,
  });

  const { data: waiterCalls = [] } = useQuery<WaiterCallAlert[]>({
    queryKey: ['waiter-active-calls'],
    queryFn: async () => [],
    initialData: [],
    staleTime: Infinity,
  });

  const { data: readyAlerts = [] } = useQuery<ReadyPickupCard[]>({
    queryKey: ['waiter-ready-alerts'],
    queryFn: async () => [],
    initialData: [],
    staleTime: Infinity,
  });

  const resolveTenantSlug = useCallback(() => {
    const fromQuery = String(businessSettings?.slug || '').trim();
    if (fromQuery) return fromQuery;
    return readRestaurantSlugFromStorage();
  }, [businessSettings?.slug]);

  const serveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/orders/${id}/status`, { status: 'SERVED' }),
    onSuccess: (_response, orderId) => {
      queryClient.invalidateQueries({ queryKey: ['waiter-ready-orders'] });
      queryClient.setQueryData(['waiter-ready-alerts'], (prev: ReadyPickupCard[] | undefined) =>
        (Array.isArray(prev) ? prev : []).filter((alert) => alert.orderId !== orderId),
      );
      setDismissedReadyOrderIds((prev) => prev.filter((id) => id !== orderId));
    },
  });

  const dismissWaiterCall = useCallback((id: string) => {
    queryClient.setQueryData(['waiter-active-calls'], (prev: WaiterCallAlert[] | undefined) =>
      (Array.isArray(prev) ? prev : []).filter((call) => call.id !== id),
    );
  }, [queryClient]);

  const acknowledgeWaiterCall = useCallback(async (call: WaiterCallAlert) => {
    if (!call.sessionId) {
      dismissWaiterCall(call.id);
      return;
    }
    const slug = resolveTenantSlug();
    if (!slug) {
      window.alert('Tenant slug is missing. Open business settings once and try again.');
      return;
    }
    setResolvingCallId(call.id);
    try {
      await api.post(`/public/${slug}/waiter-call/acknowledge`, { sessionId: call.sessionId, tableId: call.tableId });
      dismissWaiterCall(call.id);
    } catch (error: any) {
      window.alert(error?.response?.data?.error || 'Could not notify the guest yet.');
    } finally {
      setResolvingCallId(null);
    }
  }, [dismissWaiterCall, resolveTenantSlug]);

  const pushReadyAlert = useCallback((input: any) => {
    const nextAlert = normalizeReadyOrder(input);
    if (!nextAlert || dismissedReadyOrderIds.includes(nextAlert.orderId)) return;
    queryClient.setQueryData(['waiter-ready-alerts'], (prev: ReadyPickupCard[] | undefined) =>
      mergeReadyAlerts(prev, nextAlert, dismissedReadyOrderIds),
    );
  }, [dismissedReadyOrderIds, queryClient]);

  const pushWaiterCall = useCallback((input: any) => {
    const normalizedCall = normalizeWaiterCall(input);
    if (!normalizedCall) return;
    queryClient.setQueryData(['waiter-active-calls'], (prev: WaiterCallAlert[] | undefined) =>
      mergeWaiterCalls(prev, normalizedCall),
    );
  }, [queryClient]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const socket = io(getSocketUrl(), {
      auth: { token, client: 'waiter' },
      transports: ['websocket'],
      rememberUpgrade: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });

    socket.on('connect', () => {
      setConnectionState('live');
      socket.timeout(2000).emit('sync:request', { surface: 'waiter_desk' }, () => {
        queryClient.invalidateQueries({ queryKey: ['waiter-ready-orders'] });
      });
    });

    const handleOrderUpdate = (updated: any) => {
      const normalizedStatus = String(updated?.status || '').toUpperCase();
      if (normalizedStatus === 'READY') {
        pushReadyAlert(updated);
        return;
      }
      if (['SERVED', 'RECEIVED', 'CANCELLED'].includes(normalizedStatus)) {
        const updatedId = String(updated?.id || updated?.orderId || '');
        queryClient.setQueryData(['waiter-ready-alerts'], (prev: ReadyPickupCard[] | undefined) =>
          (Array.isArray(prev) ? prev : []).filter((alert) => alert.orderId !== updatedId),
        );
        setDismissedReadyOrderIds((prev) => prev.filter((id) => id !== updatedId));
      }
    };

    socket.on('order:update', handleOrderUpdate);
    socket.on('waiter:pickup_ready', pushReadyAlert);
    socket.on('waiter:call', pushWaiterCall);
    socket.on('waiter:acknowledged', (payload: any) => {
      const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId : undefined;
      const tableId = typeof payload?.tableId === 'string' ? payload.tableId : undefined;
      queryClient.setQueryData(['waiter-active-calls'], (prev: WaiterCallAlert[] | undefined) =>
        (Array.isArray(prev) ? prev : []).filter((call) => {
          if (sessionId && call.sessionId === sessionId) return false;
          if (!sessionId && tableId && call.tableId === tableId) return false;
          return true;
        }),
      );
    });
    socket.on('connect_error', () => setConnectionState('reconnecting'));
    socket.on('disconnect', () => setConnectionState('reconnecting'));
    return () => {
      socket.disconnect();
    };
  }, [pushReadyAlert, pushWaiterCall, queryClient]);

  useEffect(() => {
    queryClient.setQueryData(['waiter-ready-alerts'], (previous: ReadyPickupCard[] | undefined) => {
      const merged = new Map<string, ReadyPickupCard>();
      const previousAlerts = Array.isArray(previous) ? previous : [];

      readyOrders.forEach((order) => {
        if (!dismissedReadyOrderIds.includes(order.orderId)) {
          merged.set(order.orderId, order);
        }
      });

      previousAlerts.forEach((order) => {
        if (dismissedReadyOrderIds.includes(order.orderId)) {
          return;
        }

        const serverOrder = merged.get(order.orderId);
        if (!serverOrder) {
          return;
        }

        if (
          typeof order.version === 'number' &&
          typeof serverOrder.version === 'number' &&
          order.version > serverOrder.version
        ) {
          merged.set(order.orderId, order);
        }
      });

      return Array.from(merged.values()).slice(0, 8);
    });
  }, [dismissedReadyOrderIds, queryClient, readyOrders]);

  const readyQueue = useMemo(
    () => readyAlerts.filter((entry) => !dismissedReadyOrderIds.includes(entry.orderId)),
    [dismissedReadyOrderIds, readyAlerts],
  );

  const billCount = waiterCalls.filter((call) => String(call.type || '').toUpperCase() === 'BILL').length;
  const helpCount = waiterCalls.length - billCount;
  
  const stats = [
    { label: t.active, value: readyQueue.length + waiterCalls.length, icon: Bell, tone: '#2563eb' },
    { label: t.ready, value: readyQueue.length, icon: UtensilsCrossed, tone: '#059669' },
    { label: t.bills, value: billCount, icon: Receipt, tone: '#d97706' },
    { label: t.help, value: helpCount, icon: HelpCircle, tone: '#7c3aed' },
    { label: t.tips, value: `₹${tipsToday.toFixed(0)}`, icon: IndianRupee, tone: '#0f766e' },
  ];

  if (isLoading) {
    return <div className="p-6 text-sm font-semibold" style={{ color: 'var(--text-3)' }}><Loader2 size={16} className="mr-2 inline animate-spin" /> Syncing waiter desk...</div>;
  }

  return (
    <div className="space-y-5 pb-24 lg:space-y-6 lg:pb-8">
      <section className="rounded-[30px] border p-5 lg:p-6" style={{ borderColor: 'var(--border)', background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.86))' }}>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300">{t.title}</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">{t.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">{t.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-200">
              {authMe?.user?.name || 'Waiter'}
            </div>
            <div
              className="inline-flex rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
              style={{
                borderColor:
                  connectionState === 'live'
                    ? 'rgba(16, 185, 129, 0.28)'
                    : 'rgba(245, 158, 11, 0.28)',
                background:
                  connectionState === 'live'
                    ? 'rgba(16, 185, 129, 0.14)'
                    : 'rgba(245, 158, 11, 0.12)',
                color: connectionState === 'live' ? '#6ee7b7' : '#fcd34d',
              }}
            >
              {connectionState === 'live' ? 'Realtime Live' : 'Reconnecting'}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <article key={stat.label} className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>{stat.label}</p>
                <p className="mt-2 truncate text-2xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>{stat.value}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: `${stat.tone}18`, color: stat.tone }}>
                <stat.icon size={18} />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.96fr_1.04fr]">
        <div className="rounded-3xl border p-4 lg:p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="mb-4 flex items-center gap-2">
            <Bell size={16} className="text-amber-500" />
            <h2 className="text-lg font-black tracking-tight" style={{ color: 'var(--text-1)' }}>{t.requests}</h2>
          </div>
          {waiterCalls.length === 0 ? (
            <div className="rounded-2xl border px-4 py-10 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-3)' }}>
              {t.noRequests}
            </div>
          ) : (
            <div className="space-y-3">
              {waiterCalls.map((call) => {
                const meta = CALL_LABELS[(String(call.type || 'WAITER').toUpperCase() as WaiterCallType) || 'WAITER'] || CALL_LABELS.WAITER;
                const isResolving = resolvingCallId === call.id;
                return (
                  <div key={call.id} className="rounded-2xl border p-4" style={{ borderColor: `${meta.tone}40`, background: `${meta.tone}12` }}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-base font-black" style={{ color: 'var(--text-1)' }}>{call.tableName || 'Guest request'}</p>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.14em]" style={{ color: meta.tone }}>{meta[language]}</p>
                        <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-3)' }}>
                          {call.sessionId ? t.guestPing : t.localOnly}
                        </p>
                      </div>
                      <button
                        onClick={() => acknowledgeWaiterCall(call)}
                        disabled={isResolving}
                        className="inline-flex min-w-[116px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black disabled:opacity-60"
                        style={{ background: 'var(--surface-raised)', color: meta.tone, border: `1px solid ${meta.tone}30` }}
                      >
                        {isResolving ? <Loader2 size={14} className="animate-spin" /> : null}
                        {isResolving ? t.notifying : t.notify}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-3xl border p-4 lg:p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="mb-4 flex items-center gap-2">
            <UtensilsCrossed size={16} className="text-emerald-500" />
            <h2 className="text-lg font-black tracking-tight" style={{ color: 'var(--text-1)' }}>{t.queue}</h2>
          </div>
          {readyQueue.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'var(--surface-3)' }}>
                <Clock3 size={28} style={{ color: 'var(--text-3)' }} />
              </div>
              <p className="font-bold" style={{ color: 'var(--text-3)' }}>{t.noQueue}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {readyQueue.map((order) => {
                const isServing = serveMutation.isPending && serveMutation.variables === order.orderId;
                return (
                  <article key={order.orderId} className="rounded-[28px] border p-4 shadow-sm lg:p-5" style={{ borderColor: 'rgba(16,185,129,0.18)', background: 'linear-gradient(180deg, rgba(16,185,129,0.08), rgba(15,23,42,0.02))' }}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600">{order.orderNumber}</p>
                        <h3 className="mt-1 text-xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>{order.destinationLabel}</h3>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-3)' }}>
                          {order.floorName ? <span className="rounded-full bg-slate-100 px-3 py-1">{t.zone}: {order.floorName}</span> : null}
                          <span className="rounded-full bg-slate-100 px-3 py-1">{t.items}: {order.itemCount}</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1">{t.readyAt}: {safeTime(order.readyAt)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => serveMutation.mutate(order.orderId)}
                        disabled={isServing}
                        className="inline-flex min-w-[136px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                        style={{ background: '#059669' }}
                      >
                        {isServing ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        {isServing ? t.serving : t.serve}
                      </button>
                    </div>
                    {order.items.length > 0 && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {order.items.map((item) => (
                          <div key={item.id} className="rounded-2xl border px-3 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                            <p className="truncate text-sm font-bold" style={{ color: 'var(--text-1)' }}>{item.name}</p>
                            <p className="mt-1 text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--text-3)' }}>Qty {item.quantity}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
