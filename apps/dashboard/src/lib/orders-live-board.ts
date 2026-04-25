import { format } from 'date-fns';

export type SessionPaymentMethod = 'cash' | 'online' | 'upi' | 'card' | 'other';
export type MiniPaymentGateMode = 'record' | 'verify';

function parseDateValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null;

  const date =
    value instanceof Date
      ? value
      : typeof value === 'number'
        ? new Date(value)
        : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function formatTimeValue(value: unknown, fallback = '--:--') {
  const parsed = parseDateValue(value);
  if (!parsed) return fallback;
  return format(parsed, 'h:mm a');
}

export function formatStatusLabel(value: unknown) {
  const normalized = String(value || '').trim();
  if (!normalized) return 'latest state';
  return normalized.replace(/_/g, ' ').toLowerCase();
}

export function asOrderCode(value: unknown) {
  const raw = typeof value === 'string' ? value : String(value || '');
  if (!raw) return '------';
  return raw.slice(-6).toUpperCase();
}

export function getCompactOrderToken(orderNumber: unknown, fallbackValue?: unknown) {
  const raw = String(orderNumber || '').trim().toUpperCase();
  if (raw) {
    const segments = raw.split('-').filter(Boolean);
    const tail = segments[segments.length - 1] || raw;
    return tail.slice(-3);
  }
  return asOrderCode(fallbackValue).slice(-3);
}

export function normalizeGuestDisplayName(value: unknown) {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  return normalized || 'Guest';
}

export function toAmount(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function resolveTicketTotal(
  orders: any[] = [],
  session?: { bill?: { totalAmount?: unknown } | null } | null,
) {
  const billTotal = toAmount(session?.bill?.totalAmount);
  if (billTotal > 0) {
    return billTotal;
  }
  return orders.reduce((sum, order) => sum + toAmount(order?.totalAmount), 0);
}

export function toValidTimestamp(value: unknown) {
  const parsed = parseDateValue(value);
  return parsed ? parsed.getTime() : 0;
}

export function resolveOrderWorkflowStatus(order: any) {
  const stage = String(order?.stage || '').trim().toUpperCase();
  const status = String(order?.status || '').trim().toUpperCase();
  const isFinished = Boolean(order?.isFinished);

  const raw = stage || status;

  if (isFinished) return 'SERVED';
  if (raw === 'COMPLETE' || raw === 'COMPLETED' || raw === 'RECEIVED' || raw === 'CLOSED') return 'SERVED';
  if (raw === 'COMPLETE_SETTLE') return 'SERVED';
  if (raw === 'IN_PROGRESS') return 'PREPARING';
  if (raw === 'CONFIRMED') return 'ACCEPTED';
  if (raw === 'PREPARING' || raw === 'READY' || raw === 'SERVED' || raw === 'ACCEPTED' || raw === 'NEW') {
    return raw;
  }

  return status || stage || 'NEW';
}

export function normalizeSessionPaymentMethod(value: unknown): SessionPaymentMethod {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'online' || normalized === 'upi' || normalized === 'card' || normalized === 'other') {
    return normalized;
  }
  return 'cash';
}

export function isMiniTokenFlowPlan(plan?: string | null) {
  return String(plan || '').trim().toUpperCase() === 'MINI';
}

