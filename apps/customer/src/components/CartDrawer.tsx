import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ChevronRight,
  Clock3,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  UserRound,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { get, set } from 'idb-keyval';
import { useNavigate } from 'react-router-dom';
import { api, publicApi } from '../lib/api';
import { formatINR } from '../lib/currency';
import { getDirectImageUrl } from '../lib/images';
import { getCustomerServiceCopy, normalizeCustomerServiceMode, type CustomerServiceMode } from '../lib/serviceMode';
import { getActiveSessionForTenant, setActiveSessionForTenant } from '../lib/tenantStorage';
import { useCartStore } from '../store/cartStore';

function buildIdempotencyKey(tenantSlug: string) {
  return `BHOJFLOW_${tenantSlug}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function incrementCustomerOverlayLock() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const current = Number(root.dataset.rfCustomerOverlayCount || '0');
  const next = current + 1;
  root.dataset.rfCustomerOverlayCount = String(next);
  root.dataset.rfCustomerOverlay = 'open';
}

function decrementCustomerOverlayLock() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const current = Number(root.dataset.rfCustomerOverlayCount || '0');
  const next = Math.max(0, current - 1);
  if (next === 0) {
    delete root.dataset.rfCustomerOverlayCount;
    delete root.dataset.rfCustomerOverlay;
    return;
  }
  root.dataset.rfCustomerOverlayCount = String(next);
  root.dataset.rfCustomerOverlay = 'open';
}

export function CartDrawer({ onClose, tenantSlug, tableId }: any) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getCartTotal,
    tableSeat,
    customerName,
    customerPhone,
    orderType,
    setOrderType,
    activeSheet,
    setActiveSheet,
  } = useCartStore();
  const isOpen = activeSheet === 'CART';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isBillExpanded, setIsBillExpanded] = useState(false);

  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const { data: recommendations = [] } = useQuery({
    queryKey: ['upsell', tenantSlug, safeItems.map((item: any) => item?.menuItem?.id).filter(Boolean).sort().join(',')],
    queryFn: async () => {
      if (safeItems.length === 0) return [];
      const response = await api.post('/ai/upsell', {
        tenantSlug,
        cartItemIds: safeItems.map((item: any) => item?.menuItem?.id).filter(Boolean),
      });
      return Array.isArray(response.data?.recommendations) ? response.data.recommendations : [];
    },
    enabled: safeItems.length > 0 && isOpen,
    staleTime: 1000 * 60 * 5,
  });

  const { data: tenantMenuMeta } = useQuery({
    queryKey: ['menu', tenantSlug],
    queryFn: async () => {
      const response = await publicApi.get(`/${tenantSlug}/menu`);
      return response.data;
    },
    enabled: Boolean(tenantSlug && isOpen),
    placeholderData: () => queryClient.getQueryData(['menu', tenantSlug]),
    staleTime: 1000 * 60 * 5,
  });

  const handleClose = () => {
    setActiveSheet('NONE');
    if (onClose) onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = 'auto';
      return undefined;
    }
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    incrementCustomerOverlayLock();
    return () => {
      decrementCustomerOverlayLock();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!errorText) return undefined;
    const timer = window.setTimeout(() => setErrorText(null), 5000);
    return () => window.clearTimeout(timer);
  }, [errorText]);

  const subtotal = getCartTotal();
  const taxRate = Number(tenantMenuMeta?.taxRate || 0);
  const taxAmount = subtotal * (taxRate / 100);
  const totalAmount = subtotal + taxAmount;
  const totalItems = safeItems.reduce((sum, item) => sum + Number(item?.quantity || 0), 0);
  const restaurantName = tenantMenuMeta?.name;

  const resolvedOrderType = tableId ? 'DINE_IN' : orderType ? normalizeCustomerServiceMode(orderType) : undefined;
  const orderServiceCopy = resolvedOrderType ? getCustomerServiceCopy(resolvedOrderType) : null;

  if (!isOpen) return null;

  const submitCheckout = async (selectedOrderType: CustomerServiceMode) => {
    if (!tenantSlug || safeItems.length === 0) return;

    setIsSubmitting(true);
    setErrorText(null);

    const sessionToken = getActiveSessionForTenant(tenantSlug);
    const idempotencyKey = buildIdempotencyKey(String(tenantSlug));

    const itemsPayload = safeItems.map((item) => {
      const safeModifiers = Array.isArray(item?.modifiers) ? item.modifiers : [];
      const lineNotes = String(item?.notes || '').trim();
      const seatNote = tableSeat ? `Seat ${tableSeat}` : '';
      const notes = [lineNotes, seatNote].filter(Boolean).join(' | ');

      return {
        menuItemId: item?.menuItem?.id,
        quantity: Math.max(1, Number(item?.quantity) || 1),
        notes: notes || undefined,
        selectedModifiers: safeModifiers
          .filter((modifier: any) => Boolean(modifier?.id))
          .map((modifier: any) => ({
            id: modifier.id,
          })),
      };
    });

    if (itemsPayload.some((item) => !item.menuItemId)) {
      setErrorText('Some cart items are no longer valid. Please remove them and try again.');
      setIsSubmitting(false);
      return;
    }

    const payload = {
      sessionId: sessionToken,
      tableId,
      orderType: tableId ? 'DINE_IN' : selectedOrderType,
      customerName,
      customerPhone,
      items: itemsPayload,
      idempotencyKey,
    };

    try {
      if (!navigator.onLine) throw new Error('Network Error');

      const orderResponse = await publicApi.post(`/${tenantSlug}/orders`, payload, {
        headers: {
          'x-idempotency-key': idempotencyKey,
        },
      });

      const createdSessionId =
        orderResponse?.data?.sessionId ||
        orderResponse?.data?.diningSessionId ||
        orderResponse?.data?.order?.diningSessionId ||
        orderResponse?.data?.order?.sessionId;

      if (createdSessionId) {
        setActiveSessionForTenant(tenantSlug, createdSessionId);
      }

      if (!tableId) {
        setOrderType(selectedOrderType);
      }
      clearCart();

      window.setTimeout(() => {
        handleClose();
        const finalSessionId = getActiveSessionForTenant(tenantSlug) || createdSessionId || sessionToken;
        if (finalSessionId) {
          navigate(`/order/${tenantSlug}/session/${finalSessionId}`);
          return;
        }
        navigate(`/order/${tenantSlug}/status`);
      }, 650);
    } catch (error: any) {
      if (!navigator.onLine || error?.message === 'Network Error') {
        const queue: any[] = (await get('offline_orders')) || [];
        queue.push({ tenantSlug, payload });
        await set('offline_orders', queue);
        if (!tableId) {
          setOrderType(selectedOrderType);
        }
        clearCart();
        setErrorText('You are offline. The order has been safely queued and will send when connection returns.');
        window.setTimeout(() => handleClose(), 2200);
      } else {
        const serverMessage =
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          'Checkout could not be completed. Please try again.';
        setErrorText(serverMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckout = () => {
    if (!tenantSlug || safeItems.length === 0 || isSubmitting) return;
    submitCheckout(resolvedOrderType || 'DINE_IN');
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-end lg:items-stretch lg:p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-500"
        onClick={handleClose}
      />

      <div
        className="relative flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-[32px] shadow-2xl transition-all duration-500 lg:h-full lg:max-w-4xl lg:rounded-[32px] slide-up"
        style={{ background: 'var(--bg)' }}
      >
        <div className="absolute left-0 right-0 top-0 z-[70] p-6 lg:hidden">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-800" />
        </div>

        <div
          className="relative z-[60] flex items-center justify-between border-b px-6 py-5 lg:px-8"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: 'var(--surface-3)', color: 'var(--brand)' }}
            >
              <ShoppingBag size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
                Your order
              </h2>
              <p className="text-xs font-black uppercase tracking-[0.16em] opacity-60" style={{ color: 'var(--text-3)' }}>
                {restaurantName || 'Restaurant'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="flex h-11 w-11 items-center justify-center rounded-2xl transition-all active:scale-90"
            style={{ background: 'var(--surface-3)', color: 'var(--text-1)' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-5 pb-6 lg:px-6">
          {errorText && (
            <div
              className="mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3"
              style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
            >
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-red-500" />
              <p className="text-sm font-bold text-red-500">{errorText}</p>
            </div>
          )}

          {safeItems.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center py-16 text-center">
              <div
                className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl"
                style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
              >
                <UtensilsCrossed size={34} />
              </div>
              <h3 className="text-2xl font-black" style={{ color: 'var(--text-1)' }}>
                Your cart is empty
              </h3>
              <p className="mt-2 max-w-sm text-sm font-medium" style={{ color: 'var(--text-3)' }}>
                Add dishes from the menu and we&apos;ll keep the pricing, taxes, and kitchen timing clear here.
              </p>
              <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
                <button
                  onClick={handleClose}
                  className="rounded-2xl px-5 py-3.5 text-sm font-black text-white"
                  style={{ background: 'var(--brand)' }}
                >
                  Browse menu
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6 lg:space-y-0">
              <div className="space-y-5">
                <div
                  className="rounded-2xl border px-4 py-4 lg:hidden"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--text-3)' }}>
                    Checkout mode
                  </p>
                  
                  {tableId ? (
                    <>
                      <p className="mt-1 text-sm font-black" style={{ color: 'var(--text-1)' }}>
                        Dine In
                      </p>
                      <p className="mt-1 text-[12px] font-medium leading-relaxed" style={{ color: 'var(--text-3)' }}>
                        This order will stay attached to your current table session.
                      </p>
                    </>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setOrderType('DINE_IN')}
                        className={`flex-1 rounded-xl py-2.5 text-xs font-black transition-all ${
                          orderType === 'DINE_IN' || (!orderType && resolvedOrderType === 'DINE_IN')
                            ? 'text-white shadow-md'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        style={
                          orderType === 'DINE_IN' || (!orderType && resolvedOrderType === 'DINE_IN')
                            ? { background: 'var(--brand)' }
                            : { background: 'var(--surface-raised)', color: 'var(--text-2)', border: '1px solid var(--border)' }
                        }
                      >
                        Dine In
                      </button>
                      <button
                        onClick={() => setOrderType('TAKEAWAY')}
                        className={`flex-1 rounded-xl py-2.5 text-xs font-black transition-all ${
                          orderType === 'TAKEAWAY' || (!orderType && resolvedOrderType === 'TAKEAWAY')
                            ? 'text-white shadow-md'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        style={
                          orderType === 'TAKEAWAY' || (!orderType && resolvedOrderType === 'TAKEAWAY')
                            ? { background: 'var(--brand)' }
                            : { background: 'var(--surface-raised)', color: 'var(--text-2)', border: '1px solid var(--border)' }
                        }
                      >
                        Packing
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--brand)' }}>
                      Your basket
                    </p>
                    <h3 className="mt-1 text-lg font-black" style={{ color: 'var(--text-1)' }}>
                      Review the order before checkout
                    </h3>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                    style={{ background: 'var(--surface)', color: 'var(--text-3)', border: '1px solid var(--border)' }}
                  >
                    {totalItems} item{totalItems === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="space-y-4">
                  {safeItems.map((item) => {
                    const modifierNames = (Array.isArray(item?.modifiers) ? item.modifiers : [])
                      .map((modifier: any) => modifier?.name)
                      .filter(Boolean);

                    return (
                      <div
                        key={item.id}
                        className="border-b border-dashed pb-5 last:border-0"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {item?.menuItem?.isVeg ? (
                                <div className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-sm border border-green-600 bg-white p-[1.5px]">
                                  <div className="h-1 w-1 rounded-full bg-green-600" />
                                </div>
                              ) : (
                                <div className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-sm border border-red-600 bg-white p-[1.5px]">
                                  <div className="h-1 w-1 rounded-full bg-red-600" />
                                </div>
                              )}
                              <h3 className="truncate text-base font-black" style={{ color: 'var(--text-1)' }}>
                                {item?.menuItem?.name || 'Menu item'}
                              </h3>
                            </div>

                            <p className="mt-1 text-sm font-bold" style={{ color: 'var(--text-1)' }}>
                              {formatINR(Number(item?.totalPrice || 0))}
                            </p>

                            {modifierNames.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {modifierNames.map((modifierName) => (
                                  <span
                                    key={`${item.id}-${modifierName}`}
                                    className="text-[11px] font-medium italic"
                                    style={{ color: 'var(--text-3)' }}
                                  >
                                    + {modifierName}
                                  </span>
                                ))}
                              </div>
                            ) : null}

                            {item?.notes ? (
                              <p
                                className="mt-2 text-[11px] font-medium leading-relaxed opacity-70"
                                style={{ color: 'var(--text-3)' }}
                              >
                                Note: {item.notes}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex flex-col items-end gap-3">
                            <div
                              className="flex items-center gap-2 rounded-xl border p-1"
                              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                            >
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg transition-all active:scale-90"
                                style={{ background: 'var(--surface-3)', color: 'var(--text-1)' }}
                              >
                                <Minus size={12} />
                              </button>
                              <span className="w-5 text-center text-sm font-black" style={{ color: 'var(--text-1)' }}>
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg transition-all active:scale-90"
                                style={{ background: 'var(--brand)', color: 'white' }}
                              >
                                <Plus size={12} />
                              </button>
                            </div>

                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {recommendations.length > 0 && (
                  <div className="mt-8">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-amber-500" />
                        <h3 className="text-sm font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
                          Complement your meal
                        </h3>
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-50" style={{ color: 'var(--text-3)' }}>
                        Recommended for you
                      </p>
                    </div>
                    
                    <div className="custom-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pb-4">
                      {recommendations.map((item: any) => (
                        <div
                          key={item.id}
                          className="relative w-40 flex-shrink-0 flex flex-col overflow-hidden rounded-2xl border"
                          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                        >
                          <div className="h-28 w-full overflow-hidden">
                            <img
                              src={getDirectImageUrl(
                                item?.images?.[0] ||
                                  item?.imageUrl ||
                                  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
                              )}
                              alt={item?.name}
                              className="h-full w-full object-cover transition-transform hover:scale-105"
                            />
                          </div>
                          
                          <div className="flex flex-1 flex-col p-3">
                            <h4 className="line-clamp-1 text-xs font-black" style={{ color: 'var(--text-1)' }}>
                              {item?.name}
                            </h4>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-xs font-black" style={{ color: 'var(--brand)' }}>
                                {formatINR(Number(item?.price || 0))}
                              </span>
                              
                              <button
                                onClick={() =>
                                  addItem({
                                    id: `upsell-${item.id}-${Date.now()}`,
                                    menuItem: item,
                                    quantity: 1,
                                    modifiers: [],
                                    totalPrice: Number(item?.price || 0),
                                  })
                                }
                                className="flex h-7 items-center gap-1 rounded-lg px-2 text-[10px] font-black uppercase tracking-widest text-white shadow-sm transition-all active:scale-90"
                                style={{ background: 'var(--brand)' }}
                              >
                                <span>Add</span>
                                <Plus size={10} strokeWidth={4} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden lg:block">
                <div className="sticky top-0 space-y-4">
                  <div
                    className="rounded-[28px] border p-5 shadow-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                  >
                    <div className="mb-4 flex items-center gap-2">
                      <Clock3 size={14} style={{ color: 'var(--brand)' }} />
                      <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                        Checkout summary
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm font-medium" style={{ color: 'var(--text-2)' }}>
                        <span>Items subtotal</span>
                        <span>{formatINR(subtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-medium" style={{ color: 'var(--text-2)' }}>
                        <span>GST ({taxRate}%)</span>
                        <span>{formatINR(taxAmount)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                        <span className="text-base font-black" style={{ color: 'var(--text-1)' }}>
                          Total payable
                        </span>
                        <span className="text-2xl font-black" style={{ color: 'var(--brand)' }}>
                          {formatINR(totalAmount)}
                        </span>
                      </div>
                    </div>

                    <div
                      className="mt-4 rounded-2xl border px-3 py-3"
                      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--text-3)' }}>
                        Checkout mode
                      </p>
                      
                      {tableId ? (
                        <>
                          <p className="mt-1 text-sm font-black" style={{ color: 'var(--text-1)' }}>
                            Dine In
                          </p>
                          <p className="mt-1 text-[12px] font-medium leading-relaxed" style={{ color: 'var(--text-3)' }}>
                            This order will stay attached to your current table session.
                          </p>
                        </>
                      ) : (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => setOrderType('DINE_IN')}
                            className={`flex-1 rounded-xl py-2.5 text-xs font-black transition-all ${
                              orderType === 'DINE_IN' || (!orderType && resolvedOrderType === 'DINE_IN')
                                ? 'text-white shadow-md'
                                : 'opacity-70 hover:opacity-100'
                            }`}
                            style={
                              orderType === 'DINE_IN' || (!orderType && resolvedOrderType === 'DINE_IN')
                                ? { background: 'var(--brand)' }
                                : { background: 'var(--surface-raised)', color: 'var(--text-2)', border: '1px solid var(--border)' }
                            }
                          >
                            Dine In
                          </button>
                          <button
                            onClick={() => setOrderType('TAKEAWAY')}
                            className={`flex-1 rounded-xl py-2.5 text-xs font-black transition-all ${
                              orderType === 'TAKEAWAY' || (!orderType && resolvedOrderType === 'TAKEAWAY')
                                ? 'text-white shadow-md'
                                : 'opacity-70 hover:opacity-100'
                            }`}
                            style={
                              orderType === 'TAKEAWAY' || (!orderType && resolvedOrderType === 'TAKEAWAY')
                                ? { background: 'var(--brand)' }
                                : { background: 'var(--surface-raised)', color: 'var(--text-2)', border: '1px solid var(--border)' }
                            }
                          >
                            Packing
                          </button>
                        </div>
                      )}
                    </div>

                    <div
                      className="mt-4 flex items-start gap-2 rounded-2xl px-3 py-3"
                      style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
                    >
                      <UserRound size={15} className="mt-0.5 flex-shrink-0" />
                      <p className="text-[12px] font-medium leading-relaxed">
                        Taxes are visible before checkout, and the final tracker stays linked to this restaurant session only.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-3 rounded-[24px] py-4 text-base font-black text-white shadow-xl transition-all active:scale-[0.99] disabled:opacity-70"
                    style={{ background: 'var(--brand)' }}
                  >
                    {isSubmitting ? 'Placing order...' : 'Place order'}
                    {!isSubmitting ? <ChevronRight size={18} /> : null}
                  </button>

                  <p className="text-center text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                    Secure restaurant checkout
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {safeItems.length > 0 && (
          <div
            className="border-t px-5 pt-4 lg:hidden"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface)',
              boxShadow: '0 -18px 32px rgba(15, 23, 42, 0.08)',
              paddingBottom: 'max(1rem, calc(var(--customer-safe-bottom) + 0.75rem))',
            }}
          >
            <div
              className={`mb-4 overflow-hidden rounded-[24px] border transition-all duration-300 ${isBillExpanded ? 'pb-2' : ''}`}
              style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
            >
              <button
                onClick={() => setIsBillExpanded(!isBillExpanded)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-all active:scale-[0.98]"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--text-3)' }}>
                    Ready to place {isBillExpanded ? '▲' : '▼'}
                  </p>
                  <p className="mt-1 truncate text-lg font-black" style={{ color: 'var(--text-1)' }}>
                    {formatINR(totalAmount)}
                  </p>
                  <p className="mt-1 truncate text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
                    {tableId ? 'Dine In' : orderServiceCopy?.label || 'Choose at checkout'} | {totalItems} item{totalItems === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <Clock3 size={16} className={isBillExpanded ? 'text-brand' : 'text-slate-400'} />
                </div>
              </button>

              {isBillExpanded && (
                <div className="mx-4 space-y-2 border-t border-dashed pt-3 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between text-[13px] font-bold" style={{ color: 'var(--text-2)' }}>
                    <span className="opacity-60">Items subtotal</span>
                    <span>{formatINR(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[13px] font-bold" style={{ color: 'var(--text-2)' }}>
                    <span className="opacity-60">GST ({taxRate}%)</span>
                    <span>{formatINR(taxAmount)}</span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleCheckout}
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-3 rounded-[24px] py-4 text-base font-black text-white shadow-xl transition-all active:scale-[0.99] disabled:opacity-70"
              style={{ background: 'var(--brand)' }}
            >
              {isSubmitting ? 'Placing order...' : 'Place order'}
              {!isSubmitting ? <ChevronRight size={18} /> : null}
            </button>

            <p className="mt-3 text-center text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
              Secure restaurant checkout
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
