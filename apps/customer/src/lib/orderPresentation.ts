import { Bell, CheckCircle2, ChefHat, Clock3, UtensilsCrossed } from 'lucide-react';

export type CustomerOrderStage = 'RECEIVED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export const CUSTOMER_PROGRESS_STEPS = [
  { key: 'RECEIVED', label: 'Order received', rank: 1, icon: Clock3, tone: 'from-blue-500/30 to-sky-500/10' },
  { key: 'PREPARING', label: 'Preparing', rank: 2, icon: ChefHat, tone: 'from-amber-500/30 to-orange-500/10' },
  { key: 'READY', label: 'Ready', rank: 3, icon: UtensilsCrossed, tone: 'from-emerald-500/30 to-green-500/10' },
  { key: 'COMPLETED', label: 'Completed', rank: 4, icon: CheckCircle2, tone: 'from-violet-500/30 to-fuchsia-500/10' },
] as const;

export function getCustomerStage(status?: string): CustomerOrderStage {
  switch (String(status || '').toUpperCase()) {
    case 'NEW':
    case 'ACCEPTED':
      return 'RECEIVED';
    case 'PREPARING':
      return 'PREPARING';
    case 'READY':
      return 'READY';
    case 'SERVED':
    case 'RECEIVED':
      return 'COMPLETED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'RECEIVED';
  }
}

export function getCustomerStageRank(status?: string) {
  const stage = getCustomerStage(status);
  if (stage === 'CANCELLED') return 0;
  return CUSTOMER_PROGRESS_STEPS.find((step) => step.key === stage)?.rank || 1;
}

export function getCustomerStatusMeta(status?: string, orderType?: string) {
  const normalizedStatus = String(status || '').toUpperCase();
  const normalizedOrderType = String(orderType || '').toUpperCase();

  switch (normalizedStatus) {
    case 'NEW':
      return {
        label: 'Order received',
        detail: 'The restaurant has your order in queue.',
        toneClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        icon: Bell,
      };
    case 'ACCEPTED':
      return {
        label: 'Order confirmed',
        detail: 'The kitchen accepted your order.',
        toneClass: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
        icon: CheckCircle2,
      };
    case 'PREPARING':
      return {
        label: 'Preparing',
        detail: 'The kitchen is cooking your order now.',
        toneClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        icon: ChefHat,
      };
    case 'READY':
      return {
        label: normalizedOrderType === 'TAKEAWAY' ? 'Ready for pickup' : 'Ready to serve',
        detail: normalizedOrderType === 'TAKEAWAY' ? 'Head to the counter when you are ready.' : 'Your order is leaving the kitchen.',
        toneClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        icon: UtensilsCrossed,
      };
    case 'SERVED':
    case 'RECEIVED':
      return {
        label: 'Completed',
        detail: 'This order has been delivered and closed.',
        toneClass: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
        icon: CheckCircle2,
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        detail: 'This order was cancelled by the restaurant.',
        toneClass: 'bg-red-500/10 text-red-500 border-red-500/20',
        icon: Bell,
      };
    default:
      return {
        label: 'Order received',
        detail: 'The restaurant has your order in queue.',
        toneClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        icon: Clock3,
      };
  }
}

export function getCustomerProcessSummary({
  orderType,
  stageRank,
  isAwaitingBill,
  isClosed,
}: {
  orderType?: string;
  stageRank: number;
  isAwaitingBill?: boolean;
  isClosed?: boolean;
}) {
  const normalizedOrderType = String(orderType || '').toUpperCase();

  if (isClosed || stageRank >= 4) return 'Completed and ready in your history';
  if (isAwaitingBill) return 'Waiting for the restaurant to confirm your final bill';
  if (stageRank >= 3) {
    return normalizedOrderType === 'TAKEAWAY' ? 'Your order is ready for pickup' : 'Your order is leaving the kitchen';
  }
  if (stageRank >= 2) return 'The kitchen is preparing your order';
  return 'The restaurant received your order and will start soon';
}
