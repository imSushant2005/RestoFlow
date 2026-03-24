import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';

export function OrderCard({ order }: { order: any }) {
  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/orders/${order.id}/status`, { status }),
  });

  const nextStatusMap: Record<string, string> = {
    'PENDING': 'PREPARING',
    'ACCEPTED': 'PREPARING',
    'PREPARING': 'READY',
    'READY': 'COMPLETED'
  };

  const statusColors: Record<string, string> = {
    'PENDING': 'bg-blue-600',
    'ACCEPTED': 'bg-blue-600',
    'PREPARING': 'bg-yellow-600',
    'READY': 'bg-green-600'
  };

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-lg overflow-hidden flex flex-col animate-in fade-in duration-300">
      <div className={`px-4 py-2 flex justify-between items-center ${statusColors[order.status] || 'bg-gray-700'}`}>
        <span className="font-bold text-white uppercase text-sm">
          {order.table ? `Table ${order.table.name}` : 'Takeaway'}
        </span>
        <span className="text-white/90 text-xs font-semibold">#{order.id.slice(-6).toUpperCase()}</span>
      </div>
      
      <div className="p-4 flex-1">
        {(order.customerName || order.customerPhone) && (
          <div className="flex flex-col gap-0.5 mb-3 bg-gray-900/50 p-2.5 rounded-lg border border-gray-700">
            {order.customerName && <span className="text-sm font-bold text-gray-200 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>{order.customerName}</span>}
            {order.customerPhone && <span className="text-xs font-semibold text-gray-400 pl-3.5">{order.customerPhone}</span>}
          </div>
        )}
        <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-4 font-medium">
          <Clock size={12} /> Ordered {format(new Date(order.createdAt), 'MMM d, h:mm a')}
        </div>
        
        <ul className="flex flex-col gap-3">
          {order.items.map((item: any) => (
            <li key={item.id} className="text-gray-200">
              <div className="flex justify-between items-start gap-2">
                <div className="flex gap-2 font-semibold">
                  <span className="text-blue-400">{item.quantity}x</span>
                  <span>{item.menuItem.name}</span>
                </div>
              </div>
              {item.modifiers?.length > 0 && (
                <div className="pl-6 text-sm text-gray-400 mt-1">
                  {item.modifiers.map((m: any) => `+ ${m.modifier.name}`).join(', ')}
                </div>
              )}
              {item.notes && (
                <div className="pl-6 text-sm text-yellow-500 mt-1 italic font-medium">
                  Note: {item.notes}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="p-3 bg-gray-900 border-t border-gray-700">
        <button
          onClick={() => statusMutation.mutate(nextStatusMap[order.status] || 'COMPLETED')}
          className="w-full py-2.5 rounded text-white font-bold bg-white/10 hover:bg-white/20 transition-colors"
        >
          {order.status === 'PENDING' || order.status === 'ACCEPTED' ? 'Start Preparing' : ''}
          {order.status === 'PREPARING' ? 'Mark as Ready' : ''}
          {order.status === 'READY' ? 'Complete Order' : ''}
        </button>
      </div>
    </div>
  );
}
