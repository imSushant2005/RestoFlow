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
  customerName?: string;
  customerPhone?: string;
  orderType?: 'DINE_IN' | 'TAKEAWAY';
  tableSeat?: string;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  setCustomerInfo: (info: { name: string; phone: string; type: 'DINE_IN' | 'TAKEAWAY', seat?: string }) => void;
}

const newStorageKey = 'restoflow-cart';
const legacyStorageKey = 'dineflow-cart';

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
      addItem: (item) => set((state) => ({ items: [...state.items, item] })),
      removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.id !== id) })),
      updateQuantity: (id, qty) => set((state) => ({
        items: state.items.map(i => i.id === id ? { ...i, quantity: qty } : i)
      })),
      clearCart: () => set({ items: [], tableSeat: undefined }),
      getCartTotal: () => {
        return get().items.reduce((total, item) => total + (item.totalPrice * item.quantity), 0);
      },
      setCustomerInfo: (info) => set({ customerName: info.name, customerPhone: info.phone, orderType: info.type, tableSeat: info.seat })
    }),
    {
      name: newStorageKey,
    }
  )
);