export function formatElapsedLabel(totalMinutes: number) {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return `${hours}:${String(remainingMinutes).padStart(2, '0')}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours > 0) return `${days}d ${remainingHours}h`;
  return `${days}d`;
}

export function maskPhoneForOps(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 4) return String(value || '').trim() || 'No phone';
  return `....${digits.slice(-4)}`;
}

export function getPipelineItemSummary(item: any) {
  const baseName = String(item?.menuItem?.name || item?.name || 'Item').trim();
  const note = String(item?.notes || '').trim();
  return [baseName, note].filter(Boolean).join(' | ');
}

export function getTableLabel(entity: { table?: { name?: string } | null; orderType?: string | null }) {
  if (entity.table?.name) return `Table ${entity.table.name}`;
  return String(entity.orderType || '').toUpperCase() === 'TAKEAWAY' ? 'Takeaway Pack' : 'Takeaway';
}

export function matchesOrderSearch(order: any, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const haystack = [
    order?.orderNumber,
    order?.id,
    order?.customerName,
    order?.customerPhone,
    order?.table?.name,
    order?.diningSession?.customer?.name,
    order?.diningSession?.customer?.phone,
    order?.diningSession?.bill?.invoiceNumber,
    ...(Array.isArray(order?.items) ? order.items.flatMap((item: any) => [item?.name, item?.menuItem?.name, item?.notes]) : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export function matchesTicketSearch(ticket: any, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const haystack = [
    ticket?.sessionId,
    ticket?.id,
    ticket?.customerName,
    ticket?.customerPhone,
    ticket?.table?.name,
    ticket?.session?.bill?.invoiceNumber,
    ...(Array.isArray(ticket?.orders) ? ticket.orders.map((order: any) => order?.orderNumber) : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (haystack.includes(normalizedQuery)) return true;
  return Array.isArray(ticket?.orders) ? ticket.orders.some((order: any) => matchesOrderSearch(order, normalizedQuery)) : false;
}

export function getMiniSessionPaymentStatus(order: any) {
  return String(order?.diningSession?.bill?.paymentStatus || '').toUpperCase();
}

export function getMiniSessionPaymentMethod(order: any) {
  return normalizeSessionPaymentMethod(order?.diningSession?.bill?.paymentMethod);
}

export function isMiniAwaitingVerification(order: any) {
  return getMiniSessionPaymentStatus(order) === 'PENDING_VERIFICATION';
}

export function isMiniAwaitingOnlinePayment(order: any) {
  const paymentMethod = getMiniSessionPaymentMethod(order);
  const paymentStatus = getMiniSessionPaymentStatus(order);
  return paymentMethod === 'online' && paymentStatus !== 'PENDING_VERIFICATION' && paymentStatus !== 'PAID';
}

export function getMiniPaymentGateMode(order: any): MiniPaymentGateMode {
  return isMiniAwaitingVerification(order) ? 'verify' : 'record';
}

export function getMiniPrimaryActionLabel(order: any) {
  const paymentStatus = getMiniSessionPaymentStatus(order);
  const paymentMethod = getMiniSessionPaymentMethod(order);

  if (paymentStatus === 'PAID') return 'Accept & Start';
  if (paymentStatus === 'PENDING_VERIFICATION') return 'Verify / Accept';
  if (paymentMethod === 'online') return 'Waiting for UPI';
  if (paymentMethod === 'cash') return 'Take Cash & Accept';
  return 'Take Payment & Accept';
}

export function getMiniPaymentBadge(order: any) {
  const paymentStatus = getMiniSessionPaymentStatus(order);
  const paymentMethod = getMiniSessionPaymentMethod(order);

  if (paymentStatus === 'PAID') {
    return {
      label: 'PAID TOKEN',
      className: 'bg-emerald-600/10 text-emerald-400 border-emerald-500/20',
    };
  }

  if (paymentStatus === 'PENDING_VERIFICATION') {
    return {
      label: paymentMethod === 'online' ? 'VERIFY UPI' : 'VERIFY CASH',
      className: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    };
  }

  if (paymentMethod === 'online') {
    return {
      label: 'UPI IN PROCESS',
      className: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    };
  }

  if (paymentMethod === 'cash') {
    return {
      label: 'PAYMENT DUE',
      className: 'bg-red-500/10 text-red-300 border-red-500/20',
    };
  }

  return {
    label: 'PAYMENT DUE',
    className: 'bg-red-500/10 text-red-300 border-red-500/20',
  };
}

export function getPaymentIndicatorTone(order: any) {
  const paymentStatus = getMiniSessionPaymentStatus(order);
  const paymentMethod = getMiniSessionPaymentMethod(order);

  if (paymentStatus === 'PAID') {
    return {
      dotClassName: 'bg-emerald-400',
      label: 'Paid',
    };
  }

  if (paymentStatus === 'PENDING_VERIFICATION' || paymentMethod === 'online') {
    return {
      dotClassName: 'bg-amber-400',
      label: 'In Process',
    };
  }

  return {
    dotClassName: 'bg-red-400',
    label: 'Due',
  };
}

export function getStatusChipClass(status: string) {
  if (status === 'NEW' || status === 'ACCEPTED') return 'chip-blue';
  if (status === 'PREPARING') return 'chip-yellow';
  if (status === 'READY') return 'chip-green';
  return 'chip-gray';
}

const LIVE_ORDER_STATUSES = new Set(['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED']);

export function isLiveBoardOrder(order: any) {
  return LIVE_ORDER_STATUSES.has(String(order?.status || '').toUpperCase());
}

export function mergeLiveOrder(existing: any, incoming: any) {
  if (!existing) return incoming;

  const merged = {
    ...existing,
    ...incoming,
    table: incoming?.table ?? existing.table,
    diningSession: incoming?.diningSession
      ? {
          ...existing.diningSession,
          ...incoming.diningSession,
          bill: incoming.diningSession.bill
            ? { ...existing.diningSession?.bill, ...incoming.diningSession.bill }
            : existing.diningSession?.bill,
        }
      : existing.diningSession,
    items: Array.isArray(incoming?.items) ? incoming.items : existing.items,
  };

  const existingVersion = Number(existing?.version);
  const incomingVersion = Number(incoming?.version);
  const pendingStatus = String(existing?.__pendingStatus || '').toUpperCase();
  const incomingStatus = String(incoming?.status || '').toUpperCase();
  if (
    pendingStatus &&
    (incomingStatus === pendingStatus ||
      (Number.isFinite(existingVersion) && Number.isFinite(incomingVersion) && incomingVersion > existingVersion))
  ) {
    const clean = { ...merged };
    delete clean.__pendingStatus;
    delete clean.__pendingStatusAt;
    return clean;
  }

  return merged;
}

export function applyLiveOrderUpdate(old: any, incoming: any) {
  const safe = Array.isArray(old) ? old : [];
  if (!incoming?.id) return safe;

  const existing = safe.find((order: any) => order.id === incoming.id);
  const pendingStatus = String(existing?.__pendingStatus || '').toUpperCase();
  const incomingStatus = String(incoming?.status || '').toUpperCase();
  const existingVersion = Number(existing?.version);
  const incomingVersion = Number(incoming?.version);

  if (
    existing &&
    pendingStatus &&
    incomingStatus !== pendingStatus &&
    Number.isFinite(existingVersion) &&
    Number.isFinite(incomingVersion) &&
    incomingVersion <= existingVersion
  ) {
    return safe;
  }

  if (
    existing &&
    typeof existing.version === 'number' &&
    typeof incoming.version === 'number' &&
    incoming.version < existing.version
  ) {
    return safe;
  }

  const merged = mergeLiveOrder(existing, incoming);
  if (!isLiveBoardOrder(merged)) {
    return safe.filter((order: any) => order.id !== incoming.id);
  }

  if (!existing) {
    return [merged, ...safe];
  }

  return safe.map((order: any) => (order.id === incoming.id ? merged : order));
}

export const PIPELINE_STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ['PREPARING', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SERVED', 'CANCELLED'],
  SERVED: ['RECEIVED'],
};

export function getPipelineColumnIdForStatus(status: unknown) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'NEW') return 'col-new';
  if (normalized === 'ACCEPTED') return 'col-preparing';
  if (normalized === 'PREPARING') return 'col-preparing';
  if (normalized === 'READY') return 'col-ready';
  if (normalized === 'SERVED') return 'col-served';
  return '';
}

export function canMovePipelineStatus(fromStatus: unknown, toStatus: unknown) {
  const from = String(fromStatus || '').toUpperCase();
  const to = String(toStatus || '').toUpperCase();
  return from === to || Boolean(PIPELINE_STATUS_TRANSITIONS[from]?.includes(to));
}
