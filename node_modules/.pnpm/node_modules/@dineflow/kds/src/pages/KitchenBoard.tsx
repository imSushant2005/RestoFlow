import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { OrderCard } from '../components/OrderCard';
import { getSocketUrl } from '../lib/network';

export function KitchenBoard() {
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['live-orders'],
    queryFn: async () => {
      const res = await api.get('/orders');
      return res.data;
    }
  });

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const socket = io(getSocketUrl(), {
      auth: { token }
    });

    socket.on('order:new', (order) => {
      queryClient.setQueryData(['live-orders'], (old: any) => [...(old || []), order]);
      new Audio('/notification.mp3').play().catch(() => {});
    });

    socket.on('order:update', (updatedOrder) => {
      queryClient.setQueryData(['live-orders'], (old: any) => {
        if (!old) return old;
        if (['COMPLETED', 'CANCELLED'].includes(updatedOrder.status)) {
          return old.filter((o: any) => o.id !== updatedOrder.id);
        }
        return old.map((o: any) => o.id === updatedOrder.id ? updatedOrder : o);
      });
    });

    return () => { socket.disconnect() };
  }, [queryClient]);

  if (isLoading) return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-900">
      <div className="h-20 bg-gray-800 border-b border-gray-700 w-full animate-pulse"></div>
      <div className="flex-1 p-6 flex gap-6">
        {[1, 2, 3].map(col => (
          <div key={col} className="w-96 flex flex-col gap-4 bg-gray-800/40 rounded-xl border border-gray-700 p-4 h-full">
            <div className="w-1/2 h-6 bg-gray-700 rounded animate-pulse mb-4"></div>
            {[1, 2, 3].map(card => (
              <div key={card} className="w-full h-40 bg-gray-800 border border-gray-700 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  const pending = orders.filter((o: any) => o.status === 'PENDING' || o.status === 'ACCEPTED');
  const preparing = orders.filter((o: any) => o.status === 'PREPARING');
  const ready = orders.filter((o: any) => o.status === 'READY');

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between shadow-md">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
          <span className="bg-red-500 w-3 h-3 rounded-full animate-pulse"></span>
          KITCHEN DISPLAY
        </h1>
        <div className="flex gap-6 text-sm font-medium text-gray-400">
          <div className="flex items-center gap-2"><span className="bg-blue-500 w-2 h-2 rounded-full"></span> Incoming ({pending.length})</div>
          <div className="flex items-center gap-2"><span className="bg-yellow-500 w-2 h-2 rounded-full"></span> Preparing ({preparing.length})</div>
          <div className="flex items-center gap-2"><span className="bg-green-500 w-2 h-2 rounded-full"></span> Ready ({ready.length})</div>
        </div>
      </header>

      <main className="flex-1 overflow-x-auto p-6 bg-gray-900 custom-scrollbar">
        <div className="flex gap-6 h-full min-w-max">
          <div className="w-96 flex flex-col bg-gray-800/40 rounded-xl border border-gray-700 h-full overflow-hidden shadow-sm">
            <h2 className="p-4 bg-gray-800 font-bold text-gray-300 border-b border-gray-700 sticky top-0 uppercase tracking-wider text-xs z-10">Incoming Tickets</h2>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {pending.map((order: any) => <OrderCard key={order.id} order={order} />)}
              {pending.length === 0 && <div className="text-center p-8 text-gray-500 italic">No incoming tickets</div>}
            </div>
          </div>

          <div className="w-96 flex flex-col bg-gray-800/40 rounded-xl border border-gray-700 h-full overflow-hidden shadow-sm">
            <h2 className="p-4 bg-gray-800 font-bold text-gray-300 border-b border-gray-700 sticky top-0 uppercase tracking-wider text-xs z-10">Preparing</h2>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {preparing.map((order: any) => <OrderCard key={order.id} order={order} />)}
              {preparing.length === 0 && <div className="text-center p-8 text-gray-500 italic">No orders preparing</div>}
            </div>
          </div>

          <div className="w-96 flex flex-col bg-gray-800/40 rounded-xl border border-gray-700 h-full overflow-hidden shadow-sm">
            <h2 className="p-4 bg-gray-800 font-bold text-gray-300 border-b border-gray-700 sticky top-0 uppercase tracking-wider text-xs z-10">Ready for pickup</h2>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {ready.map((order: any) => <OrderCard key={order.id} order={order} />)}
              {ready.length === 0 && <div className="text-center p-8 text-gray-500 italic">No orders ready</div>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
