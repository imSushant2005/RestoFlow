import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { format } from 'date-fns';
import { formatINR } from '../lib/currency';
import { getSocketUrl } from '../lib/network';
import { Hand, Receipt, HelpCircle, Zap, XCircle } from 'lucide-react';

export function Orders() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'PIPELINE' | 'SESSIONS' | 'HISTORY'>('PIPELINE');
  const [busyMode, setBusyMode] = useState(false);
  const [waiterCalls, setWaiterCalls] = useState<any[]>([]);

  const { data: liveOrders = [], isLoading } = useQuery<any[]>({
    queryKey: ['live-orders'],
    queryFn: async () => {
      const res = await api.get('/orders');
      return res.data;
    },
    staleTime: 1000 * 10,
  });

  const { data: historyResponse = [] } = useQuery<any[]>({
    queryKey: ['order-history'],
    queryFn: async () => {
      const res = await api.get('/orders/history');
      return res.data;
    },
    staleTime: 1000 * 30,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, cancelReason }: any) => {
      const res = await api.patch(`/orders/${id}/status`, { status, cancelReason });
      return res.data;
    },
    onSuccess: (updatedOrder: any) => {
      if (updatedOrder.status === 'RECEIVED' || updatedOrder.status === 'CANCELLED') {
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

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const socket = io(getSocketUrl(), { auth: { token } });

    socket.on('order:new', (order) => queryClient.setQueryData(['live-orders'], (old: any) => [...(old || []), order]));
    socket.on('order:update', (updatedOrder) => {
      queryClient.setQueryData(['live-orders'], (old: any) => {
        if (!old) return old;
        if (updatedOrder.status === 'RECEIVED' || updatedOrder.status === 'CANCELLED') {
          return old.filter((o: any) => o.id !== updatedOrder.id);
        }
        return old.map((o: any) => o.id === updatedOrder.id ? updatedOrder : o);
      });
      if (updatedOrder.status === 'RECEIVED' || updatedOrder.status === 'CANCELLED') {
        queryClient.invalidateQueries({ queryKey: ['order-history'] });
        queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
      }
    });

    // USP 10: Waiter call alerts
    socket.on('waiter:call', (call: any) => {
      setWaiterCalls(prev => [{ ...call, id: Date.now() }, ...prev].slice(0, 10));
      // Play sound
      try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczLjt0otf/mGEcFkl/sOLbfTcRJWuY1OOURBcRUIC06M1xKRAna6DM5aRaGhhAhb3e0okyDDBwpN77jl0ZJGqk2P+hXxcTRYe84tN5LQ0nbaXb+5JYGSNqpND/pFkUFEmIvuPXeS0NLW6m3v6SVxokZaXR/6RYGRUAAA==').play(); } catch {}  
    });

    return () => { socket.disconnect() };
  }, [queryClient]);

  if (isLoading) return (
    <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-48 animate-pulse">
          <div className="w-1/3 h-6 bg-gray-200 rounded mb-4"></div>
          <div className="w-1/4 h-4 bg-gray-100 rounded mb-6"></div>
          <div className="space-y-3">
            <div className="w-full h-8 bg-gray-50 rounded"></div>
            <div className="w-5/6 h-8 bg-gray-50 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );

  const groupedLive = Object.values(
    liveOrders.reduce((acc: any, order: any) => {
      const gId = order.diningSessionId || `single_${order.id}`;
      if (!acc[gId]) {
        acc[gId] = {
          id: gId,
          isSession: !!order.diningSessionId,
          sessionId: order.diningSessionId,
          session: order.diningSession,
          table: order.table,
          customerName: order.diningSession?.customer?.name || order.customerName,
          customerPhone: order.diningSession?.customer?.phone || order.customerPhone,
          orders: [],
          createdAt: order.diningSession?.openedAt || order.createdAt,
          totalAmount: 0
        };
      }
      acc[gId].orders.push(order);
      acc[gId].totalAmount += order.totalAmount;
      return acc;
    }, {})
  ).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const TicketCard = ({ ticket }: { ticket: any }) => {
    const isCancelled = ticket.orders.every((o: any) => o.status === 'CANCELLED');
    const elapsedMin = Math.floor((Date.now() - new Date(ticket.createdAt).getTime()) / 60000);
    const guestDots = ticket.session?.partySize > 0
      ? Array.from({ length: Math.min(ticket.session.partySize, 6) })
      : [];

    const handleCloseSession = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm('Generate final bill and close this session?')) return;
      try {
        const slug = JSON.parse(localStorage.getItem('restaurant') || '{}').slug;
        if (!slug) throw new Error('Tenant slug not found');
        await api.post(`/public/${slug}/sessions/${ticket.sessionId}/finish`);
        queryClient.invalidateQueries({ queryKey: ['live-orders'] });
      } catch {
        alert('Failed to close session');
      }
    };

    return (
      <div className={`pipeline-card card-hover flex flex-col animate-in fade-in duration-300 ${isCancelled ? 'opacity-60' : ''}`}>
        {/* Top stripe */}
        <div className={`pipeline-card-stripe ${isCancelled ? 'bg-red-400' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`} />

        <div className="p-4 flex flex-col gap-3">
          {/* Table + Time */}
          <div className="flex justify-between items-start">
            <div>
              <span className="font-black text-gray-900 text-base block leading-tight">
                {ticket.table ? `Table ${ticket.table.name}` : 'Takeaway'}
              </span>
              <span className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">
                {ticket.isSession ? 'Open Tab' : `#${ticket.orders[0]?.id.slice(-6)}`} · {format(new Date(ticket.createdAt), 'h:mm a')}
                {elapsedMin > 0 && ` · ${elapsedMin}m`}
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
          <div className="space-y-2 border-t border-gray-100 pt-3">
            {ticket.orders.map((order: any, idx: number) => (
              <div key={order.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="flex justify-between mb-1.5">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Batch {idx + 1}</span>
                  <span className={`chip ${
                    order.status === 'NEW' ? 'chip-blue' :
                    order.status === 'PREPARING' ? 'chip-yellow' :
                    order.status === 'READY' ? 'chip-green' :
                    order.status === 'SERVED' ? 'chip-gray' : 'chip-gray'
                  }`}>{order.status}</span>
                </div>
                <ul className="space-y-1 mb-2">
                  {order.items?.map((item: any) => (
                    <li key={item.id} className="text-sm text-gray-700 font-medium flex gap-2">
                      <span className="font-black text-blue-600">{item.quantity}x</span>
                      {item.menuItem?.name || 'Item'}
                    </li>
                  ))}
                </ul>
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
                  className="w-full text-xs rounded-lg font-bold border border-gray-200 bg-white px-3 py-1.5 outline-none cursor-pointer text-gray-700"
                >
                  <option value="NEW">New</option>
                  <option value="ACCEPTED">Accepted</option>
                  <option value="PREPARING">Preparing</option>
                  <option value="READY">Ready</option>
                  <option value="SERVED">Served</option>
                  <option value="RECEIVED">Received</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            ))}
          </div>

          {/* Close session CTA */}
          {ticket.isSession && (
            <button
              onClick={handleCloseSession}
              className="w-full text-sm font-bold bg-gradient-to-r from-orange-500 to-red-500 text-white py-2.5 rounded-xl hover:brightness-110 active:scale-[0.98] transition-all shadow-md shadow-orange-500/20 mt-1"
            >
              Close Session & Generate Bill →
            </button>
          )}
        </div>
      </div>
    );
  };

  const PipelineCard = ({ order }: { order: any }) => {
    const elapsed = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
    const isUrgent = elapsed >= 15 && (order.status === 'NEW' || order.status === 'PREPARING');
    const stripeClass =
      order.status === 'NEW' || order.status === 'ACCEPTED' ? 'stripe-new' :
      order.status === 'PREPARING' ? 'stripe-preparing' :
      order.status === 'READY' ? 'stripe-ready' : 'stripe-served';

    return (
      <div className={`pipeline-card card-hover animate-in fade-in duration-300 ${isUrgent ? 'ring-1 ring-red-300' : ''}`}>
        <div className={`pipeline-card-stripe ${stripeClass}`} />
        <div className="p-4">
          <div className="flex justify-between items-start mb-1">
            <div>
              <span className="font-black text-gray-900 text-sm block">
                {order.orderNumber || `#${order.id.slice(-6).toUpperCase()}`}
              </span>
              <span className="text-gray-400 text-[11px] font-semibold">
                {order.table?.name ? `Table ${order.table.name}` : 'Takeaway'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-gray-400 text-[11px] font-bold">{format(new Date(order.createdAt), 'h:mm a')}</span>
              {isUrgent && <div className="text-[10px] font-black text-red-500 mt-0.5">⚠ {elapsed}m</div>}
            </div>
          </div>

          <ul className="mt-3 mb-4 space-y-1.5">
            {order.items?.map((item: any) => (
              <li key={item.id} className="flex gap-2 text-sm text-gray-700 font-medium items-start">
                <span className="bg-blue-50 text-blue-700 text-xs font-black px-1.5 py-0.5 rounded-md flex-shrink-0 mt-0.5">{item.quantity}x</span>
                <span className="leading-tight">{item.menuItem?.name || item.name}</span>
              </li>
            ))}
          </ul>

          {order.status === 'NEW' && (
            <button onClick={() => statusMutation.mutate({ id: order.id, status: 'ACCEPTED' })} disabled={statusMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 shadow-md shadow-blue-600/20 text-sm">
              ✓ Accept Order
            </button>
          )}
          {order.status === 'ACCEPTED' && (
            <button onClick={() => statusMutation.mutate({ id: order.id, status: 'PREPARING' })} disabled={statusMutation.isPending}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 shadow-md shadow-amber-500/20 text-sm">
              🍳 Start Preparing
            </button>
          )}
          {order.status === 'PREPARING' && (
            <button onClick={() => statusMutation.mutate({ id: order.id, status: 'READY' })} disabled={statusMutation.isPending}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 shadow-md shadow-orange-500/20 text-sm">
              🔔 Mark Ready
            </button>
          )}
          {order.status === 'READY' && (
            <button onClick={() => statusMutation.mutate({ id: order.id, status: 'SERVED' })} disabled={statusMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 shadow-md shadow-emerald-600/20 text-sm">
              🍽️ Mark Served
            </button>
          )}
          {order.status === 'SERVED' && (
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
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-[calc(100vh-theme(spacing.16))] overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Active Operations</h1>
          {busyMode && (
            <span className="flex items-center gap-1.5 bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-black animate-pulse">
              <Zap size={12} /> BUSY MODE
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setBusyMode(!busyMode)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              busyMode ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Zap size={14} /> {busyMode ? 'Busy ON' : 'Busy Mode'}
          </button>
          <button
            onClick={() => {
              if (confirm('Close ALL live kitchen batches? This will mark them as Served.')) {
                liveOrders.forEach((o: any) => statusMutation.mutate({ id: o.id, status: 'SERVED' }));
              }
            }}
            disabled={liveOrders.length === 0}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 disabled:opacity-40 flex items-center gap-2 transition-all"
          >
            <XCircle size={14} /> Close All
          </button>
          <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-200">
            <button 
              onClick={() => setActiveTab('PIPELINE')}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'PIPELINE' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Order Pipeline
            </button>
            <button 
              onClick={() => setActiveTab('SESSIONS')}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'SESSIONS' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Table Sessions
            </button>
            <button 
              onClick={() => setActiveTab('HISTORY')}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'HISTORY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Order History
            </button>
          </div>
        </div>
      </div>

      {/* Waiter Call Alerts */}
      {waiterCalls.length > 0 && (
        <div className="mb-4 space-y-2">
          {waiterCalls.slice(0, 3).map((call) => (
            <div key={call.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 animate-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
                  {call.type === 'BILL' ? <Receipt size={16} /> : call.type === 'HELP' ? <HelpCircle size={16} /> : <Hand size={16} />}
                </div>
                <div>
                  <p className="font-bold text-amber-900 text-sm">
                    {call.type === 'BILL' ? 'Bill Requested' : call.type === 'HELP' ? 'Help Needed' : 'Waiter Called'}
                  </p>
                  <p className="text-xs text-amber-600">Table: {call.tableName} • {new Date(call.timestamp).toLocaleTimeString()}</p>
                </div>
              </div>
              <button onClick={() => setWaiterCalls(prev => prev.filter(c => c.id !== call.id))} className="text-amber-400 hover:text-amber-600 p-1">✕</button>
            </div>
          ))}
        </div>
      )}
      
      {activeTab === 'PIPELINE' ? (
        <div className="flex-1 overflow-x-auto custom-scrollbar p-6 flex gap-6 h-full bg-[#f1f5f9]/50">
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
                    <div className="flex items-center justify-center h-full py-16 text-center">
                      <p className="text-slate-400 text-sm font-medium">Nothing here</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      ) : activeTab === 'SESSIONS' ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
            {groupedLive.map((ticket: any) => <TicketCard key={ticket.id} ticket={ticket} />)}
            {groupedLive.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center mt-20 opacity-50">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4"><span className="text-2xl">🍽️</span></div>
                <p className="text-gray-500 font-bold text-lg">No active sessions.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
            {historyResponse.map((order: any) => <TicketCard key={`history_${order.id}`} ticket={{ ...order, isSession: false, orders: [order] }} />)}
            {historyResponse.length === 0 && <div className="col-span-full text-center text-gray-400 font-medium mt-20">No completed orders yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
