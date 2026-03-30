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
      if (updatedOrder.status === 'COMPLETED' || updatedOrder.status === 'CANCELLED') {
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
        if (updatedOrder.status === 'COMPLETED' || updatedOrder.status === 'CANCELLED') {
          return old.filter((o: any) => o.id !== updatedOrder.id);
        }
        return old.map((o: any) => o.id === updatedOrder.id ? updatedOrder : o);
      });
      if (updatedOrder.status === 'COMPLETED' || updatedOrder.status === 'CANCELLED') {
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

  const pending = liveOrders.filter((o: any) => o.status === 'PENDING' || o.status === 'ACCEPTED');
  const preparing = liveOrders.filter((o: any) => o.status === 'PREPARING');
  const ready = liveOrders.filter((o: any) => o.status === 'READY');
  const history = historyResponse || [];

  const OrderCard = ({ order }: { order: any }) => {
    const [expanded, setExpanded] = useState(false);
    return (
      <div 
        className={`border rounded-2xl shadow-sm p-5 flex flex-col gap-4 animate-in fade-in duration-300 cursor-pointer hover:shadow-md transition-all ${order.status === 'CANCELLED' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex justify-between items-start">
          <div>
            <span className="font-extrabold text-gray-900 text-lg block tracking-tight">{order.table ? `Table ${order.table.name}` : 'Takeaway'}</span>
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">#{order.id.slice(-8)} • {format(new Date(order.createdAt), 'MMM d, h:mm a')}</span>
            {(order.customerName || order.customerPhone) && (
              <div className="flex flex-col gap-0.5 mt-2 bg-blue-50/50 px-3 py-1.5 rounded-lg border border-blue-100/50">
                {order.customerName && <span className="text-sm font-bold text-gray-800">{order.customerName}</span>}
                {order.customerPhone && <span className="text-xs font-semibold text-gray-500">{order.customerPhone}</span>}
              </div>
            )}
            {order.status === 'CANCELLED' && order.cancelReason && (
              <div className="mt-2 text-xs font-bold text-red-700 bg-red-100 px-2 py-1.5 rounded border border-red-200">
                Reason: {order.cancelReason}
              </div>
            )}
          </div>
          <span className="font-black text-blue-600 text-lg">{formatINR(order.totalAmount || 0)}</span>
        </div>

        {expanded && (
          <div className="border-t border-gray-100 pt-3 mt-1" onClick={(e) => e.stopPropagation()}>
            <ul className="flex flex-col gap-2 mb-4">
              {order.items?.map((item: any) => (
                <li key={item.id} className="text-sm text-gray-700">
                  <span className="font-bold text-blue-600 mr-2">{item.quantity}x</span>
                  <span className="font-medium text-gray-900">{item.menuItem?.name || 'Item'}</span>
                  {item.specialNote && <div className="text-xs text-orange-500 italic ml-6 font-medium">Note: {item.specialNote}</div>}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
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
                className="flex-1 bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-bold outline-none cursor-pointer"
              >
                <option value="PENDING">Pending</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="PREPARING">Preparing</option>
                <option value="READY">Ready</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
        )}
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
              if (confirm('Close ALL live orders? This will mark them as Completed.')) {
                liveOrders.forEach((o: any) => statusMutation.mutate({ id: o.id, status: 'COMPLETED' }));
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
          <div className="flex flex-col bg-gray-50/50 rounded-3xl border border-gray-100 overflow-hidden">
            <div className="bg-white p-4 border-b border-gray-100 flex justify-between items-center shadow-sm z-10">
              <h2 className="font-bold text-gray-700 flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50"></div> Incoming</h2>
              <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">{pending.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {pending.map((order: any) => <OrderCard key={order.id} order={order} />)}
              {pending.length === 0 && <div className="m-auto text-gray-400 font-medium text-sm">No incoming orders</div>}
            </div>
          </div>

          <div className="flex flex-col bg-gray-50/50 rounded-3xl border border-gray-100 overflow-hidden">
            <div className="bg-white p-4 border-b border-gray-100 flex justify-between items-center shadow-sm z-10">
              <h2 className="font-bold text-gray-700 flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-sm shadow-yellow-500/50"></div> Preparing</h2>
              <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">{preparing.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {preparing.map((order: any) => <OrderCard key={order.id} order={order} />)}
              {preparing.length === 0 && <div className="m-auto text-gray-400 font-medium text-sm">No orders preparing</div>}
            </div>
          </div>

          <div className="flex flex-col bg-gray-50/50 rounded-3xl border border-gray-100 overflow-hidden">
            <div className="bg-white p-4 border-b border-gray-100 flex justify-between items-center shadow-sm z-10">
              <h2 className="font-bold text-gray-700 flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-500/50"></div> Ready</h2>
              <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">{ready.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {ready.map((order: any) => <OrderCard key={order.id} order={order} />)}
              {ready.length === 0 && <div className="m-auto text-gray-400 font-medium text-sm">No orders ready</div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.map((order: any) => <OrderCard key={order.id} order={order} />)}
            {history.length === 0 && <div className="col-span-full text-center text-gray-400 font-medium mt-20">No completed or canceled orders yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
