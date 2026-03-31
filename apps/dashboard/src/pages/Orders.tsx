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
  const [activeTab, setActiveTab] = useState<'LIVE' | 'HISTORY'>('LIVE');
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
    
    const handleCloseSession = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm('Generate final bill and close this session?')) return;
      try {
        const slug = JSON.parse(localStorage.getItem('restaurant') || '{}').slug;
        if (!slug) throw new Error("Tenant slug not found");
        await api.post(`/public/${slug}/sessions/${ticket.sessionId}/finish`);
        queryClient.invalidateQueries({ queryKey: ['live-orders'] });
      } catch (err) {
        alert('Failed to close session');
      }
    };

    return (
      <div className={`border rounded-2xl shadow-sm p-5 flex flex-col gap-4 animate-in fade-in duration-300 ${isCancelled ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
        <div className="flex justify-between items-start">
          <div>
            <span className="font-extrabold text-gray-900 text-lg block tracking-tight">
              {ticket.table ? `Table ${ticket.table.name}` : 'Takeaway'}
              {ticket.session?.partySize > 1 ? ` • ${ticket.session.partySize} Guests` : ''}
            </span>
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">
              {ticket.isSession ? 'SESSION TAB' : `#${ticket.orders[0].id.slice(-8)}`} • {format(new Date(ticket.createdAt), 'h:mm a')}
            </span>
            {(ticket.customerName || ticket.customerPhone) && (
              <div className="flex flex-col gap-0.5 mt-2 bg-blue-50/50 px-3 py-1.5 rounded-lg border border-blue-100/50">
                {ticket.customerName && <span className="text-sm font-bold text-gray-800">{ticket.customerName}</span>}
                {ticket.customerPhone && <span className="text-xs font-semibold text-gray-500">{ticket.customerPhone}</span>}
              </div>
            )}
          </div>
          <div className="text-right">
            <span className="font-black text-blue-600 text-xl block">{formatINR(ticket.totalAmount || 0)}</span>
            {ticket.isSession && (
              <button 
                onClick={handleCloseSession}
                className="mt-2 text-xs font-bold bg-orange-100 text-orange-600 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-200 transition-colors"
              >
                Close Session
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3 mt-1 space-y-4">
          {ticket.orders.map((order: any, idx: number) => (
            <div key={order.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="flex justify-between mb-2">
                <span className="text-xs font-black text-gray-500">ORDER {ticket.isSession ? `#${idx + 1}` : ''}</span>
              </div>
              <ul className="flex flex-col gap-1.5 mb-3">
                {order.items?.map((item: any) => (
                  <li key={item.id} className="text-sm text-gray-700 font-medium">
                    <span className="font-bold text-blue-600 mr-2">{item.quantity}x</span>
                    {item.menuItem?.name || 'Item'}
                    {item.specialNote && <div className="text-xs text-orange-500 italic ml-6">Note: {item.specialNote}</div>}
                  </li>
                ))}
              </ul>
              <select 
                value={order.status}
                onChange={(e) => {
                  const nextStatus = e.target.value;
                  if (nextStatus === 'CANCELLED') {
                    const reason = window.prompt("Reason for cancellation?");
                    if (reason === null) return;
                    statusMutation.mutate({ id: order.id, status: nextStatus, cancelReason: reason });
                  } else {
                    statusMutation.mutate({ id: order.id, status: nextStatus });
                  }
                }}
                className={`w-full text-xs rounded-lg font-bold border-0 ring-1 ring-inset px-3 py-2 outline-none cursor-pointer ${
                  order.status === 'NEW' ? 'bg-blue-50 text-blue-700 ring-blue-200' :
                  order.status === 'PREPARING' ? 'bg-yellow-50 text-yellow-700 ring-yellow-200' :
                  order.status === 'READY' ? 'bg-green-50 text-green-700 ring-green-200' :
                  'bg-gray-100 text-gray-700 ring-gray-200'
                }`}
              >
                <option value="NEW">Status: New</option>
                <option value="ACCEPTED">Status: Accepted</option>
                <option value="PREPARING">Status: Preparing</option>
                <option value="READY">Status: Ready</option>
                <option value="SERVED">Status: Served</option>
                <option value="RECEIVED">Status: Received</option>
                <option value="CANCELLED">Status: Cancelled</option>
              </select>
            </div>
          ))}
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
              onClick={() => setActiveTab('LIVE')}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'LIVE' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Live Kitchen
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
      
      {activeTab === 'LIVE' ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
            {groupedLive.map((ticket: any) => <TicketCard key={ticket.id} ticket={ticket} />)}
            {groupedLive.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center mt-20 opacity-50">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4"><span className="text-2xl">🍽️</span></div>
                <p className="text-gray-500 font-bold text-lg">No active sessions or orders.</p>
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
