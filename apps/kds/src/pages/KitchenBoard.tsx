import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { OrderCard } from '../components/OrderCard';
import { getCustomerAppUrl, getSocketUrl } from '../lib/network';
import { Clock, CheckCircle2, ChefHat, Flame, LogOut } from 'lucide-react';

const COLS = [
  {
    id: 'incoming',
    label: 'Incoming',
    icon: <Flame size={14} />,
    filter: (s: string) => s === 'NEW' || s === 'ACCEPTED',
    headerClass: 'bg-blue-950/60 border-blue-800/50',
    labelClass: 'text-blue-400',
    badgeClass: 'bg-blue-500/20 text-blue-300',
    emptyText: 'No tickets yet 👀',
    emptyHint: 'Start by scanning a QR or placing a test order.',
    pulse: true,
  },
  {
    id: 'preparing',
    label: 'Preparing',
    icon: <ChefHat size={14} />,
    filter: (s: string) => s === 'PREPARING',
    headerClass: 'bg-amber-950/40 border-amber-800/30',
    labelClass: 'text-amber-400',
    badgeClass: 'bg-amber-500/20 text-amber-300',
    emptyText: 'Nothing cooking',
    emptyHint: 'As soon as an order is accepted, it will appear here.',
  },
  {
    id: 'ready',
    label: 'Ready to Serve',
    icon: <CheckCircle2 size={14} />,
    filter: (s: string) => s === 'READY',
    headerClass: 'bg-emerald-950/40 border-emerald-800/30',
    labelClass: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/20 text-emerald-300',
    emptyText: 'Nothing ready yet',
    emptyHint: 'Mark preparing items as ready to serve.',
  },
  {
    id: 'served',
    label: 'Served',
    icon: <Clock size={14} />,
    filter: (s: string) => s === 'SERVED',
    headerClass: 'bg-slate-800/60 border-slate-700/50',
    labelClass: 'text-slate-400',
    badgeClass: 'bg-slate-600/30 text-slate-400',
    emptyText: 'Nothing served yet',
    emptyHint: 'Served tickets appear here before completion.',
  },
];

function mergeLiveOrders(previous: any, incoming: any) {
  const current = Array.isArray(previous) ? previous : [];
  if (!incoming?.id) {
    return current;
  }

  const normalizedStatus = String(incoming.status || '').toUpperCase();
  if (['RECEIVED', 'CANCELLED'].includes(normalizedStatus)) {
    return current.filter((order: any) => order.id !== incoming.id);
  }

  const currentIndex = current.findIndex((order: any) => order.id === incoming.id);
  if (currentIndex === -1) {
    return [incoming, ...current];
  }

  return current.map((order: any) => {
    if (order.id !== incoming.id) {
      return order;
    }

    if (
      typeof order.version === 'number' &&
      typeof incoming.version === 'number' &&
      incoming.version <= order.version
    ) {
      return order;
    }

    return { ...order, ...incoming };
  });
}

