import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Clock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const STATUS_CONFIG: Record<string, { stripe: string; label: string; bright: string }> = {
  NEW: { stripe: 'bg-gradient-to-r from-blue-500 to-indigo-500', label: 'New', bright: 'text-blue-400' },
  ACCEPTED: { stripe: 'bg-gradient-to-r from-blue-500 to-indigo-500', label: 'Accepted', bright: 'text-blue-400' },
  PREPARING: { stripe: 'bg-gradient-to-r from-amber-400 to-orange-500', label: 'Preparing', bright: 'text-amber-400' },
  READY: { stripe: 'bg-gradient-to-r from-emerald-400 to-teal-500', label: 'Ready', bright: 'text-emerald-400' },
};

const NEXT_STATUS: Record<string, string> = {
  NEW: 'PREPARING',
  ACCEPTED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'SERVED',
};

const ACTION_LABEL: Record<string, string> = {
  NEW: 'Start Preparing',
  ACCEPTED: 'Start Preparing',
  PREPARING: 'Mark as Ready',
  READY: 'Mark Served',
};

export function OrderCard({ order }: { order: any }) {
  const [now, setNow] = useState(Date.now());
  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/orders/${order.id}/status`, { status }),
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.NEW;
  const elapsedMs = now - new Date(order.createdAt).getTime();
  const elapsedMinRaw = elapsedMs / 60000;
  const elapsedMin = Math.floor(elapsedMinRaw);
  const elapsedSec = Math.floor((elapsedMs % 60000) / 1000);

  const urgency = useMemo(() => {
    if (elapsedMinRaw < 2) return 'COOL';
    if (elapsedMinRaw < 5) return 'WATCH';
    return 'URGENT';
  }, [elapsedMinRaw]);

  const urgencyTextClass =
    urgency === 'COOL' ? 'text-blue-400' : urgency === 'WATCH' ? 'text-amber-400' : 'text-red-400';
  const urgencyCardClass =
    urgency === 'COOL'
      ? 'border-blue-800/60'
      : urgency === 'WATCH'
      ? 'border-amber-800/60'
      : 'border-red-800/70 shadow-red-900/30';

  return (
    <div className={`card-enter flex flex-col bg-slate-800 rounded-2xl overflow-hidden border shadow-xl transition-all duration-200 hover:border-slate-600 ${urgencyCardClass}`}>
      <div className={`h-1.5 w-full ${config.stripe} flex-shrink-0`} />

      <div className="px-4 pt-3 pb-2 flex justify-between items-center">
        <div>
          <span className="font-black text-white text-base tracking-tight">
            {order.table ? `Table ${order.table.name}` : 'Takeaway'}
          </span>
          <span className="ml-2 text-slate-500 text-xs font-mono">#{order.id.slice(-6).toUpperCase()}</span>
        </div>
        <span className={`text-xs font-bold uppercase tracking-wider ${config.bright}`}>{config.label}</span>
      </div>

      <div className={`flex items-center gap-1.5 px-4 pb-3 text-xs font-semibold ${urgencyTextClass}`}>
        <Clock size={11} />
        <span>{elapsedMin}m {elapsedSec}s</span>
        <span
          className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
            urgency === 'COOL'
              ? 'bg-blue-500/20 text-blue-300'
              : urgency === 'WATCH'
              ? 'bg-amber-500/20 text-amber-300'
              : 'bg-red-500/20 text-red-300'
          }`}
        >
          {urgency === 'COOL' ? '<2m' : urgency === 'WATCH' ? '2-5m' : '>5m'}
        </span>
      </div>

      {(order.customerName || order.customerPhone) && (
        <div className="mx-4 mb-3 bg-slate-900/60 border border-slate-700 rounded-xl px-3 py-2">
          {order.customerName && <p className="text-sm font-bold text-slate-200">{order.customerName}</p>}
          {order.customerPhone && <p className="text-xs text-slate-500 font-medium mt-0.5">{order.customerPhone}</p>}
        </div>
      )}

      <ul className="flex flex-col gap-2.5 px-4 pb-4">
        {order.items.map((item: any) => (
          <li key={item.id} className="flex gap-3 items-start">
            <span className="bg-slate-700 text-white text-xs font-black px-2 py-0.5 rounded-lg min-w-[28px] text-center flex-shrink-0 mt-0.5">
              {item.quantity}x
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-slate-100 font-semibold text-sm leading-tight">{item.menuItem?.name || item.name}</p>
              {item.modifiers?.length > 0 && (
                <p className="text-xs text-slate-500 mt-0.5">{item.modifiers.map((m: any) => `+ ${m.modifier?.name}`).join(', ')}</p>
              )}
              {item.notes && (
                <p className="text-xs text-amber-400 mt-0.5 font-medium">Note: {item.notes}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="px-3 pb-3">
        <button
          onClick={() => statusMutation.mutate(NEXT_STATUS[order.status] || 'SERVED')}
          disabled={statusMutation.isPending}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.97] disabled:opacity-50 ${
            order.status === 'READY'
              ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30'
              : order.status === 'PREPARING'
              ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/30'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
          }`}
        >
          {statusMutation.isPending ? '...' : ACTION_LABEL[order.status] || 'Advance'}
        </button>
      </div>
    </div>
  );
}
