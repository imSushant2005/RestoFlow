import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  UserRound,
  UtensilsCrossed,
  WifiOff,
  X,
} from 'lucide-react';
import { get, set } from 'idb-keyval';
import { useNavigate } from 'react-router-dom';
import { api, publicApi } from '../lib/api';
import { formatINR } from '../lib/currency';
import { getActiveSessionForTenant, setActiveSessionForTenant } from '../lib/tenantStorage';
import { useCartStore } from '../store/cartStore';

function buildIdempotencyKey(tenantSlug: string) {
  return `restoflow_${tenantSlug}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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

export function CartDrawer({ isOpen, onClose, tenantSlug, tableId }: any) {
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
  } = useCartStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const activeSessionId = getActiveSessionForTenant(tenantSlug);

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

  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.style.overflow = 'hidden';

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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

  const estimatedPrepMinutes = useMemo(() => {
    if (safeItems.length === 0) return 0;
    const weightedPrep = safeItems.reduce((sum, item) => {
      const prep = Number(item?.menuItem?.prepTimeMinutes || 12);
      return sum + prep * Math.max(1, Number(item?.quantity || 1));
    }, 0);

    return Math.max(12, Math.min(40, Math.ceil(weightedPrep / Math.max(totalItems, 1)) + 6));
  }, [safeItems, totalItems]);

  if (!isOpen) return null;

  const handleCheckout = async () => {
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

      clearCart();
      setShowSuccess(true);

      window.setTimeout(() => {
        onClose();
        setShowSuccess(false);
        const finalSessionId = getActiveSessionForTenant(tenantSlug) || createdSessionId || sessionToken;
        if (finalSessionId) {
          navigate(`/order/${tenantSlug}/session/${finalSessionId}`);
          return;
        }
        navigate(`/order/${tenantSlug}/status`);
      }, 1800);
    } catch (error: any) {
      if (!navigator.onLine || error?.message === 'Network Error') {
        const queue: any[] = (await get('offline_orders')) || [];
        queue.push({ tenantSlug, payload });
        await set('offline_orders', queue);
        clearCart();
        setErrorText('You are offline. The order has been safely queued and will send when connection returns.');
        window.setTimeout(() => onClose(), 2200);
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

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-end lg:items-stretch">
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-sm transition-opacity"
        onClick={!isSubmitting ? onClose : undefined}
      />

      <div
        className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-t-[34px] shadow-2xl lg:h-full lg:rounded-none lg:rounded-l-[32px]"
        style={{
          background: 'var(--bg)',
          height: 'min(92dvh, calc(100dvh - 0.75rem))',
        }}
      >
        <div
          className="border-b px-5 pb-4 pt-5 lg:px-6"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
              >
                <ShoppingBag size={20} />
              </div>
              <div>
                <h2 className="text-xl font-black" style={{ color: 'var(--text-1)' }}>
                  Order Summary
                </h2>
                <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                  {totalItems} items ready for checkout
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90"
              style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div
              className="rounded-2xl border px-3 py-3"
              style={{ background: 'var(--surface-3)', borderColor: 'var(--border)' }}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--text-3)' }}>
                Order Type
              </p>
              <p className="mt-1 text-sm font-black" style={{ color: 'var(--text-1)' }}>
                {tableId ? 'Dine in' : orderType === 'TAKEAWAY' ? 'Takeaway' : 'Pickup'}
              </p>
              <p className="mt-1 text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
                {tableId ? `Table ${tableId}${tableSeat ? ` | Seat ${tableSeat}` : ''}` : 'Collect from counter'}
              </p>
            </div>

            <div
              className="rounded-2xl border px-3 py-3"
              style={{ background: 'var(--surface-3)', borderColor: 'var(--border)' }}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--text-3)' }}>
                ETA
              </p>
              <p className="mt-1 text-sm font-black" style={{ color: 'var(--text-1)' }}>
                ~{estimatedPrepMinutes} min
              </p>
              <p className="mt-1 text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
                Based on kitchen prep and queue
              </p>
            </div>

            <div
              className="rounded-2xl border px-3 py-3"
              style={{ background: 'var(--surface-3)', borderColor: 'var(--border)' }}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--text-3)' }}>
                Guest
              </p>
              <p className="mt-1 truncate text-sm font-black" style={{ color: 'var(--text-1)' }}>
                {customerName || 'Guest checkout'}
              </p>
              <p className="mt-1 truncate text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
                {customerPhone || 'Phone added at checkout'}
              </p>
            </div>
          </div>

          {isOffline && (
            <div
              className="mt-3 flex items-start gap-2 rounded-2xl border px-3 py-3"
              style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.18)' }}
            >
              <WifiOff size={16} className="mt-0.5 text-amber-500" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-500">Offline-safe</p>
                <p className="mt-1 text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>
                  If checkout fails because the network drops, this order will queue locally and retry automatically.
                </p>
              </div>
            </div>
          )}
        </div>

        {showSuccess && (
          <div
            className="absolute inset-0 z-[95] flex flex-col items-center justify-center gap-3 px-8 text-center"
            style={{ background: 'rgba(10, 11, 15, 0.92)' }}
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 size={38} className="text-white" />
            </div>
            <h3 className="text-2xl font-black text-white">Order sent</h3>
            <p className="max-w-sm text-sm font-medium text-white/75">
              The restaurant has your order. Opening the live tracker now.
            </p>
          </div>
        )}

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
                  onClick={onClose}
                  className="rounded-2xl px-5 py-3.5 text-sm font-black text-white"
                  style={{ background: 'var(--brand)' }}
                >
                  Browse menu
                </button>
                {activeSessionId ? (
                  <button
                    onClick={() => navigate(`/order/${tenantSlug}/session/${activeSessionId}`)}
                    className="rounded-2xl px-5 py-3.5 text-sm font-black"
                    style={{ background: 'var(--surface)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
                  >
                    Open live tracker
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-4">
                {safeItems.map((item) => {
                  const lineTotal = Number(item?.totalPrice || 0) * Math.max(1, Number(item?.quantity || 1));
                  const modifierNames = (Array.isArray(item?.modifiers) ? item.modifiers : [])
                    .map((modifier: any) => modifier?.name)
                    .filter(Boolean);

                  return (
                    <div
                      key={item.id}
                      className="rounded-[28px] border p-4 shadow-sm"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                      <div className="flex gap-4">
                        <div
                          className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <img
                            src={
                              item?.menuItem?.imageUrl ||
                              item?.menuItem?.images?.[0] ||
                              'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'
                            }
                            alt={item?.menuItem?.name || 'Cart item'}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-base font-black" style={{ color: 'var(--text-1)' }}>
                                {item?.menuItem?.name || 'Menu item'}
                              </h3>
                              <p className="mt-1 text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                                {formatINR(Number(item?.totalPrice || 0))} each
                              </p>
                            </div>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-red-500/10"
                              style={{ color: '#ef4444' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {modifierNames.length > 0 && (
                            <p
                              className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em]"
                              style={{ color: 'var(--text-3)' }}
                            >
                              {modifierNames.join(' / ')}
                            </p>
                          )}

                          {item?.notes ? (
                            <div
                              className="mt-2 rounded-xl px-3 py-2 text-[12px] font-medium"
                              style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
                            >
                              Note: {item.notes}
                            </div>
                          ) : null}

                          <div className="mt-4 flex items-center justify-between">
                            <div
                              className="flex items-center gap-3 rounded-2xl px-2 py-1.5"
                              style={{ background: 'var(--surface-3)' }}
                            >
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="flex h-8 w-8 items-center justify-center rounded-xl border"
                                style={{ color: 'var(--text-2)', borderColor: 'var(--border)', background: 'var(--surface)' }}
                              >
                                <Minus size={14} />
                              </button>
                              <span className="w-5 text-center text-sm font-black" style={{ color: 'var(--text-1)' }}>
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="flex h-8 w-8 items-center justify-center rounded-xl border"
                                style={{ color: 'var(--text-2)', borderColor: 'var(--border)', background: 'var(--surface)' }}
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            <div className="text-right">
                              <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--text-3)' }}>
                                Line Total
                              </p>
                              <p className="text-base font-black" style={{ color: 'var(--text-1)' }}>
                                {formatINR(lineTotal)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {recommendations.length > 0 && (
                <section
                  className="rounded-[28px] border p-4"
                  style={{ background: 'rgba(79, 70, 229, 0.06)', borderColor: 'rgba(99, 102, 241, 0.12)' }}
                >
                  <div className="mb-4 flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-500" />
                    <h3 className="text-xs font-black uppercase tracking-[0.16em] text-indigo-500">
                      Smart add-ons
                    </h3>
                  </div>
                  <div className="custom-scrollbar flex gap-3 overflow-x-auto pb-2">
                    {recommendations.map((item: any) => (
                      <button
                        key={item.id}
                        onClick={() =>
                          addItem({
                            id: `upsell-${item.id}-${Date.now()}`,
                            menuItem: item,
                            quantity: 1,
                            modifiers: [],
                            totalPrice: Number(item?.price || 0),
                          })
                        }
                        className="min-w-[170px] rounded-2xl border p-3 text-left transition-all active:scale-[0.98]"
                        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                      >
                        <div className="mb-3 h-20 overflow-hidden rounded-xl">
                          <img
                            src={item?.images?.[0] || item?.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'}
                            alt={item?.name || 'Recommendation'}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <p className="line-clamp-1 text-sm font-black" style={{ color: 'var(--text-1)' }}>
                          {item?.name || 'Recommended dish'}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs font-black" style={{ color: 'var(--brand)' }}>
                            {formatINR(Number(item?.price || 0))}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-indigo-500">
                            Add
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {safeItems.length > 0 && (
          <div
            className="border-t px-5 pt-4 lg:px-6"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface)',
              paddingBottom: 'max(1rem, calc(var(--customer-safe-bottom) + 0.75rem))',
            }}
          >
            <div className="mb-4 rounded-[28px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
              <div className="mb-3 flex items-center gap-2">
                <Clock3 size={14} style={{ color: 'var(--brand)' }} />
                <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                  Pricing breakdown
                </p>
              </div>

              <div className="space-y-2">
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
                  <span className="text-xl font-black" style={{ color: 'var(--brand)' }}>
                    {formatINR(totalAmount)}
                  </span>
                </div>
              </div>

              <div
                className="mt-3 flex items-start gap-2 rounded-2xl px-3 py-3"
                style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
              >
                <UserRound size={15} className="mt-0.5 flex-shrink-0" />
                <p className="text-[12px] font-medium leading-relaxed">
                  No hidden charges. Taxes are shown before you place the order, and the final tracker will stay linked
                  to this restaurant session only.
                </p>
              </div>
            </div>

            {activeSessionId ? (
              <button
                onClick={() => navigate(`/order/${tenantSlug}/session/${activeSessionId}`)}
                className="mb-3 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-black"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
              >
                <span>Open current live tracker</span>
                <ChevronRight size={18} />
              </button>
            ) : null}

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
