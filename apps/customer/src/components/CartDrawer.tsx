import { useCartStore } from '../store/cartStore';
import { X, Trash2, ShoppingBag, Minus, Plus, Sparkles, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { formatINR } from '../lib/currency';
import { api, publicApi } from '../lib/api';
import { useState, useEffect } from 'react';
import { get, set } from 'idb-keyval';
import { useNavigate } from 'react-router-dom';
import { getActiveSessionForTenant, setActiveSessionForTenant } from '../lib/tenantStorage';

export function CartDrawer({ isOpen, onClose, tenantSlug, tableId }: any) {
  const navigate = useNavigate();
  const { items, addItem, removeItem, updateQuantity, clearCart, getCartTotal, tableSeat, customerName, customerPhone } =
    useCartStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const safeItems = Array.isArray(items) ? items : [];

  const { data: recommendations = [] } = useQuery({
    queryKey: ['upsell', tenantSlug, safeItems.map((i: any) => i?.menuItem?.id).filter(Boolean).sort().join(',')],
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

  const { data: tenantMenuMeta } = useQuery({
    queryKey: ['tenant-tax-meta', tenantSlug],
    queryFn: async () => {
      const res = await publicApi.get(`/${tenantSlug}/menu`);
      return res.data;
    },
    enabled: !!tenantSlug && isOpen,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (errorText) {
      const timer = setTimeout(() => setErrorText(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorText]);

  if (!isOpen) return null;

  const subtotal = getCartTotal();
  const taxRate = tenantMenuMeta?.taxRate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const totalAmount = subtotal + taxAmount;

  const handleCheckout = async () => {
    if (!tenantSlug) return;
    setIsSubmitting(true);
    setErrorText(null);
    
    const sessionToken = getActiveSessionForTenant(tenantSlug);

    const itemsPayload = safeItems.map((i) => {
      let finalNotes = i?.notes || '';
      if (tableSeat) {
        finalNotes = finalNotes ? `${finalNotes} (Seat ${tableSeat})` : `Seat ${tableSeat}`;
      }
      const safeModifiers = Array.isArray(i?.modifiers) ? i.modifiers : [];
      return {
        menuItemId: i?.menuItem?.id,
        quantity: Number(i?.quantity) || 1,
        notes: finalNotes || undefined,
        selectedModifiers: safeModifiers.map((m: any) => ({
          id: m?.id,
        })),
      };
    });

    if (itemsPayload.some((item) => !item.menuItemId)) {
      setErrorText('Some cart items are invalid. Please remove and add them again.');
      setIsSubmitting(false);
      return;
    }

    const payload = {
      sessionId: sessionToken,
      tableId,
      customerName,
      customerPhone,
      items: itemsPayload,
    };

    try {
      if (!navigator.onLine) throw new Error('Network Error');
      const orderRes = await publicApi.post(`/${tenantSlug}/orders`, payload);
      
      const createdSessionId =
        orderRes?.data?.sessionId ||
        orderRes?.data?.diningSessionId ||
        orderRes?.data?.order?.diningSessionId ||
        orderRes?.data?.order?.sessionId;
      if (createdSessionId) {
        setActiveSessionForTenant(tenantSlug, createdSessionId);
      }
      
      clearCart();
      setShowSuccess(true);
      
      setTimeout(() => {
        onClose();
        setShowSuccess(false);
        const finalSessionId = getActiveSessionForTenant(tenantSlug) || createdSessionId || sessionToken;
        if (finalSessionId) {
          navigate(`/order/${tenantSlug}/session/${finalSessionId}`);
        } else {
          navigate(`/order/${tenantSlug}/status`);
        }
      }, 2000);
    } catch (error: any) {
      console.error('[CHECKOUT_ERROR]', error);
      if (!navigator.onLine || error.message === 'Network Error') {
        const queue: any[] = (await get('offline_orders')) || [];
        queue.push({ tenantSlug, payload });
        await set('offline_orders', queue);
        clearCart();
        setErrorText('Offline: Order queued. It will send automatically when you reconnect.');
        setTimeout(() => onClose(), 3000);
      } else {
        const serverMessage = error.response?.data?.error || error.response?.data?.message || 'Something went wrong during checkout. Please try again.';
        setErrorText(serverMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={!isSubmitting ? onClose : undefined} 
      />

      {/* Drawer Content */}
      <div 
        className="relative w-full max-w-md h-full flex flex-col shadow-2xl slide-up lg:translate-y-0 lg:animate-none lg:slide-in-from-right"
        style={{ background: 'var(--bg)' }}
      >
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl transition-colors" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
              <ShoppingBag size={20} />
            </div>
            <div>
              <h2 className="font-black text-xl" style={{ color: 'var(--text-1)' }}>Your Cart</h2>
              <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>{safeItems.length} items selected</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90"
            style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Success / Error Messages */}
        {showSuccess && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-8 text-center animate-in fade-in" style={{ background: 'var(--surface)' }}>
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 size={40} className="text-white" />
            </div>
            <h3 className="text-2xl font-black mb-2" style={{ color: 'var(--text-1)' }}>Order Placed!</h3>
            <p className="font-medium text-lg" style={{ color: 'var(--text-3)' }}>Sending it to the kitchen now...</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
          {errorText && (
            <div className="p-4 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--error)' }}>
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <p className="text-sm font-bold">{errorText}</p>
            </div>
          )}

          {safeItems.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--surface-3)' }}>
                <ShoppingBag size={28} style={{ color: 'var(--text-3)' }} />
              </div>
              <p className="font-bold text-lg mb-1" style={{ color: 'var(--text-2)' }}>Your cart is empty</p>
              <p className="text-sm font-medium" style={{ color: 'var(--text-3)' }}>Add some delicious items to get started!</p>
              <button 
                onClick={onClose} 
                className="mt-6 px-6 py-2.5 rounded-xl font-black text-sm transition-all active:scale-95"
                style={{ background: 'var(--brand)', color: 'white' }}
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {safeItems.map((item) => (
                <div key={item.id} className="flex gap-4 group">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border" style={{ borderColor: 'var(--border)' }}>
                    <img 
                      src={item.menuItem?.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'} 
                      alt={item.menuItem?.name} 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-black text-base truncate pr-2" style={{ color: 'var(--text-1)' }}>{item.menuItem?.name}</p>
                      <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-500 transition-colors p-1">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {item.modifiers?.length > 0 && (
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>
                        {item.modifiers.map(m => m.name).join(' · ')}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                       <span className="font-black text-brand">{formatINR(item.totalPrice)}</span>
                       <div className="flex items-center gap-3 rounded-lg p-1" style={{ background: 'var(--surface-3)' }}>
                         <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-black/5" style={{ color: 'var(--text-2)' }}>
                           <Minus size={14} />
                         </button>
                         <span className="text-sm font-black w-4 text-center" style={{ color: 'var(--text-1)' }}>{item.quantity}</span>
                         <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-black/5" style={{ color: 'var(--text-2)' }}>
                           <Plus size={14} />
                         </button>
                       </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AI Upsell Area */}
          {recommendations.length > 0 && (
            <div className="mt-10 rounded-3xl p-5 border shadow-sm" style={{ background: 'rgba(99, 102, 241, 0.05)', borderColor: 'rgba(99, 102, 241, 0.1)' }}>
              <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: '#4f46e5' }}>
                <Sparkles size={14} /> You might also like
              </h3>
              <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
                {recommendations.map((item: any) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      addItem({
                        id: `item-${Date.now()}-${Math.random()}`,
                        menuItem: item,
                        quantity: 1,
                        modifiers: [],
                        totalPrice: item.price,
                      });
                    }}
                    className="min-w-[140px] rounded-2xl p-3 text-left transition-all active:scale-95 border"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <div className="h-16 rounded-xl overflow-hidden mb-2">
                      <img src={item.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'} className="w-full h-full object-cover" alt={item.name} />
                    </div>
                    <p className="text-[11px] font-black line-clamp-1 mb-1" style={{ color: 'var(--text-1)' }}>{item.name}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-emerald-500">{formatINR(item.price)}</span>
                      <Plus size={12} style={{ color: 'var(--text-3)' }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer / Summary Area */}
        {safeItems.length > 0 && (
          <div className="p-6 border-t space-y-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)', boxShadow: '0 -10px 30px rgba(0,0,0,0.03)' }}>
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium" style={{ color: 'var(--text-3)' }}>
                <span>Subtotal</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium" style={{ color: 'var(--text-3)' }}>
                <span>Tax & Service ({taxRate}%)</span>
                <span>{formatINR(taxAmount)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <span className="text-lg font-black" style={{ color: 'var(--text-1)' }}>Total</span>
                <span className="text-lg font-black" style={{ color: 'var(--brand)' }}>{formatINR(totalAmount)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={isSubmitting}
              className="w-full py-4.5 rounded-2xl font-black text-lg transition-all active:scale-[0.98] shadow-xl shadow-brand/20 flex items-center justify-center gap-3 disabled:opacity-70"
              style={{ background: 'var(--brand)', color: 'white' }}
            >
              {isSubmitting ? (
                <>Processing...</>
              ) : (
                <>Place Order <ChevronRight size={20} /></>
              )}
            </button>
            <p className="text-[10px] text-center font-bold uppercase tracking-widest opacity-60" style={{ color: 'var(--text-3)' }}>
              Secure restaurant checkout
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
