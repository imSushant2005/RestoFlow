import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCallback, useEffect, useMemo, useState, memo } from 'react';
import { format } from 'date-fns';
import { formatINR } from '../lib/currency';
import { CreditCard, ReceiptText, RefreshCw, Signal, XCircle, Zap, ShoppingBag, UtensilsCrossed, Clock, ChevronDown, ChevronUp, GripVertical, CheckCircle, FileText, Trash2 } from 'lucide-react';
import { InvoiceModal } from './InvoicesPage';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  useDroppable,
  useDraggable,
  DragStartEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import { CSS } from '@dnd-kit/utilities';

type DashboardRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN' | 'WAITER';
type BillWorkflowAction = 'AWAITING_BILL' | 'PAID_CASH' | 'PAID_ONLINE';
type SessionPaymentMethod = 'cash' | 'online' | 'upi' | 'card' | 'other';
type SessionActionOptions = {
  shouldClose?: boolean;
  ensureBillFirst?: boolean;
  force?: boolean;
};

// Removed TERMINAL_STATUSES
// --- ISOLATED TIME TICKER (Avoids global order re-renders) ---
const TimeElapsedBadge = memo(({ createdAtMs, isUrgentThreshold = 15, isUrgentCallback }: any) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  const elapsedMin = createdAtMs > 0 ? Math.max(0, Math.floor((now - createdAtMs) / 60000)) : 0;
  const isUrgent = elapsedMin >= isUrgentThreshold;

  useEffect(() => {
    if (isUrgentCallback) isUrgentCallback(isUrgent);
  }, [isUrgent, isUrgentCallback]);

  if (elapsedMin <= 0) return null;
  return <span>({formatElapsedLabel(elapsedMin)})</span>;
});

function readRestaurantSlugFromStorage() {
  try {
    const raw = localStorage.getItem('restaurant');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return typeof parsed?.slug === 'string' ? parsed.slug.trim() : '';
  } catch {
    return '';
  }
}

function isValidSlug(value: string) {
  return /^[a-z0-9-]+$/i.test(value);
}

function resolveRole(rawRole?: string | null): DashboardRole {
  const normalized = (rawRole || '').toUpperCase();
  if (normalized === 'MANAGER') return 'MANAGER';
  if (normalized === 'CASHIER') return 'CASHIER';
  if (normalized === 'KITCHEN') return 'KITCHEN';
  if (normalized === 'WAITER') return 'WAITER';
  return 'OWNER';
}

function parseDateValue(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatTimeValue(value: unknown, fallback = '--:--') {
  const parsed = parseDateValue(value);
  if (!parsed) return fallback;
  return format(parsed, 'h:mm a');
}

function formatStatusLabel(value: unknown) {
  const normalized = String(value || '').trim();
  if (!normalized) return 'latest state';
  return normalized.replace(/_/g, ' ').toLowerCase();
}

function asOrderCode(value: unknown) {
  const raw = typeof value === 'string' ? value : String(value || '');
  if (!raw) return '------';
  return raw.slice(-6).toUpperCase();
}

function toAmount(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function resolveTicketTotal(orders: any[] = [], session?: { bill?: { totalAmount?: unknown } | null } | null) {
  const billTotal = toAmount(session?.bill?.totalAmount);
  if (billTotal > 0) {
    return billTotal;
  }
  return orders.reduce((sum, order) => sum + toAmount(order?.totalAmount), 0);
}

function toValidTimestamp(value: unknown) {
  const parsed = parseDateValue(value);
  return parsed ? parsed.getTime() : 0;
}

function normalizeSessionPaymentMethod(value: unknown): SessionPaymentMethod {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'online' || normalized === 'upi' || normalized === 'card' || normalized === 'other') {
    return normalized;
  }
  return 'cash';
}

function formatElapsedLabel(totalMinutes: number) {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours > 0) return `${days}d ${remainingHours}h`;
  return `${days}d`;
}

function getTableLabel(entity: { table?: { name?: string } | null; orderType?: string | null }) {
  if (entity.table?.name) return `Table ${entity.table.name}`;
  return String(entity.orderType || '').toUpperCase() === 'TAKEAWAY' ? 'Takeaway Pack' : 'Takeaway';
}

function getStatusChipClass(status: string) {
  if (status === 'NEW' || status === 'ACCEPTED') return 'chip-blue';
  if (status === 'PREPARING') return 'chip-yellow';
  if (status === 'READY') return 'chip-green';
  return 'chip-gray';
}


