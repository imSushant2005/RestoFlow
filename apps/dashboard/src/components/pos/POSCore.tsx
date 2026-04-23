// --- Types ---
import { getDirectImageUrl } from '../../lib/images';

export type OrderType = 'DINE_IN' | 'TAKEAWAY';
export type FulfillmentMode = 'SEND_TO_KITCHEN' | 'DIRECT_BILL';

export interface AssistedLineModifier {
  id: string;
  name: string;
  groupName: string;
  priceAdjustment: number;
}

export interface AssistedLineItem {
  id: string; // Internal POS ID
  menuItemId: string;
  name: string;
  basePrice: number;
  quantity: number;
  notes: string;
  selectedModifierIds: string[];
  selectedModifiers: AssistedLineModifier[];
  lineTotal: number;
}

export interface AssistedResult {
  billPath?: string | null;
  invoiceNumber?: string | null;
  sessionId?: string;
  paymentStatus?: string | null;
  source?: string;
}

// --- Constants & Config ---
export const POS_ANIMATIONS = {
  SPRING: { type: 'spring', stiffness: 400, damping: 30 },
  SHIMMER: {
    initial: { x: '-100%' },
    animate: { x: '100%' },
    transition: { repeat: Infinity, duration: 2, ease: 'linear' }
  }
} as const;

export const POS_UI = {
  GLASS: "bg-slate-900/60 backdrop-blur-2xl border border-white/5",
  CARD: "bg-slate-900/40 border border-white/5 hover:border-blue-500/30 transition-all",
  BUTTON_ACCENT: "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/20",
};

// --- Helpers ---
export function readPrice(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

export function calculateLineTotal(basePrice: number, quantity: number, modifiers: AssistedLineModifier[]): number {
  const modTotal = modifiers.reduce((sum, m) => sum + readPrice(m.priceAdjustment), 0);
  return (readPrice(basePrice) + modTotal) * Math.max(1, quantity);
}

export const generatePosGradient = (seed: string): string => {
  const hash = Array.from(seed).reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  const hue = Math.abs(hash % 360);
  return `linear-gradient(135deg, hsl(${hue}, 60%, 15%), hsl(${(hue + 60) % 360}, 70%, 5%))`;
};

export const parseImageUrl = (url: string | null | undefined): string => {
  return getDirectImageUrl(url);
};
