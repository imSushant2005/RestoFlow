import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartModifier {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  id: string; 
  menuItem: any;
  quantity: number;
  modifiers: CartModifier[];
  notes?: string;
  totalPrice: number;
}

interface CartState {
  items: CartItem[];
  tenantSlug?: string;
  customerName?: string;
  customerPhone?: string;
  orderType?: 'DINE_IN' | 'TAKEAWAY';
  tableSeat?: string;
  tenantPlan?: string;
  tenantBusinessType?: string;
  setTenantScope: (tenantSlug?: string) => void;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  setCustomerInfo: (info: { name: string; phone: string; type?: 'DINE_IN' | 'TAKEAWAY'; seat?: string }) => void;
  setOrderType: (orderType?: 'DINE_IN' | 'TAKEAWAY') => void;
  setTenantPlan: (plan: string) => void;
  setTenantBusinessType: (businessType: string) => void;
  isAnyModalOpen: boolean;
  setIsAnyModalOpen: (isOpen: boolean) => void;
  activeSheet: 'NONE' | 'MODIFIER' | 'MENU' | 'CART' | 'WAITER';
  setActiveSheet: (sheet: 'NONE' | 'MODIFIER' | 'MENU' | 'CART' | 'WAITER') => void;
}

const newStorageKey = 'BHOJFLOW-cart';
const legacyStorageKey = 'BHOJFLOW-cart';

function getItemSignature(item: CartItem) {
  const menuItemId = String(item?.menuItem?.id || item?.id || '');
  const normalizedNotes = String(item?.notes || '').trim().toLowerCase();
  const normalizedModifiers = (Array.isArray(item?.modifiers) ? item.modifiers : [])
    .map((modifier) => `${String(modifier?.id || '')}:${String(modifier?.name || '')}:${Number(modifier?.price || 0)}`)
    .sort()
    .join('|');

  return `${menuItemId}__${normalizedNotes}__${normalizedModifiers}`;
}

if (typeof window !== 'undefined') {
  const legacyCart = localStorage.getItem(legacyStorageKey);
  if (legacyCart && !localStorage.getItem(newStorageKey)) {
    localStorage.setItem(newStorageKey, legacyCart);
  }
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      tenantSlug: undefined,
      setTenantScope: (tenantSlug) =>
        set((state) => {
          const nextTenant = tenantSlug || undefined;
          if (!nextTenant || state.tenantSlug === nextTenant) {
            return { tenantSlug: nextTenant };
          }
          // Keep customer identity but isolate cart/session context per tenant.
          return {
            tenantSlug: nextTenant,
            items: [],
            orderType: undefined,
            tableSeat: undefined,
            tenantPlan: undefined,
            tenantBusinessType: undefined,
          };
        }),
      addItem: (item) =>
        set((state) => {
          const safeItems = Array.isArray(state.items) ? state.items : [];
          const safeQuantity = Math.max(1, Number(item?.quantity) || 1);
          const incoming: CartItem = { ...item, quantity: safeQuantity };
          const incomingSignature = getItemSignature(incoming);
          const existingIndex = safeItems.findIndex((existing) => getItemSignature(existing) === incomingSignature);

          if (existingIndex === -1) {
            return { items: [...safeItems, incoming] };
          }

          return {
            items: safeItems.map((existing, index) =>
              index === existingIndex
                ? {
                    ...existing,
                    quantity: existing.quantity + safeQuantity,
                    totalPrice: incoming.totalPrice,
                    menuItem: incoming.menuItem,
                    modifiers: incoming.modifiers,
                    notes: incoming.notes,
                  }
                : existing,
            ),
          };
        }),
      removeItem: (id) => set((state) => {
        const safeItems = Array.isArray(state.items) ? state.items : [];
        return { items: safeItems.filter(i => i.id !== id) };
      }),
      updateQuantity: (id, qty) => set((state) => {
        const safeItems = Array.isArray(state.items) ? state.items : [];
        return {
          items: qty <= 0
            ? safeItems.filter((item) => item.id !== id)
            : safeItems.map(i => i.id === id ? { ...i, quantity: qty } : i)
        };
      }),
      clearCart: () => set({ items: [], tableSeat: undefined }),
      getCartTotal: () => {
        const items = get().items;
        const safeItems = Array.isArray(items) ? items : [];
        return safeItems.reduce((total, item) => total + ((Number(item.totalPrice) || 0) * (Number(item.quantity) || 1)), 0);
      },
      setCustomerInfo: (info) =>
        set((state) => ({
          customerName: info.name,
          customerPhone: info.phone,
          orderType: info.type === undefined ? state.orderType : info.type,
          tableSeat: info.seat,
        })),
      setOrderType: (orderType) => set({ orderType }),
      setTenantPlan: (plan) => set({ tenantPlan: plan }),
      setTenantBusinessType: (businessType) => set({ tenantBusinessType: businessType }),
      isAnyModalOpen: false,
      setIsAnyModalOpen: (isOpen) => set({ isAnyModalOpen: isOpen }),
      activeSheet: 'NONE',
      setActiveSheet: (sheet) => set({ activeSheet: sheet, isAnyModalOpen: sheet !== 'NONE' }),
    }),
    {
      name: newStorageKey,
      partialize: (state) => ({
        items: state.items,
        tenantSlug: state.tenantSlug,
        customerName: state.customerName,
        customerPhone: state.customerPhone,
        orderType: state.orderType,
        tableSeat: state.tableSeat,
        tenantPlan: state.tenantPlan,
        tenantBusinessType: state.tenantBusinessType,
      }),
    }
  )
);