const TicketCard = memo(({
  ticket,
  canCloseSession,
  selectedBillAction,
  onSelectBillAction,
  finishPending,
  paymentPending,
  onFinishSession,
  onCompleteSession,
  onViewInvoice
}: {
  ticket: any;
  canCloseSession: boolean;
  selectedBillAction: string;
  onSelectBillAction: (sessionId: string, action: string) => void;
  finishPending: boolean;
  paymentPending: boolean;
  onFinishSession: (sessionId: string, force?: boolean) => void;
  onCompleteSession: (sessionId: string, paymentMethod: SessionPaymentMethod, options?: SessionActionOptions) => void;
  onViewInvoice: (ticket: any) => void;
}) => {
  const ticketOrders = Array.isArray(ticket?.orders) ? ticket.orders : [];
  const resolvedTicketTotal = resolveTicketTotal(ticketOrders, ticket?.session);
  const sessionStatus = String(ticket?.session?.sessionStatus || '').toUpperCase();
  const sessionPaymentMethod = String(ticket?.session?.bill?.paymentMethod || '').toUpperCase();
  const sessionPaymentStatus = String(ticket?.session?.bill?.paymentStatus || '').toUpperCase();
  const isCancelled = ticketOrders.length > 0 && ticketOrders.every((o: any) => o?.status === 'CANCELLED');
  const isClosedSession = ticket.isSession && sessionStatus === 'CLOSED';
  const createdAtMs = toValidTimestamp(ticket?.createdAt);
  const elapsedMin = createdAtMs > 0 ? Math.max(0, Math.floor((Date.now() - createdAtMs) / 60000)) : 0;
  const activeBatches = ticketOrders.filter((order: any) => order?.status !== 'CANCELLED');
  const outstandingBatches = activeBatches.filter(
    (order: any) => !['SERVED', 'RECEIVED'].includes(String(order?.status || '').toUpperCase()),
  );
  const canCapturePayment = ticket.isSession && canCloseSession && ticket.sessionId && sessionStatus === 'AWAITING_BILL';
  const isUrgent = elapsedMin >= 15 && activeBatches.some((o: any) => ['NEW', 'ACCEPTED', 'PREPARING'].includes(String(o.status).toUpperCase()));

  return (
    <div
      className={`relative flex flex-col gap-4 rounded-2xl p-4 overflow-hidden transition-all duration-300 ${isCancelled ? 'opacity-60' : ''} ${isUrgent ? 'ring-2 ring-red-500/50 shadow-xl shadow-red-500/20' : ''}`}
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}
    >
      <div className={`absolute left-0 right-0 top-0 h-1.5 rounded-t-2xl ${isCancelled ? 'bg-red-500/50' : isUrgent ? 'bg-red-500' : 'bg-blue-600'}`} />
      
      <div className="flex justify-between items-start mt-2 gap-2">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            {ticket.table?.name ? (
              <UtensilsCrossed size={14} className="text-blue-500 shrink-0" />
            ) : (
              <ShoppingBag size={14} className="text-amber-500 shrink-0" />
            )}
            <h3 className="text-xl font-black text-[var(--text-1)] tracking-tight leading-none truncate">
              {getTableLabel(ticket)}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mt-1.5">
             <span className="shrink-0 text-[var(--text-2)]">{ticket.isSession ? 'Tab' : `#${asOrderCode(ticketOrders?.[0]?.id)}`}</span>
             <span className="text-[var(--text-3)] opacity-50 shrink-0">|</span>
             <span className="flex items-center gap-1.5 bg-[var(--surface-3)] px-2 py-0.5 rounded-md border border-[var(--border)] shrink-0 min-w-0 max-w-full">
               <Clock size={10} className="text-[var(--text-3)] shrink-0" />
               <span className="truncate">{formatTimeValue(ticket?.createdAt)}</span>
               {elapsedMin > 0 && (
                 <span className={`${isUrgent ? 'text-red-500' : 'text-[var(--text-3)]'} whitespace-nowrap`}>
                   <TimeElapsedBadge createdAtMs={createdAtMs} isUrgentThreshold={15} />
                 </span>
               )}
             </span>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-1 shrink-0 max-w-[45%]">
          <div className="flex items-center gap-2">
             {ticket.isSession && sessionStatus !== 'CLOSED' && (
               <button 
                 onClick={() => {
                   if (!ticket.sessionId) return;
                   const msg = ticketOrders.length > 0 
                     ? "This session has active orders. Force clear and archive it?"
                     : "Clear and archive this session?";
                   if (window.confirm(msg)) {
                     onCompleteSession(ticket.sessionId, normalizeSessionPaymentMethod(ticket.session?.bill?.paymentMethod), {
                       shouldClose: true,
                       force: true,
                       ensureBillFirst: sessionStatus !== 'AWAITING_BILL' && sessionPaymentStatus !== 'PAID',
                     });
                   }
                 }}
                 className="p-1 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shrink-0"
                 title="Force Clear Session"
               >
                 <Trash2 size={12} />
               </button>
             )}
            <span className="text-xl font-black text-blue-600 truncate max-w-full">{formatINR(resolvedTicketTotal || 0)}</span>
          </div>
          {ticket.isSession && sessionStatus && (
            <div className="flex flex-col items-end gap-1 w-full">
              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border shrink-0 ${
                sessionStatus === 'CLOSED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 flex-shrink-0' : 
                sessionStatus === 'AWAITING_BILL' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 flex-shrink-0' : 
                'bg-[var(--surface-3)] text-[var(--text-3)] border-[var(--border)] flex-shrink-0'
              }`}>
                {sessionStatus.replace(/_/g, ' ')}
              </span>
              {ticket.session?.bill?.invoiceNumber && (
                <div className="flex items-center gap-1.5 w-full justify-end min-w-0">
                  <span className="text-[9px] font-bold text-[var(--text-3)] tracking-tight truncate">
                    {ticket.session.bill.invoiceNumber}
                  </span>
                  <button 
                    onClick={() => onViewInvoice(ticket)}
                    className="p-1 rounded flex-shrink-0 bg-[var(--surface-3)] text-[var(--text-2)] hover:bg-slate-200 hover:text-slate-800 transition-colors"
                  >
                    <FileText size={10} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 mt-1">
        {ticketOrders.map((order: any, idx: number) => (
          <div key={order.id} className="rounded-xl bg-[var(--surface-3)] border border-[var(--border)] p-3 shadow-inner">
            <div className="flex justify-between items-center mb-2">
               <span className="text-[10px] font-black text-slate-500 uppercase">Batch {idx + 1}</span>
               <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${getStatusChipClass(String(order.status || '').toUpperCase())}`}>
                 {order.status}
               </span>
            </div>
            <ul className="space-y-1.5 mt-1">
              {order.items?.map((item: any) => (
                <li key={item.id} className="flex gap-2.5 items-start">
                   <span className="bg-white text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-black mt-0.5">{item.quantity}x</span>
                   <div className="min-w-0 flex-1">
                     <span className="text-sm font-bold text-slate-200 leading-tight block">{item.menuItem?.name || item.name}</span>
                     {item.notes && <span className="text-[10px] font-semibold text-slate-500 mt-0.5 block italic">↳ {item.notes}</span>}
                   </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {ticket.isSession && (
        <div className="mt-2 pt-4 border-t border-white/5 space-y-3">
          {isClosedSession ? (
             <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
               <div className="flex justify-between items-center mb-1">
                 <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Settled</p>
                 <span className="text-[10px] font-black text-emerald-500/50">{sessionPaymentMethod}</span>
               </div>
               <p className="text-[11px] font-semibold text-emerald-400/70">
                 Order completed and archived in history.
               </p>
             </div>
          ) : (
            <>
              {!outstandingBatches.length && sessionStatus !== 'AWAITING_BILL' && (
                <div className="bg-blue-500/5 rounded-xl p-3 text-center border border-blue-500/10">
                   <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">Ready to Bill</p>
                </div>
              )}
              {outstandingBatches.length > 0 && (
                <div className="bg-amber-500/5 rounded-xl p-3 text-center border border-amber-500/10">
                   <p className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">
                     {outstandingBatches.length} batch{outstandingBatches.length > 1 ? 'es' : ''} active
                   </p>
                </div>
              )}
              {canCloseSession && ticket.sessionId && (
                <div className="flex gap-2">
                  <select
                    value={selectedBillAction}
                    onChange={(e) => onSelectBillAction(ticket.sessionId!, e.target.value)}
                    className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-3 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="AWAITING_BILL">Waiting for Bill</option>
                    <option value="PAID_CASH">Paid Cash</option>
                    <option value="PAID_ONLINE">Paid Online</option>
                  </select>
                  <button
                    onClick={() => {
                        if (!ticket.sessionId) return;
                        if (selectedBillAction === 'AWAITING_BILL') {
                          if (sessionStatus === 'AWAITING_BILL') return;

                          if (outstandingBatches.length > 0) {
                            if (!window.confirm(`There are ${outstandingBatches.length} unserved batches. Force generate bill anyway?`)) {
                              return;
                            }
                          } else if (activeBatches.length === 0) {
                            if (!window.confirm("This session has 0 orders. Close it anyway?")) {
                              return;
                            }
                          }
                          
                          onFinishSession(ticket.sessionId, outstandingBatches.length > 0 || activeBatches.length === 0);
                          return;
                        }
                        if (!canCapturePayment) {
                          window.alert('Generate final bill first.');
                          return;
                        }
                        onCompleteSession(ticket.sessionId, selectedBillAction === 'PAID_ONLINE' ? 'online' : 'cash', {
                          shouldClose: true,
                          ensureBillFirst: sessionStatus !== 'AWAITING_BILL' && sessionPaymentStatus !== 'PAID',
                        });
                    }}
                    disabled={finishPending || paymentPending}
                    className="rounded-xl bg-blue-600 px-5 py-3 text-xs font-black text-white hover:bg-blue-500 transition-all disabled:opacity-50"
                    title={selectedBillAction === 'AWAITING_BILL' ? 'Generate Bill' : 'Settle & Close'}
                  >
                    <ReceiptText size={16} />
                  </button>
                </div>
              )}
              {sessionStatus === 'AWAITING_BILL' && (
                <button
                  onClick={() => {
                    if (!ticket.sessionId) return;
                    const isPaid = ticket.session?.bill?.paymentStatus === 'PAID';
                    if (!isPaid && !window.confirm("Payment not recorded. Clear and archive this session anyway?")) return;
                    onCompleteSession(ticket.sessionId, normalizeSessionPaymentMethod(ticket.session?.bill?.paymentMethod), {
                      shouldClose: true,
                      force: !isPaid,
                    });
                  }}
                  disabled={paymentPending}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 text-xs font-black text-white shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.97]"
                >
                  <CheckCircle size={14} />
                  Clear Session & Archive
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
});

const KanbanColumn = ({ id, label, color, bg, badge, children, pulse, isActive }: any) => {
  const { isOver, setNodeRef } = useDroppable({ id });
  
  return (
    <div 
      ref={setNodeRef} 
      className={`kanban-col flex-shrink-0 transition-all duration-300 min-h-[500px] rounded-3xl ${isOver ? 'ring-2 ring-blue-500/50 bg-blue-500/5' : ''}`}
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      <div className={`kanban-col-header sticky top-0 shadow-sm z-20 rounded-t-3xl backdrop-blur-md ${bg}`}>
        <div className="flex items-center gap-2.5">
          {pulse && isActive && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
          )}
          <span className={`font-black text-[11px] tracking-[0.2em] ${color} uppercase`}>{label}</span>
        </div>
        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${badge.className || ''}`}>{badge.count || 0}</span>
      </div>
      <div className="kanban-col-body custom-scrollbar flex flex-col gap-4 p-4">
        {children}
      </div>
    </div>
  );
};

const PipelineCard = memo(({
  order,
  hasKDS,
  canSetKitchenStages,
  canSetServiceStages,
  canCloseSession,
  isStatusPending,
  onUpdateStatus,
  onFinishSession,
  onCompleteSession,
  isCompletePending,
  plan
}: {
  order: any;
  hasKDS: boolean;
  canSetKitchenStages: boolean;
  canSetServiceStages: boolean;
  canCloseSession: boolean;
  isStatusPending: boolean;
  onUpdateStatus: (id: string, status: string, cancelReason?: string) => void;
  onFinishSession?: (sessionId: string, force?: boolean) => void;
  onCompleteSession?: (sessionId: string, paymentMethod: SessionPaymentMethod, options?: SessionActionOptions) => void;
  isCompletePending?: boolean;
  plan?: string;
}) => {
  const [isExpanded, setIsExpanded] = useState(order?.status === 'NEW');
  const currentStatus = String(order?.status || '').toUpperCase();
  const createdAtMs = toValidTimestamp(order?.createdAt);
  const elapsedMinutes = createdAtMs > 0 ? Math.max(0, Math.floor((Date.now() - createdAtMs) / 60000)) : 0;
  const isUrgent = elapsedMinutes >= 15 && ['NEW', 'ACCEPTED', 'PREPARING'].includes(currentStatus);
  const isSessionOrder = Boolean(order?.diningSessionId);
  const sessionStatus = String(order?.diningSession?.sessionStatus || '').toUpperCase();
  const sessionPaymentStatus = String(order?.diningSession?.bill?.paymentStatus || '').toUpperCase();
  const sessionPaymentMethod = normalizeSessionPaymentMethod(order?.diningSession?.bill?.paymentMethod);
  const canMoveSessionToBilling =
    canCloseSession &&
    isSessionOrder &&
    sessionStatus !== 'AWAITING_BILL' &&
    sessionStatus !== 'CLOSED' &&
    sessionStatus !== 'CANCELLED';
  const canArchiveSession =
    canCloseSession &&
    isSessionOrder &&
    (sessionStatus === 'AWAITING_BILL' || sessionPaymentStatus === 'PAID');
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id: order.id,
    data: { order },
    disabled: isStatusPending || isCompletePending || order.status === 'CANCELLED'
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : undefined,
  } : undefined;

  const stripeClass = order.status === 'NEW' || order.status === 'ACCEPTED' ? 'bg-blue-600' : order.status === 'PREPARING' ? 'bg-amber-500' : order.status === 'READY' ? 'bg-emerald-500' : 'bg-slate-700';

  return (
    <div
      ref={setNodeRef}
      className={`relative flex flex-col gap-0 rounded-2xl transition-all duration-300 ${isUrgent ? 'ring-2 ring-red-500 shadow-xl shadow-red-500/20' : ''} ${isDragging ? 'shadow-2xl scale-105 rotate-1' : ''}`}
      style={{ ...style, background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}
    >
      <div className={`absolute left-0 right-0 top-0 h-1 rounded-t-2xl opacity-80 ${stripeClass}`} />
      
      {/* Header - Always Visible */}
      <div 
        className="flex flex-col gap-3 p-4 cursor-pointer rounded-2xl transition-colors hover:bg-white/5 sm:flex-row sm:items-start sm:justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div {...attributes} {...listeners} className="p-1 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 transition-colors">
            <GripVertical size={16} />
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span 
                className={`inline-flex h-8 max-w-full items-center justify-center truncate rounded-xl px-3 text-sm font-black tracking-tight shadow-lg shadow-blue-500/10 ${
                  order.orderType === 'TAKEAWAY' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' :
                  order.orderType === 'ZOMATO' ? 'bg-red-600/20 text-red-400 border border-red-500/30' :
                  order.orderType === 'SWIGGY' ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30' :
                  'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                }`}
                title={order.orderNumber || `T-${asOrderCode(order?.id)}`}
              >
                {order.orderNumber || `T-${asOrderCode(order?.id)}`}
              </span>
              {order.orderType === 'ZOMATO' && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-red-600/10 text-red-500 uppercase tracking-widest border border-red-500/20">ZOMATO</span>
              )}
              {order.orderType === 'SWIGGY' && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-orange-600/10 text-orange-500 uppercase tracking-widest border border-orange-500/20">SWIGGY</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {order.table?.name ? (
                <div className="flex items-center gap-1">
                  <UtensilsCrossed size={10} className="text-emerald-500" />
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none">Table {order.table.name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <ShoppingBag size={10} className="text-blue-400" />
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">
                    {order.orderType === 'TAKEAWAY' ? 'Takeaway' : order.orderType === 'ZOMATO' ? 'Zomato Delivery' : order.orderType === 'SWIGGY' ? 'Swiggy Delivery' : 'Quick Order'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex w-full items-start justify-between gap-3 sm:ml-auto sm:w-auto sm:flex-shrink-0 sm:justify-end">
          <div className="flex min-w-[72px] flex-col gap-1 text-left sm:items-end sm:text-right">
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
               <Clock size={10} className="text-slate-600" />
               {formatTimeValue(order?.createdAt)}
            </div>
            {isUrgent && (
              <span className="text-[9px] font-black text-red-500 uppercase tracking-widest animate-pulse">LATE</span>
            )}
          </div>
          <div className="text-slate-500">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {/* Body - Accordion Content */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[1000px] border-t border-white/5 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-4 space-y-4">
          {order.customerName && (
            <div className="px-3 py-2 rounded-lg bg-slate-800/30 border border-slate-700/50">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Guest</p>
              <p className="text-sm font-bold text-slate-200">{order.customerName}</p>
            </div>
          )}

          <ul className="flex flex-col gap-2.5">
            {order.items?.map((item: any) => (
              <li key={item.id} className="flex items-start gap-3">
                <span className="flex min-w-[24px] items-center justify-center rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm mt-0.5">
                  {item.quantity}x
                </span>
                <div className="min-w-0 flex-1">
                   <span className="block text-sm font-bold leading-tight text-slate-100 tracking-wide">
                     {item.menuItem?.name || item.name}
                   </span>
                   {item.notes && (
                     <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-white/5 p-1.5 border border-white/5">
                        <span className="text-[10px] text-blue-400 leading-none mt-0.5 font-black">↳</span>
                        <span className="flex-1 text-[10px] font-bold text-slate-400 leading-snug italic">{item.notes}</span>
                     </div>
                   )}
                </div>
              </li>
            ))}
          </ul>

          {order.specialInstructions && (
            <div className="rounded-xl bg-orange-500/10 p-3 border border-orange-500/20">
              <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-1">Kitchen Note</p>
              <p className="text-xs font-semibold text-orange-300/80 leading-snug">{order.specialInstructions}</p>
            </div>
          )}

          <div className="pt-2">
            <div className="flex flex-col gap-2.5">
              {currentStatus === 'NEW' && canSetKitchenStages && (
                <div className="grid grid-cols-5 gap-2">
                    <button
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        onUpdateStatus(order.id, (plan === 'MINI' || !hasKDS) ? 'READY' : 'ACCEPTED'); 
                      }}
                      disabled={isStatusPending}
                      className={`col-span-3 rounded-xl py-3 text-xs font-black text-white transition-all active:scale-[0.97] disabled:opacity-50 ${plan === 'MINI' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-blue-600 hover:bg-blue-500'}`}
                    >
                      {plan === 'MINI' ? 'Settle & Accept' : 'Accept'}
                    </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(order.id, 'CANCELLED', 'Rejected'); }}
                    disabled={isStatusPending}
                    className="col-span-2 rounded-xl border border-red-500/30 hover:bg-red-500/10 py-3 text-xs font-bold text-red-500 transition-all active:scale-[0.97]"
                  >
                    Reject
                  </button>
                </div>
              )}
              {currentStatus === 'ACCEPTED' && canSetKitchenStages && (
                <button
                   onClick={(e) => { e.stopPropagation(); onUpdateStatus(order.id, 'PREPARING'); }}
                   disabled={isStatusPending}
                   className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 py-3 text-xs font-black text-white transition-all active:scale-[0.97]"
                >
                  Start Preparing
                </button>
              )}
              {currentStatus === 'PREPARING' && canSetKitchenStages && (
                <button
                   onClick={(e) => { e.stopPropagation(); onUpdateStatus(order.id, 'READY'); }}
                   disabled={isStatusPending}
                   className="w-full rounded-xl bg-orange-500 hover:bg-orange-600 py-3 text-xs font-black text-white transition-all active:scale-[0.97]"
                >
                  Mark Ready
                </button>
              )}
              {currentStatus === 'READY' && canSetServiceStages && (
                <button
                   onClick={(e) => { e.stopPropagation(); onUpdateStatus(order.id, 'SERVED'); }}
                   disabled={isStatusPending}
                   className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 text-xs font-black text-white transition-all active:scale-[0.97]"
                >
                  Mark Served
                </button>
              )}
              {currentStatus === 'SERVED' && !isSessionOrder && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(order.id, 'RECEIVED');
                  }}
                  disabled={isStatusPending}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-700 hover:bg-slate-600 py-3 text-xs font-black text-white transition-all active:scale-[0.97]"
                >
                  <CheckCircle size={14} />
                  Complete Pickup
                </button>
              )}
              {currentStatus === 'SERVED' && isSessionOrder && canMoveSessionToBilling && onFinishSession && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const isPaid = order.diningSession?.bill?.paymentStatus === 'PAID';
                    if (plan === 'MINI' && !isPaid) {
                      onUpdateStatus(order.id, 'COMPLETE_SETTLE');
                    } else if (order.diningSessionId) {
                      onFinishSession(order.diningSessionId);
                    }
                  }}
                  disabled={isStatusPending || isCompletePending}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 py-3 text-xs font-black text-white shadow-lg shadow-amber-500/20 transition-all active:scale-[0.97]"
                >
                  <ReceiptText size={14} />
                  Move to Billing
                </button>
              )}
              {currentStatus === 'SERVED' && isSessionOrder && canArchiveSession && onCompleteSession && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const isPaid = sessionPaymentStatus === 'PAID';
                    if (plan === 'MINI' && !isPaid) {
                      onUpdateStatus(order.id, 'COMPLETE_SETTLE');
                      return;
                    }
                    if (order.diningSessionId) {
                      onCompleteSession(order.diningSessionId, sessionPaymentMethod, {
                        shouldClose: true,
                        ensureBillFirst: sessionStatus !== 'AWAITING_BILL' && sessionPaymentStatus !== 'PAID',
                      });
                    }
                  }}
                  disabled={isStatusPending || isCompletePending}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 text-xs font-black text-white shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.97]"
                >
                  <CheckCircle size={14} />
                  {sessionPaymentStatus === 'PAID' ? 'Archive Session' : 'Record Payment & Archive'}
                </button>
              )}
              {currentStatus === 'SERVED' && isSessionOrder && !canCloseSession && (
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Cashier will close this session from billing
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export function Orders({ role }: { role?: string }) {
  const queryClient = useQueryClient();
  const effectiveRole = resolveRole(role || localStorage.getItem('userRole'));
  const canViewSessions = effectiveRole !== 'KITCHEN';
  const canViewHistory = effectiveRole !== 'KITCHEN';
  const canCloseSession = effectiveRole === 'OWNER' || effectiveRole === 'MANAGER' || effectiveRole === 'CASHIER';
  const { features, plan } = usePlanFeatures();
  const [localToast, setLocalToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  useEffect(() => {
    if (localToast) {
      const timer = setTimeout(() => setLocalToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [localToast]);
  const canSetKitchenStages = ['OWNER', 'MANAGER', 'KITCHEN'].includes(effectiveRole);
  const canSetServiceStages = ['OWNER', 'MANAGER', 'CASHIER', 'WAITER'].includes(effectiveRole);
  const canToggleBusyMode = effectiveRole === 'OWNER' || effectiveRole === 'MANAGER';
  const canBulkClose = canCloseSession;
  const [activeTab, setActiveTab] = useState<'PIPELINE' | 'SESSIONS' | 'HISTORY'>('PIPELINE');
  const [busyMode, setBusyMode] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingMiniSettle, setPendingMiniSettle] = useState<{ id: string; status: string; order: any } | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { data: businessSettings } = useQuery<any>({
    queryKey: ['settings-business'],
    queryFn: async () => {
      const res = await api.get('/settings/business');
      return res.data;
    },
    staleTime: 1000 * 60,
  });

  const resolveTenantSlug = useCallback(async () => {
    const fromQuery = (businessSettings?.slug || '').trim();
    if (fromQuery && isValidSlug(fromQuery)) return fromQuery;

    const fromStorage = readRestaurantSlugFromStorage().trim();
    if (fromStorage && isValidSlug(fromStorage)) return fromStorage;
    return '';
  }, [businessSettings?.slug]);

  const openTestOrder = async () => {
    const slug = await resolveTenantSlug();
    if (!slug) {
      setLocalToast({
        message: 'Tenant slug missing. Complete Business Profile setup first.',
        type: 'error',
      });
      return;
    }
    window.open(`/order/${slug}`, '_blank', 'noopener,noreferrer');
  };

  const refreshOperationalData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['live-orders'] });
    queryClient.invalidateQueries({ queryKey: ['order-history'] });
    queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
  }, [queryClient]);

  const { data: liveOrders = [], isLoading, isError: isLiveOrdersError } = useQuery<any[]>({
    queryKey: ['live-orders'],
    queryFn: async () => {
      const res = await api.get('/orders');
      return res.data;
    },
    staleTime: 1000 * 10,
    refetchInterval: 30000,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const { data: historyResponse } = useQuery<any>({
    queryKey: ['order-history'],
    queryFn: async () => {
      const res = await api.get('/orders/history?includeCount=false');
      return res.data;
    },
    enabled: activeTab === 'HISTORY',
    placeholderData: () => queryClient.getQueryData(['order-history']),
    staleTime: 1000 * 30,
  });


  const statusMutation = useMutation({
    mutationFn: async ({ id, status, cancelReason, expectedVersion }: any) => {
      const res = await api.patch(`/orders/${id}/status`, { status, cancelReason, version: expectedVersion });
      return res.data;
    },
    onMutate: async (newUpdate: any) => {
      await queryClient.cancelQueries({ queryKey: ['live-orders'] });
      const previousState = queryClient.getQueryData(['live-orders']);

      // Optimistically move ticket
      queryClient.setQueryData(['live-orders'], (old: any) => {
        if (!old) return [];
        return old.map((order: any) => {
          if (order.id === newUpdate.id) {
            return { ...order, status: newUpdate.status, version: (order.version || 0) + 1 };
          }
          return order;
        });
      });

      return { previousState, requestedStatus: newUpdate.status };
    },
    onError: (err: any, variables: any, context: any) => {
      const requestedStatus = String(context?.requestedStatus || variables?.status || '').toUpperCase();
      const recoveryTruth = err.response?.data?.recovery?.truth;
      if (err.response?.status === 409 || err.response?.data?.error === 'OCC_CONFLICT') {
        if (recoveryTruth?.id) {
          queryClient.setQueryData(['live-orders'], (old: any) => {
            const safe = Array.isArray(old) ? old : [];
            return safe.map((order: any) => (order.id === recoveryTruth.id ? recoveryTruth : order));
          });
        }

        setLocalToast({
          message:
            recoveryTruth?.status && recoveryTruth.status !== requestedStatus
              ? `Another screen already moved this ticket to ${formatStatusLabel(recoveryTruth.status)}.`
              : 'This ticket was already updated elsewhere. Synced latest state.',
          type: 'info',
        });
        return;
      }

      if (!navigator.onLine) {
        setLocalToast({ message: 'You are offline. Cannot change order status.', type: 'error' });
      } else {
        setLocalToast({
          message:
            err?.response?.data?.error ||
            err?.message ||
            'Failed to update status. Restored latest saved state.',
          type: 'error',
        });
      }

      queryClient.setQueryData(['live-orders'], context?.previousState);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['live-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-history'] });
      queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
    },
  });

  const finishSessionMutation = useMutation({
    mutationFn: async ({ sessionId, force = false }: { sessionId: string; force?: boolean }) => {
      const slug = await resolveTenantSlug();
      if (!slug) {
        throw new Error('Tenant slug missing. Complete Business Profile setup first.');
      }
      return api.post(`/public/${slug}/sessions/${sessionId}/admin-finish`, { force });
    },
    onSuccess: refreshOperationalData,
  });

  const completeSessionMutation = useMutation({
    mutationFn: async ({
      sessionId,
      paymentMethod,
      shouldClose,
      force = false,
    }: {
      sessionId: string;
      paymentMethod: SessionPaymentMethod;
      shouldClose?: boolean;
      force?: boolean;
    }) => {
      const slug = await resolveTenantSlug();
      if (!slug) {
        throw new Error('Tenant slug missing. Complete Business Profile setup first.');
      }
      return api.post(`/public/${slug}/sessions/${sessionId}/complete`, { paymentMethod, shouldClose, force });
    },
    onSuccess: refreshOperationalData,
  });

  const [activeDragOrder, setActiveDragOrder] = useState<any>(null);
  const [billSelections, setBillSelections] = useState<Record<string, BillWorkflowAction>>({});
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const historyTickets = useMemo(() => {
    const historyOrders = historyResponse?.data || [];
    return Object.values(
      historyOrders.reduce((acc: any, order: any) => {
        const groupId = order?.diningSessionId ? `history_session_${order.diningSessionId}` : `history_order_${order.id}`;
        if (!acc[groupId]) {
          acc[groupId] = {
            id: groupId,
            isSession: Boolean(order?.diningSessionId),
            sessionId: order?.diningSessionId,
            session: order?.diningSession,
            table: order?.table,
            orderType: order?.orderType,
            customerName: order?.diningSession?.customer?.name || order?.customerName,
            customerPhone: order?.diningSession?.customer?.phone || order?.customerPhone,
            orders: [],
            createdAt: order?.diningSession?.openedAt || order?.createdAt,
            totalAmount: 0,
          };
        }
        acc[groupId].orders.push(order);
        acc[groupId].totalAmount = resolveTicketTotal(acc[groupId].orders, acc[groupId].session);
        return acc;
      }, {}),
    ).sort((a: any, b: any) => toValidTimestamp(b?.createdAt) - toValidTimestamp(a?.createdAt));
  }, [historyResponse?.data]);

  const handleSelectBillAction = useCallback((sessionId: string, action: string) => {
    setBillSelections((previous) => ({
      ...previous,
      [sessionId]: action as BillWorkflowAction,
    }));
  }, []);

  const handleFinishSession = useCallback((sessionId: string, force = false) => {
    finishSessionMutation.mutate(
      { sessionId, force },
      {
        onError: (error: any) => {
          setLocalToast({
            message: error?.response?.data?.error || error?.message || 'Could not move this table to billing.',
            type: 'error',
          });
        },
      },
    );
  }, [finishSessionMutation]);

  const handleCompleteSession = useCallback(async (
    sessionId: string,
    paymentMethod: SessionPaymentMethod,
    options?: SessionActionOptions,
  ) => {
    const shouldClose = options?.shouldClose ?? true;
    const ensureBillFirst = options?.ensureBillFirst ?? false;
    const force = options?.force ?? false;

    const settle = () => completeSessionMutation.mutateAsync({ sessionId, paymentMethod, shouldClose, force });

    try {
      if (ensureBillFirst) {
        await finishSessionMutation.mutateAsync({ sessionId, force });
      }

      await settle();
      setLocalToast({
        message: shouldClose ? 'Session archived successfully.' : 'Payment recorded successfully.',
        type: 'success',
      });
      return;
    } catch (error: any) {
      const serverMessage = error?.response?.data?.error || error?.message || '';
      const needsBillFirst =
        error?.response?.status === 409 ||
        String(serverMessage).toLowerCase().includes('final bill');

      if (shouldClose && !ensureBillFirst && needsBillFirst) {
        try {
          await finishSessionMutation.mutateAsync({ sessionId, force });
          await settle();
          setLocalToast({
            message: 'Bill generated and session archived successfully.',
            type: 'success',
          });
          return;
        } catch (retryError: any) {
          setLocalToast({
            message:
              retryError?.response?.data?.error ||
              retryError?.message ||
              'Could not record payment and archive this session.',
            type: 'error',
          });
          return;
        }
      }

      setLocalToast({
        message: serverMessage || 'Could not record payment and archive this session.',
        type: 'error',
      });
    }
  }, [completeSessionMutation, finishSessionMutation]);

  const handleUpdateStatus = useCallback((id: string, status: string, cancelReason?: string) => {
    const order = liveOrders.find((o: any) => o.id === id);
    if (!order) return;

    // Intercept Settle for Mini Plan to ask for Payment Method
    const isPaid = order.diningSession?.bill?.paymentStatus === 'PAID';
    const isSettleRequired = (status === 'READY' || status === 'SERVED' || status === 'COMPLETE_SETTLE');
    if (plan === 'MINI' && !isPaid && isSettleRequired && order.diningSessionId) {
      setPendingMiniSettle({ id, status, order });
      return;
    }

    statusMutation.mutate({ 
      id, 
      status, 
      cancelReason, 
      expectedVersion: order?.version || 0 
    });
  }, [liveOrders, statusMutation, plan]);

  const pipelineColumns = useMemo(() => {
    const cols = [
      { id: 'col-new', label: 'NEW ORDERS', color: 'text-blue-700', bg: 'bg-blue-50/50', badge: 'bg-blue-100 text-blue-800', filter: (o: any) => o.status === 'NEW', pulse: true },
      { id: 'col-kitchen', label: 'IN KITCHEN', color: 'text-amber-700', bg: 'bg-amber-50/50', badge: 'bg-amber-100 text-amber-800', filter: (o: any) => o.status === 'ACCEPTED' || o.status === 'PREPARING', pulse: false },
      { id: 'col-ready', label: 'READY TO SERVE', color: 'text-emerald-700', bg: 'bg-emerald-50/50', badge: 'bg-emerald-100 text-emerald-800', filter: (o: any) => o.status === 'READY', pulse: false },
      { id: 'col-served', label: 'SERVED', color: 'text-slate-500', bg: 'bg-slate-100/50', badge: 'bg-slate-200 text-slate-600', filter: (o: any) => o.status === 'SERVED', pulse: false },
    ];

    if (!features.hasKDS) {
      return cols.filter(c => c.id !== 'col-kitchen');
    }
    return cols;
  }, [features.hasKDS]);

  const sortedLiveOrders = useMemo(() => {
    return [...liveOrders].sort((a: any, b: any) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [liveOrders]);

  const settlePendingMiniOrder = useCallback(async (paymentMethod: SessionPaymentMethod) => {
    if (!pendingMiniSettle) return;

    const { id, status, order } = pendingMiniSettle;
    setPendingMiniSettle(null);

    const shouldClose = status === 'COMPLETE_SETTLE';

    try {
      await completeSessionMutation.mutateAsync({
        sessionId: order.diningSessionId,
        paymentMethod,
        shouldClose,
        force: false,
      });

      if (!shouldClose) {
        statusMutation.mutate({
          id,
          status,
          expectedVersion: order.version || 0,
        });
      } else {
        refreshOperationalData();
      }

      setLocalToast({
        message: shouldClose
          ? 'Payment recorded and session archived.'
          : `Payment recorded and order moved to ${formatStatusLabel(status)}.`,
        type: 'success',
      });
    } catch (error: any) {
      setLocalToast({
        message: error?.response?.data?.error || error?.message || 'Could not record payment for this order.',
        type: 'error',
      });
    }
  }, [completeSessionMutation, pendingMiniSettle, refreshOperationalData, statusMutation]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-xl p-6 h-48 animate-pulse"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          >
            <div className="w-1/3 h-6 rounded mb-4 shimmer" />
            <div className="w-1/4 h-4 rounded mb-6 shimmer" />
            <div className="space-y-3">
              <div className="w-full h-8 rounded shimmer" />
              <div className="w-5/6 h-8 rounded shimmer" />
            </div>
          </div>
        ))}
      </div>
    );
  }


  const groupedLive = Object.values(
    liveOrders.reduce((acc: any, order: any) => {
      const fallbackOrderId = asOrderCode(order?.id);
      const groupId = order?.diningSessionId || `single_${fallbackOrderId}`;
      if (!acc[groupId]) {
        acc[groupId] = {
          id: groupId,
          isSession: Boolean(order?.diningSessionId),
          sessionId: order?.diningSessionId,
          session: order?.diningSession,
          table: order?.table,
          orderType: order?.orderType,
          customerName: order?.diningSession?.customer?.name || order?.customerName,
          customerPhone: order?.diningSession?.customer?.phone || order?.customerPhone,
          orders: [],
          createdAt: order?.diningSession?.openedAt || order?.createdAt,
          totalAmount: 0,
        };
      }
      acc[groupId].orders.push(order);
      acc[groupId].totalAmount = resolveTicketTotal(acc[groupId].orders, acc[groupId].session);
      return acc;
    }, {}),
  ).sort((a: any, b: any) => toValidTimestamp(b?.createdAt) - toValidTimestamp(a?.createdAt));


  const connectionTone = {
    label: 'Synced',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  const overviewTimestamp = format(new Date(), 'MMM d, yyyy | h:mm a');
  const readyOrders = liveOrders.filter((order: any) => order.status === 'READY');

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveDragOrder(active.data.current?.order);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragOrder(null);

    if (!over) return;

    const orderId = active.id as string;
    const order = active.data.current?.order;
    if (!order) return;

    const targetStatusMap: Record<string, string> = {
      'col-new': 'NEW',
      'col-kitchen': 'ACCEPTED',
      'col-ready': 'READY',
      'col-served': 'SERVED',
    };

    let targetColId = over.id as string;
    
    // If we dropped on top of another card, find its container
    if (!targetStatusMap[targetColId]) {
      const overOrder = liveOrders.find((o: any) => o.id === targetColId);
      if (overOrder) {
        if (overOrder.status === 'NEW') targetColId = 'col-new';
        else if (['ACCEPTED', 'PREPARING'].includes(overOrder.status)) targetColId = 'col-kitchen';
        else if (overOrder.status === 'READY') targetColId = 'col-ready';
        else if (overOrder.status === 'SERVED') targetColId = 'col-served';
      }
    }

    const newStatus = targetStatusMap[targetColId];

    if (newStatus && newStatus !== order.status) {
      // Intercept Drag for Mini Plan to ask for Payment Method
      // ONLY IF NOT ALREADY PAID
      const isPaid = order.diningSession?.bill?.paymentStatus === 'PAID';
      const isSettleRequired = (newStatus === 'READY' || newStatus === 'SERVED' || newStatus === 'COMPLETE_SETTLE');
      if (plan === 'MINI' && !isPaid && isSettleRequired && order.diningSessionId) {
        setPendingMiniSettle({ id: orderId, status: newStatus, order });
        return;
      }
      
      statusMutation.mutate({ 
        id: orderId, 
        status: newStatus, 
        expectedVersion: order.version || 0 
      });
    }
  };

  return (
    <>
      <div className="flex h-full min-h-0 flex-col p-3 sm:p-5 lg:p-8 relative">
      {pendingMiniSettle && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setPendingMiniSettle(null)} />
          <div className="relative w-full max-w-sm rounded-[2.5rem] bg-[#0F1115] p-8 shadow-2xl border border-white/5 animate-in zoom-in-95 duration-300">
             <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-3xl bg-blue-600/20 flex items-center justify-center mb-6 border border-blue-500/30">
                  <CreditCard className="text-blue-500" size={32} />
                </div>
                <h2 className="text-xl font-black text-white tracking-tight">Settle & Accept</h2>
                <p className="mt-2 text-sm text-slate-400 font-bold">
                  How should we record the payment for <span className="text-blue-400">Token {pendingMiniSettle.order.orderNumber || asOrderCode(pendingMiniSettle.order.id)}</span>?
                </p>
                <div className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-emerald-400 text-sm font-black tracking-widest uppercase">
                  Total {formatINR(pendingMiniSettle.order.totalAmount)}
                </div>
             </div>

             <div className="mt-8 grid grid-cols-1 gap-3">
                <button
                  onClick={() => {
                    void settlePendingMiniOrder('cash');
                  }}
                  disabled={completeSessionMutation.isPending}
                  className="group flex items-center justify-between w-full h-16 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black transition-all active:scale-95 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  <div className="flex items-center gap-4">
                    <ReceiptText size={20} className="group-hover:scale-110 transition-transform" />
                    <span>CASH PAYMENT</span>
                  </div>
                  <Zap size={16} className="opacity-50" />
                </button>

                <button
                  onClick={() => {
                    void settlePendingMiniOrder('online');
                  }}
                  disabled={completeSessionMutation.isPending}
                  className="group flex items-center justify-between w-full h-16 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black transition-all active:scale-95 shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  <div className="flex items-center gap-4">
                    <Signal size={20} className="group-hover:scale-110 transition-transform" />
                    <span>ONLINE / UPI</span>
                  </div>
                  <RefreshCw size={16} className="opacity-50" />
                </button>

                <button
                  onClick={() => setPendingMiniSettle(null)}
                  className="mt-2 w-full h-12 text-sm font-bold text-slate-500 hover:text-slate-300 transition-all"
                >
                  Cancel & Rollback
                </button>
             </div>
          </div>
        </div>
      )}
      {localToast && (
        <div 
          className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300"
          style={{ 
            background:
              localToast.type === 'error'
                ? 'rgba(239, 68, 68, 0.9)'
                : localToast.type === 'info'
                  ? 'rgba(37, 99, 235, 0.9)'
                  : 'rgba(16, 185, 129, 0.9)',
            borderColor: 'rgba(255,255,255,0.1)'
          }}
        >
          <p className="text-white font-bold text-sm">{localToast.message}</p>
        </div>
      )}
      <div className="mb-4 flex flex-col gap-3 lg:mb-6">
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-2"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${connectionTone.className}`}>
              <Signal size={12} />
              {connectionTone.label}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--text-3)' }}>
              {overviewTimestamp}
            </span>
            {busyMode && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-black text-rose-600">
                <Zap size={12} /> Busy Mode
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={refreshOperationalData}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
            >
              <RefreshCw size={12} /> Sync
            </button>
            {canToggleBusyMode && (
              <button
                onClick={() => setBusyMode(!busyMode)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${busyMode ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : ''}`}
                style={busyMode ? undefined : { background: 'var(--surface-3)', color: 'var(--text-2)' }}
              >
                <Zap size={14} /> {busyMode ? 'Busy ON' : 'Busy Mode'}
              </button>
            )}
            {canBulkClose && (
              <button
                onClick={() => {
                  if (readyOrders.length === 0) return;
                  if (confirm('Mark every READY order as served?')) {
                    readyOrders.forEach((order: any) => statusMutation.mutate({ id: order.id, status: 'SERVED' }));
                  }
                }}
                disabled={readyOrders.length === 0}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all disabled:opacity-40"
                style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
              >
                <XCircle size={14} /> Serve Ready
              </button>
            )}
          </div>
        </div>
        <div
          className="flex w-full max-w-full overflow-x-auto rounded-xl p-1.5 sm:p-2"
          style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
        >
          <button
            onClick={() => setActiveTab('PIPELINE')}
            className="px-4 py-2 rounded-lg text-sm font-bold transition-all focus-visible:outline-none sm:px-6"
            style={activeTab === 'PIPELINE' ? { background: 'var(--card-bg)', color: 'var(--brand)', boxShadow: 'var(--card-shadow)' } : { color: 'var(--text-3)' }}
          >
            Order Pipeline
          </button>
          {canViewSessions && (
            <button
              onClick={() => setActiveTab('SESSIONS')}
              className="px-4 py-2 rounded-lg text-sm font-bold transition-all focus-visible:outline-none sm:px-6"
              style={activeTab === 'SESSIONS' ? { background: 'var(--card-bg)', color: 'var(--brand)', boxShadow: 'var(--card-shadow)' } : { color: 'var(--text-3)' }}
            >
              Table Sessions
            </button>
          )}
          {canViewHistory && (
            <button
              onClick={() => setActiveTab('HISTORY')}
              className="px-4 py-2 rounded-lg text-sm font-bold transition-all focus-visible:outline-none sm:px-6"
              style={activeTab === 'HISTORY' ? { background: 'var(--card-bg)', color: 'var(--brand)', boxShadow: 'var(--card-shadow)' } : { color: 'var(--text-3)' }}
            >
              Order History
            </button>
          )}
        </div>
      </div>

      {activeTab === 'PIPELINE' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {(isOffline || isLiveOrdersError) && (
            <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-3xl m-4">
               <div className="bg-red-500/20 border border-red-500 text-red-50 font-bold px-8 py-6 rounded-[2rem] flex items-center gap-4 shadow-2xl animate-in zoom-in-95 duration-300">
                 <Signal size={32} className="text-red-400 animate-pulse" />
                 <div>
                   <p className="text-xl font-black tracking-tight">{isOffline ? 'No Internet Connection' : 'Database Connection Lost'}</p>
                   <p className="text-sm text-red-200 mt-1 opacity-80 font-bold">
                     {isOffline 
                       ? 'Please check your router or cellular data.' 
                       : 'Restoflow is currently unable to reach the database. Retrying...'}
                   </p>
                 </div>
               </div>
            </div>
          )}
          <div
            className={`flex flex-1 flex-col gap-4 overflow-y-auto custom-scrollbar p-3 sm:p-4 lg:h-full lg:flex-row lg:gap-6 lg:overflow-x-auto lg:overflow-y-hidden lg:p-6 relative ${(isOffline || isLiveOrdersError) ? 'opacity-40 pointer-events-none' : ''}`}
            style={{ background: 'var(--kanban-bg)' }}
          >
            {pipelineColumns.map(({ id, label, color, bg, badge, filter, pulse }) => {
              const colOrders = sortedLiveOrders.filter(filter);
              return (
                <KanbanColumn 
                  key={id} 
                  id={id} 
                  label={label} 
                  color={color} 
                  bg={bg} 
                  badge={{ count: colOrders.length, className: badge }}
                  pulse={pulse}
                  isActive={activeTab === 'PIPELINE'}
                >
                  {colOrders.map((order: any) => (
                    <PipelineCard
                      key={order.id}
                      order={order}
                      hasKDS={features.hasKDS}
                      canSetKitchenStages={canSetKitchenStages}
                      canSetServiceStages={canSetServiceStages}
                      canCloseSession={canCloseSession}
                      isStatusPending={statusMutation.isPending && statusMutation.variables?.id === order.id}
                      onUpdateStatus={handleUpdateStatus}
                      onFinishSession={handleFinishSession}
                      onCompleteSession={handleCompleteSession}
                      isCompletePending={completeSessionMutation.isPending && completeSessionMutation.variables?.sessionId === order.diningSessionId}
                      plan={plan}
                    />
                  ))}
                  {colOrders.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center px-4 opacity-40">
                      <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">No orders</p>
                    </div>
                  )}
                </KanbanColumn>
              );
            })}
          </div>
          
          <DragOverlay dropAnimation={{
            sideEffects: defaultDropAnimationSideEffects({
              styles: {
                active: {
                  opacity: '0.5',
                },
              },
            }),
          }}>
            {activeDragOrder ? (
              <div className="w-[300px] pointer-events-none opacity-90 scale-105 rotate-2">
                <PipelineCard
                  order={activeDragOrder}
                  hasKDS={features.hasKDS}
                  canSetKitchenStages={false}
                  canSetServiceStages={false}
                  canCloseSession={false}
                  isStatusPending={false}
                  onUpdateStatus={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : activeTab === 'SESSIONS' ? (
        <div
          className="flex-1 overflow-y-auto custom-scrollbar p-3 rounded-3xl sm:p-4 lg:p-6"
          style={{ background: 'var(--kanban-bg)', border: '1px solid var(--border)' }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6 items-start">
            {groupedLive.map((ticket: any) => (
              <TicketCard 
                key={ticket.id} 
                ticket={ticket}
                canCloseSession={canCloseSession}
                selectedBillAction={ticket.sessionId ? billSelections[ticket.sessionId] || 'AWAITING_BILL' : 'AWAITING_BILL'}
                onSelectBillAction={handleSelectBillAction}
                finishPending={finishSessionMutation.isPending && finishSessionMutation.variables?.sessionId === ticket.sessionId}
                paymentPending={completeSessionMutation.isPending && completeSessionMutation.variables?.sessionId === ticket.sessionId}
                onFinishSession={handleFinishSession}
                onCompleteSession={handleCompleteSession}
                onViewInvoice={(t) => {
                  const sessionBill = t.session?.bill || t.diningSession?.bill;
                  setSelectedInvoice({
                    ...t,
                    items: (t.orders || []).flatMap((o: any) => o.items || []),
                    diningSession: { bill: sessionBill }
                  });
                }}
              />
            ))}
            {groupedLive.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center mt-20">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl font-black text-slate-500">Table</span>
                </div>
                <p className="text-gray-600 font-bold text-lg">No active sessions</p>
                <p className="text-gray-400 text-sm mt-1">Start by scanning a QR or placing a test order.</p>
                <button
                  onClick={openTestOrder}
                  className="mt-3 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
                >
                  Create Test Order
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto custom-scrollbar p-3 rounded-3xl sm:p-4 lg:p-6"
          style={{ background: 'var(--kanban-bg)', border: '1px solid var(--border)' }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6 items-start">
            {historyTickets.map((ticket: any) => (
              <TicketCard 
                key={`history_${ticket.id}`} 
                ticket={ticket}
                canCloseSession={canCloseSession}
                selectedBillAction={ticket.sessionId ? billSelections[ticket.sessionId] || 'AWAITING_BILL' : 'AWAITING_BILL'}
                onSelectBillAction={handleSelectBillAction}
                finishPending={false}
                paymentPending={false}
                onFinishSession={handleFinishSession}
                onCompleteSession={handleCompleteSession}
                onViewInvoice={(t) => {
                  const sessionBill = t.session?.bill || t.diningSession?.bill;
                  setSelectedInvoice({
                    ...t,
                    items: (t.orders || []).flatMap((o: any) => o.items || []),
                    diningSession: { bill: sessionBill }
                  });
                }}
              />
            ))}
            {historyTickets.length === 0 && (
              <div className="col-span-full text-center mt-20">
                <p className="text-gray-500 font-semibold">No completed orders recorded today</p>
                <p className="text-gray-400 text-sm mt-1">History now resets daily and shows only the current day.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>

      {selectedInvoice && (
        <InvoiceModal
          order={selectedInvoice}
          businessName={businessSettings?.businessName || 'Your Venue'}
          businessPhone={businessSettings?.phone || '-'}
          businessGstin={businessSettings?.gstin || '-'}
          taxRate={Number(businessSettings?.taxRate || 5)}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </>
  );
}
