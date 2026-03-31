import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { OrderCard } from '../components/OrderCard';
import { getSocketUrl } from '../lib/network';
import { UtensilsCrossed, Clock, CheckCircle2, ChefHat, Flame } from 'lucide-react';

const COLS = [
  {
    id: 'incoming',
    label: 'Incoming',
    icon: <Flame size={14} />,
    filter: (s: string) => s === 'NEW' || s === 'ACCEPTED',
    headerClass: 'bg-blue-950/60 border-blue-800/50',
    labelClass: 'text-blue-400',
    badgeClass: 'bg-blue-500/20 text-blue-300',
    emptyText: 'No new tickets',
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
  },
];

export function KitchenBoard() {
  const queryClient = useQueryClient();
  const [clock, setClock] = useState(new Date());

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['live-orders'],
    queryFn: async () => {
      const res = await api.get('/orders');
      return res.data;
    }
  });

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const socket = io(getSocketUrl(), { auth: { token } });

    socket.on('order:new', (order) => {
      queryClient.setQueryData(['live-orders'], (old: any) => [...(old || []), order]);
      new Audio('/notification.mp3').play().catch(() => {});
    });
    socket.on('order:update', (updated) => {
      queryClient.setQueryData(['live-orders'], (old: any) => {
        if (!old) return old;
        if (['RECEIVED', 'CANCELLED'].includes(updated.status)) return old.filter((o: any) => o.id !== updated.id);
        return old.map((o: any) => o.id === updated.id ? updated : o);
      });
    });

    return () => { socket.disconnect(); };
  }, [queryClient]);

  if (isLoading) return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950">
      <div className="h-20 bg-slate-900 border-b border-slate-800 animate-pulse" />
      <div className="flex-1 p-6 flex gap-6">
        {[1, 2, 3, 4].map(col => (
          <div key={col} className="w-72 flex flex-col gap-3">
            <div className="h-12 bg-slate-800 rounded-xl animate-pulse" />
            {[1, 2].map(c => <div key={c} className="h-40 bg-slate-800 rounded-2xl animate-pulse" />)}
          </div>
        ))}
      </div>
    </div>
  );

  const total = (orders as any[]).length;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <UtensilsCrossed size={16} className="text-white" />
            </div>
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
        </div>
        <div className="flex gap-4 text-xs font-medium text-slate-500">
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
      </header>

      {/* Kanban columns */}
      <main className="flex-1 overflow-x-auto p-6 bg-slate-950 custom-scrollbar">
        <div className="flex gap-4 h-full min-w-max">
          {COLS.map((col) => {
            const colOrders = (orders as any[]).filter(o => col.filter(o.status));
            const hasItems = colOrders.length > 0;
            return (
              <div key={col.id} className="w-[300px] flex-shrink-0 flex flex-col bg-slate-900 rounded-2xl border border-slate-800 h-full overflow-hidden">
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
                      <p className="text-slate-600 text-sm font-medium">{col.emptyText}</p>
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