export function KitchenBoard({ onLogout }: { onLogout?: () => void }) {
  const queryClient = useQueryClient();
  const [clock, setClock] = useState(new Date());
  const [connectionState, setConnectionState] = useState<'connecting' | 'live' | 'reconnecting'>('connecting');
  const playAlert = () => {
    const audio = new Audio('/notification.mp3');
    audio.play().catch(() => {
      try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.24);
      } catch {
        // ignore fallback beep failures
      }
    });
  };
  const openTestOrder = async () => {
    try {
      let slug = '';

      try {
        const businessResponse = await api.get('/settings/business');
        const candidate = businessResponse?.data?.slug;
        if (typeof candidate === 'string') {
          slug = candidate.trim();
        }
      } catch {
        // fallback to local cache and zone payload below
      }

      if (!slug) {
        const restaurant = JSON.parse(localStorage.getItem('restaurant') || '{}');
        slug = typeof restaurant?.slug === 'string' ? restaurant.slug.trim() : '';
      }

      if (!slug) {
        const zoneResponse = await api.get('/venue/zones');
        slug = zoneResponse.data?.tenantSlug;
        if (slug) {
          localStorage.setItem('restaurant', JSON.stringify({ slug }));
        }
      }

      if (!slug) {
        alert('Tenant slug missing. Complete dashboard setup first.');
        return;
      }
      window.open(`${getCustomerAppUrl()}/order/${slug}`, '_blank', 'noopener,noreferrer');
    } catch {
      alert('Unable to open test order flow right now.');
    }
  };

  const { data: orders = [], isLoading, isError, error } = useQuery({
    queryKey: ['live-orders'],
    queryFn: async () => {
      const res = await api.get('/orders');
      return res.data;
    },
    retry: false
  });

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const socket = io(getSocketUrl(), {
      auth: { token, client: 'kds' },
      transports: ['websocket'],
      rememberUpgrade: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });

    socket.on('connect', () => {
      setConnectionState('live');
      socket.timeout(2000).emit('sync:request', { surface: 'kds' }, () => {
        queryClient.invalidateQueries({ queryKey: ['live-orders'] });
      });
    });

    socket.on('order:new', (order) => {
      const hadOrder = Array.isArray(queryClient.getQueryData(['live-orders']))
        ? (queryClient.getQueryData(['live-orders']) as any[]).some((entry: any) => entry.id === order?.id)
        : false;
      queryClient.setQueryData(['live-orders'], (old: any) => mergeLiveOrders(old, order));
      if (!hadOrder) {
        playAlert();
      }
    });
    socket.on('order:update', (updated) => {
      queryClient.setQueryData(['live-orders'], (old: any) => mergeLiveOrders(old, updated));
    });
    socket.on('orders:bulk_status', () => {
      queryClient.invalidateQueries({ queryKey: ['live-orders'] });
    });
    socket.on('session:finished', () => {
      queryClient.invalidateQueries({ queryKey: ['live-orders'] });
    });
    socket.on('connect_error', () => {
      setConnectionState('reconnecting');
    });
    socket.on('disconnect', () => {
      setConnectionState('reconnecting');
    });

    return () => { socket.disconnect(); };
  }, [queryClient]);

  if (isError) {
    const apiError =
      typeof (error as any)?.response?.data?.error === 'string'
        ? (error as any).response.data.error
        : 'Unable to load live orders.';
    const isUnauthorized = (error as any)?.response?.status === 401 || (error as any)?.response?.status === 403;

    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 p-6 font-sans text-slate-100">
        <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-black text-white tracking-tight">Kitchen board unavailable</h2>
          <p className="mt-2 text-sm text-slate-400">{apiError}</p>
          {isUnauthorized && (
            <p className="mt-2 text-xs font-semibold text-amber-300">
              Your session may be expired or missing KDS permission.
            </p>
          )}
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-bold text-white"
            >
              Retry
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-2 text-sm font-bold text-slate-200"
              >
                Back to Login
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden bg-slate-950">
      <div className="h-20 bg-slate-900 border-b border-slate-800 animate-pulse" />
      <div className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:gap-4">
          {[1, 2, 3, 4].map(col => (
            <div key={col} className="w-full md:w-72 flex flex-col gap-3">
              <div className="h-12 bg-slate-800 rounded-xl animate-pulse" />
              {[1, 2].map(c => <div key={c} className="h-40 bg-slate-800 rounded-2xl animate-pulse" />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const total = (orders as any[]).length;

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden bg-slate-950">
      {/* Header */}
      <header className="flex flex-shrink-0 flex-col gap-3 border-b border-slate-800 bg-slate-900 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-4">
        <div className="flex items-center justify-between gap-3 lg:justify-start lg:gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/bhojflow-logo.png" alt="BHOJFLOW" className="h-8 w-8 rounded-lg object-contain" />
            <div>
              <h1 className="text-white font-black text-lg tracking-tight leading-none">Kitchen Display</h1>
              <p className="text-slate-500 text-xs font-medium mt-0.5">
                {clock.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${total > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-slate-800 border-slate-700'}`}>
            <span className={`w-2 h-2 rounded-full ${total > 0 ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`} />
            <span className={`text-xs font-black ${total > 0 ? 'text-red-400' : 'text-slate-500'}`}>
              {total} {total === 1 ? 'ticket' : 'tickets'} open
            </span>
          </div>
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${
              connectionState === 'live'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                connectionState === 'live' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span className="text-[11px] font-black uppercase tracking-[0.14em]">
              {connectionState === 'live' ? 'Realtime Live' : 'Reconnecting'}
            </span>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 text-xs font-medium text-slate-500 lg:w-auto lg:justify-end">
          <div className="flex flex-wrap gap-3">
            {COLS.map(col => {
              const count = (orders as any[]).filter(o => col.filter(o.status)).length;
              return (
                <div key={col.id} className="flex items-center gap-1.5">
                  <span className={col.labelClass}>{col.icon}</span>
                  <span>{col.label}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${col.badgeClass}`}>{count}</span>
                </div>
              );
            })}
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-slate-700"
            >
              <LogOut size={12} />
              Logout
            </button>
          )}
        </div>
      </header>

      {/* Kanban columns */}
      <main className="flex-1 overflow-auto p-3 bg-slate-950 custom-scrollbar sm:p-4 lg:p-6">
        <div className="flex h-full flex-col gap-3 md:min-w-max md:flex-row md:gap-4">
          {COLS.map((col) => {
            const colOrders = (orders as any[]).filter(o => col.filter(o.status));
            const hasItems = colOrders.length > 0;
            return (
              <div key={col.id} className="flex min-h-[260px] w-full flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 md:h-full md:w-[300px] md:flex-shrink-0">
                {/* Column header */}
                <div className={`px-4 py-3 flex items-center justify-between border-b border-slate-800 ${hasItems && col.pulse ? 'incoming-active' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className={col.labelClass}>{col.icon}</span>
                    <span className={`text-xs font-black uppercase tracking-wider ${col.labelClass}`}>{col.label}</span>
                  </div>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${col.badgeClass}`}>
                    {colOrders.length}
                  </span>
                </div>
                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 custom-scrollbar">
                  {colOrders.map((order: any) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                  {colOrders.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                      <span className="text-3xl mb-3 opacity-30">{col.id === 'incoming' ? '🔔' : col.id === 'ready' ? '✅' : '🍳'}</span>
                      <p className="text-slate-500 text-sm font-semibold">{col.emptyText}</p>
                      <p className="text-slate-600/80 text-xs mt-1 max-w-[220px]">{(col as any).emptyHint}</p>
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
      </main>
    </div>
  );
}
