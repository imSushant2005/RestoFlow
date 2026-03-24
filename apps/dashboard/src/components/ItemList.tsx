import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { ItemModal } from './ItemModal';
import { formatINR } from '../lib/currency';
import { getSocketUrl } from '../lib/network';

export function ItemList({ categoryId }: { categoryId: string }) {
  const queryClient = useQueryClient();
  const [isModalOpen, setModalOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['items', categoryId],
    queryFn: async () => {
      const res = await api.get('/menus/items');
      return res.data.filter((i: any) => i.categoryId === categoryId);
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isAvailable }: any) => api.patch(`/menus/items/${id}/availability`, { isAvailable }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }) // Optional refetch, but socket handles realtime update if successful
  });

  // Socket.io for realtime sync 
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const socket = io(getSocketUrl(), {
      auth: { token }
    });

    socket.on('menu:availability_changed', (payload) => {
      queryClient.setQueryData(['items', categoryId], (old: any) => {
        if (!old) return old;
        return old.map((item: any) => 
          item.id === payload.itemId ? { ...item, isAvailable: payload.isAvailable } : item
        );
      });
    });

    return () => { socket.disconnect() };
  }, [categoryId, queryClient]);

  if (isLoading) return <div>Loading items...</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Menu Items</h2>
        <button 
          onClick={() => setModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 flex items-center gap-2 shadow-sm"
        >
          <Plus size={16} /> Add Item
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((item: any) => (
          <div key={item.id} className={`p-5 rounded-xl border bg-white shadow-sm transition-all flex flex-col gap-3 ${!item.isAvailable ? 'opacity-50 grayscale' : 'hover:shadow-md'}`}>
            <div className="flex justify-between items-start">
              <h3 className="font-semibold text-gray-800 leading-tight pr-2">{item.name}</h3>
              <button 
                onClick={() => toggleMutation.mutate({ id: item.id, isAvailable: !item.isAvailable })}
                className={`transition-colors flex-shrink-0 ${item.isAvailable ? 'text-blue-600' : 'text-gray-400'}`}
              >
                {item.isAvailable ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              </button>
            </div>
            <p className="text-sm text-gray-500 line-clamp-2 min-h-[40px]">{item.description || 'No description provided.'}</p>
            <div className="mt-auto pt-3 flex items-center justify-between border-t border-gray-100">
              <span className="font-bold text-gray-900">{formatINR(item.price)}</span>
              <div className="flex gap-1">
                {item.isVeg && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] uppercase font-bold rounded">VEG</span>}
                {item.isVegan && <span className="px-1.5 py-0.5 bg-green-200 text-green-800 text-[10px] uppercase font-bold rounded">VEGAN</span>}
                {item.isGlutenFree && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] uppercase font-bold rounded">GF</span>}
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full py-16 text-center text-gray-400 bg-white border-2 border-dashed border-gray-200 rounded-xl">
            <p className="text-lg font-medium text-gray-500">No menu items</p>
            <p className="text-sm mt-1">Add items to this category to see them here.</p>
          </div>
        )}
      </div>

      <ItemModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} categoryId={categoryId} />
    </div>
  );
}
