import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../lib/network';
import { 
  Bell, CheckCircle2, Utensils, Clock, 
  MapPin, HelpCircle, Receipt, LogOut 
} from 'lucide-react';
import { format } from 'date-fns';

export function WaiterPage() {
  const queryClient = useQueryClient();
  const [waiterCalls, setWaiterCalls] = useState<any[]>([]);

  // Fetch only READY orders (those needing to be served)
  const { data: readyOrders = [], isLoading } = useQuery<any[]>({
    queryKey: ['waiter-ready-orders'],
    queryFn: async () => {
      const res = await api.get('/orders');
      return (res.data as any[]).filter(o => o.status === 'READY');
    },
    refetchInterval: 10000,
  });

  const serveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/orders/${id}/status`, { status: 'SERVED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiter-ready-orders'] });
    }
  });

  const resolveCallMutation = (id: number) => {
    setWaiterCalls(prev => prev.filter(c => c.id !== id));
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const socket = io(getSocketUrl(), {
      auth: { token, client: 'waiter' },
      transports: ['websocket'],
      rememberUpgrade: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });

    const handleOrderUpdate = (updated: any) => {
      if (updated.status === 'READY' || updated.status === 'SERVED') {
        queryClient.invalidateQueries({ queryKey: ['waiter-ready-orders'] });
      }
    };

    const handleWaiterCall = (call: any) => {
      setWaiterCalls(prev => [{ ...call, id: Date.now() }, ...prev].slice(0, 10));
      // Haptic/Sound could go here
    };

    const handleConnectError = () => {
      queryClient.invalidateQueries({ queryKey: ['waiter-ready-orders'] });
    };

    socket.on('order:update', handleOrderUpdate);
    socket.on('waiter:call', handleWaiterCall);
    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('order:update', handleOrderUpdate);
      socket.off('waiter:call', handleWaiterCall);
      socket.off('connect_error', handleConnectError);
      socket.disconnect();
    };
  }, [queryClient]);

  if (isLoading) return <div className="p-6 animate-pulse font-medium" style={{ color: 'var(--text-3)' }}>Syncing with kitchen...</div>;

  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans" style={{ background: 'var(--bg)' }}>
      {/* Mobile Header */}
      <header className="px-5 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600">
            <Utensils size={18} className="text-white" />
          </div>
          <h1 className="font-black text-xl tracking-tight" style={{ color: 'var(--text-1)' }}>Waiter Ops</h1>
        </div>
        <button 
          onClick={() => { localStorage.removeItem('accessToken'); localStorage.removeItem('userRole'); window.location.reload(); }}
          className="p-2 transition-colors hover:text-red-500"
          style={{ color: 'var(--text-3)' }}
        >
          <LogOut size={20} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar pb-24">
        {/* Waiter Calls Section */}
        {waiterCalls.length > 0 && (
          <section className="p-4 space-y-3">
            <h2 className="px-1 text-xs font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-3)' }}>
              <Bell size={12} className="text-amber-500" /> Active Alerts
            </h2>
            {waiterCalls.map((call) => (
              <div key={call.id} className="rounded-2xl p-4 flex items-center justify-between animate-in slide-in-from-top-2" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center animate-pulse">
                    {call.type === 'BILL' ? <Receipt size={20} /> : <HelpCircle size={20} />}
                  </div>
                  <div>
                    <p className="font-black text-base" style={{ color: 'var(--text-1)' }}>{call.tableName}</p>
                    <p className="text-xs font-bold uppercase tracking-tight" style={{ color: '#b45309' }}>
                      {call.type === 'BILL' ? 'Requested Bill' : 'Needs Assistance'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => resolveCallMutation(call.id)}
                  className="font-black px-4 py-2 rounded-xl text-sm shadow-sm active:scale-95 transition-all"
                  style={{ background: 'var(--surface-raised)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#b45309' }}
                >
                  Done
                </button>
              </div>
            ))}
          </section>
        )}

        {/* Ready to Serve List */}
        <section className="p-4 space-y-4">
          <h2 className="px-1 text-xs font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-3)' }}>
            <CheckCircle2 size={12} className="text-emerald-500" /> Ready to Serve
          </h2>
          
          {readyOrders.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-3)' }}>
                <Clock size={28} style={{ color: 'var(--text-3)' }} />
              </div>
              <p className="font-bold" style={{ color: 'var(--text-3)' }}>Kitchen is quiet... no orders ready.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {readyOrders.map((order) => (
                <div key={order.id} className="p-5 rounded-2xl animate-in fade-in slide-in-from-bottom-3 duration-300" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-lg" style={{ color: 'var(--text-1)' }}>
                          {order.table?.name ? `Table ${order.table.name}` : 'Takeaway'}
                        </span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full border uppercase" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
                          {order.orderNumber}
                        </span>
                      </div>
                      <p className="text-xs font-bold mt-1 uppercase tracking-tight flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                        <MapPin size={10} /> {order.table?.zone?.name || 'Main Area'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase leading-none" style={{ color: 'var(--text-3)' }}>Ready</p>
                      <p className="text-sm font-black text-emerald-500">{format(new Date(order.readyAt || order.updatedAt), 'h:mm a')}</p>
                    </div>
                  </div>

                  <div className="rounded-xl p-3 mb-4 space-y-2" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                    {order.items.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center">
                        <div className="flex gap-2 items-center">
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md min-w-[24px] text-center" style={{ background: 'var(--border)', color: 'var(--text-2)' }}>
                            {item.quantity}
                          </span>
                          <span className="text-sm font-bold" style={{ color: 'var(--text-2)' }}>{item.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={() => serveMutation.mutate(order.id)}
                    disabled={serveMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-lg"
                  >
                    {serveMutation.isPending ? 'Updating...' : 'Confirm Delivery ✓'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Floating Bottom Info */}
      <div className="fixed bottom-0 left-0 right-0 p-4 backdrop-blur-md flex items-center justify-around z-20" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
        <div className="flex flex-col items-center gap-1">
          <Utensils size={20} className="text-blue-600" />
          <span className="text-[10px] font-black text-blue-600 uppercase">Orders</span>
        </div>
        <div className="flex flex-col items-center gap-1 opacity-40 grayscale pointer-events-none">
          <MapPin size={20} style={{ color: 'var(--text-3)' }} />
          <span className="text-[10px] font-black uppercase" style={{ color: 'var(--text-3)' }}>Tables</span>
        </div>
      </div>
    </div>
  );
}
