import { useCartStore } from '../store/cartStore';
import { X, Trash2, ShoppingBag, Minus, Plus, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { formatINR } from '../lib/currency';
import { api, publicApi } from '../lib/api';
import { useState } from 'react';
import { get, set } from 'idb-keyval';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../lib/network';

export function CartDrawer({ isOpen, onClose, tenantSlug, tableId }: any) {
  const navigate = useNavigate();
  const { items, addItem, removeItem, updateQuantity, clearCart, getCartTotal, tableSeat, customerName, customerPhone } =
    useCartStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const safeItems = Array.isArray(items) ? items : [];

  const { data: recommendations = [] } = useQuery({
    queryKey: ['upsell', tenantSlug, safeItems.map((i: any) => i?.menuItem?.id).filter(Boolean).join(',')],
    queryFn: async () => {
      if (safeItems.length === 0) return [];
      const res = await api.post('/ai/upsell', {
        tenantSlug,
        cartItemIds: safeItems.map((i: any) => i?.menuItem?.id).filter(Boolean),
      });
      return res.data.recommendations || [];
    },
    enabled: safeItems.length > 0 && isOpen,
    staleTime: 1000 * 60 * 5,
  });

  if (!isOpen) return null;

  const handleCheckout = async () => {
    setIsSubmitting(true);
    const sessionToken = localStorage.getItem('restoflow_session') || localStorage.getItem('dineflow_session');
    const payload = {
      sessionId: sessionToken,
      tableId,
      customerName,
      customerPhone,
      items: safeItems.map((i) => {
        let finalNotes = i?.notes || '';
        if (tableSeat) {
          finalNotes = finalNotes ? `${finalNotes} (Seat ${tableSeat})` : `Seat ${tableSeat}`;
        }
        const safeModifiers = Array.isArray(i?.modifiers) ? i.modifiers : [];
        return {
          menuItem: {
            id: i?.menuItem?.id,
            price: Number(i?.menuItem?.price) || 0,
            name: i?.menuItem?.name || 'Untitled Item',
            description: i?.menuItem?.description || '',
            imageUrl: i?.menuItem?.images?.[0] || i?.menuItem?.imageUrl || null,
          },
          quantity: Number(i?.quantity) || 1,
          notes: finalNotes || undefined,
          modifiers: safeModifiers.map((m: any) => ({
            id: m?.id,
            name: m?.name || 'Option',
            priceAdjustment: Number(m?.priceAdjustment ?? m?.price ?? 0) || 0,
          })),
        };
      }),
    };

    try {
      if (!navigator.onLine) throw new Error('Network Error');
      await publicApi.post(`/${tenantSlug}/orders`, payload);
      clearCart();
      onClose();
      navigate(`/order/${tenantSlug}/status`);
    } catch (error: any) {
      if (!navigator.onLine || error.message === 'Network Error') {
        const queue: any[] = (await get('offline_orders')) || [];
        queue.push({ tenantSlug, payload });
        await set('offline_orders', queue);
        clearCart();
        alert('You are offline. Your order is queued and will be sent when you reconnect!');
        onClose();
      } else {
        const serverMessage = error.response?.data?.error || error.response?.data?.message || error.message;
        const isNetworkFailure = !error.response;

        alert(
          isNetworkFailure
            ? `Failed to reach the ordering server at ${getApiBaseUrl()}. Make sure the API is running and port 4000 is reachable on this network.`
            : `Failed to place order: ${serverMessage}`,
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalItems = safeItems.reduce((sum, i) => sum + (Number(i?.quantity) || 0), 0);

  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[28px] shadow-2xl slide-up flex flex-col"
        style={{ maxHeight: '90dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="flex justify-between items-center px-5 py-3 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-black text-gray-900">Your Order</h2>
            <p className="text-xs text-gray-400 font-medium">
              {totalItems} item{totalItems !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-600 active:bg-gray-200">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4">
          {safeItems.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-gray-300 gap-3">
              <ShoppingBag size={48} />
              <p className="font-semibold text-gray-400">Your cart is empty</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-50">
              {safeItems.map((item: any, index: number) => {
                const qty = Number(item?.quantity) || 1;
                const lineTotal = (Number(item?.totalPrice) || 0) * qty;
                const imageUrl = item?.menuItem?.imageUrl || item?.menuItem?.images?.[0];
                const modifiers = Array.isArray(item?.modifiers) ? item.modifiers : [];
                return (
                  <div key={item?.id || `${item?.menuItem?.id || 'item'}-${index}`} className="py-4 flex gap-3 items-start">
                    <div className="w-16 h-16 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
                      {imageUrl ? (
                        <img src={imageUrl} alt={item?.menuItem?.name || 'Item'} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm leading-snug">{item?.menuItem?.name || 'Untitled Item'}</p>
                      {modifiers.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">{modifiers.map((m: any) => m?.name).filter(Boolean).join(', ')}</p>
                      )}
                      {item?.notes && <p className="text-xs text-brand italic mt-0.5">"{item.notes}"</p>}
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-black text-gray-900 text-sm">{formatINR(lineTotal)}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => (qty === 1 ? removeItem(item.id) : updateQuantity(item.id, qty - 1))}
                            className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-lg active:bg-gray-200 transition-colors"
                          >
                            {qty === 1 ? <Trash2 size={13} className="text-red-500" /> : <Minus size={13} />}
                          </button>
                          <span className="w-5 text-center font-black text-sm">{qty}</span>
                          <button
                            onClick={() => updateQuantity(item.id, qty + 1)}
                            className="w-7 h-7 flex items-center justify-center bg-brand hover:bg-brand-dark text-white rounded-lg transition-colors"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {safeItems.length > 0 && recommendations.length > 0 && (
            <div className="mt-8 mb-4">
              <h3 className="text-sm font-black text-purple-600 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                <Sparkles size={14} /> Perfect Pairings
              </h3>
              <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2">
                {recommendations.map((rec: any) => (
                  <div key={rec.id} className="min-w-[140px] bg-purple-50 rounded-2xl p-3 border border-purple-100 flex flex-col justify-between whitespace-normal">
                    <p className="font-bold text-gray-900 text-sm leading-tight mb-2 line-clamp-2">{rec.name}</p>
                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-purple-100/50">
                      <span className="font-black text-purple-700 text-sm">{formatINR(rec.price)}</span>
                      <button
                        onClick={() =>
                          addItem({
                            id: Math.random().toString(36).substring(7),
                            menuItem: rec,
                            quantity: 1,
                            modifiers: [],
                            totalPrice: rec.price,
                          })
                        }
                        className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 active:scale-95 transition-transform"
                      >
                        <Plus size={14} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {safeItems.length > 0 && (
          <div className="px-5 pb-6 pt-4 border-t border-gray-100 bg-white" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-500 font-semibold">Total</span>
              <span className="text-2xl font-black text-gray-900">{formatINR(getCartTotal())}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={isSubmitting}
              className="w-full bg-brand hover:bg-brand-dark active:scale-[0.98] text-white py-4 rounded-2xl font-black text-base shadow-lg disabled:opacity-60 transition-all"
            >
              {isSubmitting ? 'Placing Order...' : `Place Order · ${totalItems} item${totalItems !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
