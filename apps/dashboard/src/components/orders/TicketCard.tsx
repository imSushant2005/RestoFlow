import { memo, useEffect, useState } from 'react';
import { CheckCircle, ChevronRight, Clock, FileText, ReceiptText, ShoppingBag, Trash2, UtensilsCrossed, Tag } from 'lucide-react';
import { formatINR } from '../../lib/currency';
import {
  SessionPaymentMethod,
  formatElapsedLabel,
  resolveTicketTotal,
  normalizeSessionPaymentMethod,
  toValidTimestamp,
  getTableLabel,
  asOrderCode,
  formatTimeValue,
  getStatusChipClass,
} from '../../lib/orders-live-board';

type SessionActionOptions = {
  shouldClose?: boolean;
  ensureBillFirst?: boolean;
  force?: boolean;
};

type TicketCardProps = {
  ticket: any;
  plan?: string;
  canCloseSession: boolean;
  selectedBillAction: string;
  onSelectBillAction: (sessionId: string, action: string) => void;
  finishPending: boolean;
  paymentPending: boolean;
  onFinishSession: (sessionId: string, force?: boolean) => void;
  onCompleteSession: (sessionId: string, paymentMethod: SessionPaymentMethod, options?: SessionActionOptions) => void;
  onViewInvoice: (ticket: any) => void;
  onOpenSettlementModal?: (payload: {
    sessionId: string;
    tableLabel: string;
    totalAmount: number;
    sessionStatus: string;
    paymentMethod: SessionPaymentMethod;
  }) => void;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export const TicketCard = memo(({
  ticket,
  plan,
  canCloseSession,
  selectedBillAction,
  onSelectBillAction,
  finishPending,
  paymentPending,
  onFinishSession,
  onCompleteSession,
  onViewInvoice,
  onOpenSettlementModal,
}: TicketCardProps) => {
  const ticketOrders = Array.isArray(ticket?.orders) ? ticket.orders : [];
  const resolvedTicketTotal = resolveTicketTotal(ticketOrders, ticket?.session);
  const sessionStatus = String(ticket?.session?.sessionStatus || '').toUpperCase();
  const sessionPaymentStatus = String(ticket?.session?.bill?.paymentStatus || '').toUpperCase();
  const normalizedSessionPaymentMethod = normalizeSessionPaymentMethod(ticket?.session?.bill?.paymentMethod);
  const isCancelled = ticketOrders.length > 0 && ticketOrders.every((o: any) => o?.status === 'CANCELLED');
  const isClosedSession = ticket.isSession && sessionStatus === 'CLOSED';
  const createdAtMs = toValidTimestamp(ticket?.createdAt);
  const elapsedMin = createdAtMs > 0 ? Math.max(0, Math.floor((Date.now() - createdAtMs) / 60000)) : 0;
  const activeBatches = ticketOrders.filter((order: any) => order?.status !== 'CANCELLED');
  const outstandingBatches = activeBatches.filter(
    (order: any) => !['SERVED', 'RECEIVED'].includes(String(order?.status || '').toUpperCase()),
  );

  const canCapturePayment = ticket.isSession && canCloseSession && ticket.sessionId && sessionStatus === 'AWAITING_BILL';
  const canMoveSessionToBilling =
    ticket.isSession && canCloseSession && ticket.sessionId &&
    sessionStatus !== 'AWAITING_BILL' && sessionStatus !== 'CLOSED' && sessionStatus !== 'CANCELLED';
  const canArchiveSession =
    ticket.isSession && canCloseSession && ticket.sessionId &&
    (sessionStatus === 'AWAITING_BILL' || sessionPaymentStatus === 'PAID');
  const canManageSettlementDesk =
    plan !== 'MINI' && Boolean(onOpenSettlementModal) && (canMoveSessionToBilling || canArchiveSession);

  const isUrgent = elapsedMin >= 15 && activeBatches.some((o: any) => ['NEW', 'ACCEPTED', 'PREPARING'].includes(String(o.status).toUpperCase()));

  return (
    <div
      className={`relative flex flex-col gap-4 rounded-[1.5rem] p-5 overflow-hidden transition-all duration-300 ${isCancelled ? 'opacity-50' : ''} ${isUrgent ? 'ring-2 ring-red-500/40 shadow-xl shadow-red-500/20' : ''}`}
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}
    >
      {/* Top Stripe */}
      <div className={`absolute left-0 right-0 top-0 h-1 ${isCancelled ? 'bg-red-500/40' : isUrgent ? 'bg-red-500' : 'bg-blue-600'}`} />

      {/* ── Header Row ── */}
      <div className="flex justify-between items-start gap-3">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2">
            {ticket.table?.name ? (
              <UtensilsCrossed size={16} className="text-blue-400 shrink-0" />
            ) : (
              <ShoppingBag size={16} className="text-amber-400 shrink-0" />
            )}
            <h3 className="text-[18px] font-black text-white tracking-tight truncate uppercase">
              {getTableLabel(ticket)}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <span className="flex items-center gap-1">
              <Tag size={10} />
              {ticket.isSession ? 'Tab' : `#${asOrderCode(ticketOrders?.[0]?.id)}`}
            </span>
            <span className="opacity-20">•</span>
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {formatTimeValue(ticket?.createdAt)}
              {elapsedMin > 0 && <TimeElapsedBadge createdAtMs={createdAtMs} isUrgentThreshold={15} />}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-2">
            {ticket.isSession && sessionStatus !== 'CLOSED' && (
              <button
                onClick={() => {
                  if (!ticket.sessionId) return;
                  if (window.confirm('Force clear and archive this session?')) {
                    onCompleteSession(ticket.sessionId, normalizeSessionPaymentMethod(ticket.session?.bill?.paymentMethod), {
                      shouldClose: true, force: true, ensureBillFirst: sessionStatus !== 'AWAITING_BILL' && sessionPaymentStatus !== 'PAID'
                    });
                  }
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
              >
                <Trash2 size={13} />
              </button>
            )}
            <span className="text-[18px] font-black text-blue-500">{formatINR(resolvedTicketTotal || 0)}</span>
          </div>
          {ticket.isSession && sessionStatus && (
            <div className="flex flex-col items-end gap-1 w-full">
              <span
                className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.14em] border shrink-0 ${sessionStatus === 'CLOSED' ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400' :
                  sessionStatus === 'AWAITING_BILL' ? 'border-amber-500/30 bg-amber-500/15 text-amber-400' :
                    'border-white/10 bg-white/5 text-slate-400'
                  }`}
              >
                {sessionStatus.replace(/_/g, ' ')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Invoice Row (if exists) ── */}
      {ticket.session?.bill?.invoiceNumber && (
        <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2">
          <div className="flex items-center gap-2">
            <FileText size={12} className="text-slate-500" />
            <span className="text-[10px] font-black text-slate-400 tracking-wider">#{ticket.session.bill.invoiceNumber}</span>
          </div>
          <button onClick={() => onViewInvoice(ticket)} className="text-[10px] font-black text-blue-400 hover:text-blue-300 transition-colors uppercase">View Bill</button>
        </div>
      )}

      {/* ── Order Batches ── */}
      <div className="space-y-3 mt-1">
        {ticketOrders.map((order: any, idx: number) => (
          <div key={order.id} className="rounded-2xl bg-white/[0.04] border border-white/5 p-3.5">
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Order {idx + 1}</span>
              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${getStatusChipClass(String(order.status || '').toUpperCase())}`}>
                {order.status}
              </span>
            </div>
            <ul className="space-y-2">
              {order.items?.map((item: any, i: number) => (
                <li key={`${item.id}-${i}`} className="flex gap-2.5 items-start">
                  <span className="mt-[2px] inline-flex min-w-[22px] items-center justify-center rounded bg-blue-600 px-1 py-0.5 text-[10px] font-black text-white">{item.quantity}×</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[13px] font-bold text-slate-100 block leading-tight">{item.menuItem?.name || item.name}</span>
                    {item.notes && <span className="text-[10px] font-semibold text-slate-500 mt-1 block italic leading-tight">{item.notes}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* ── Session Actions ── */}
      {ticket.isSession && (
        <div className="mt-2 pt-4 border-t border-white/5 space-y-3">
          {isClosedSession ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 flex items-center gap-3">
              <CheckCircle size={18} className="text-emerald-400" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-emerald-400">Settled & Closed</p>
                <p className="text-[10px] font-bold text-emerald-500/70 mt-0.5">{normalizedSessionPaymentMethod.toUpperCase()} Received</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {outstandingBatches.length > 0 && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-center">
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.12em]">
                    {outstandingBatches.length} PENDING BATCH{outstandingBatches.length > 1 ? 'ES' : ''}
                  </p>
                </div>
              )}

              {canManageSettlementDesk && ticket.sessionId && outstandingBatches.length === 0 && (
                <button
                  onClick={() => onOpenSettlementModal?.({
                    sessionId: ticket.sessionId!,
                    tableLabel: getTableLabel(ticket),
                    totalAmount: resolvedTicketTotal,
                    sessionStatus,
                    paymentMethod: normalizedSessionPaymentMethod,
                  })}
                  disabled={finishPending || paymentPending}
                  className="w-full flex items-center justify-between rounded-[1rem] bg-amber-500 px-5 py-3.5 text-[13px] font-black text-white hover:bg-amber-400 transition-all disabled:opacity-50 shadow-lg shadow-amber-900/20"
                >
                  <span className="flex items-center gap-2.5"><ReceiptText size={16} />{sessionStatus === 'AWAITING_BILL' ? 'Payment Desk' : 'Billing & Payment'}</span>
                  <ChevronRight size={14} className="opacity-70" />
                </button>
              )}

              {plan === 'MINI' && canCloseSession && ticket.sessionId && (
                <div className="flex gap-2">
                  <select
                    value={selectedBillAction}
                    onChange={(e) => onSelectBillAction(ticket.sessionId!, e.target.value)}
                    className="flex-1 rounded-[1rem] bg-slate-900 border border-white/10 px-4 py-3.5 text-xs font-black text-white outline-none focus:border-blue-500/50"
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
                        if (outstandingBatches.length > 0 && !window.confirm(`There are ${outstandingBatches.length} unserved batches. Force bill?`)) return;
                        onFinishSession(ticket.sessionId, outstandingBatches.length > 0 || activeBatches.length === 0);
                      } else {
                        if (!canCapturePayment) { window.alert('Generate final bill first.'); return; }
                        onCompleteSession(ticket.sessionId, selectedBillAction === 'PAID_ONLINE' ? 'online' : 'cash', {
                          shouldClose: true, ensureBillFirst: sessionStatus !== 'AWAITING_BILL' && sessionPaymentStatus !== 'PAID'
                        });
                      }
                    }}
                    disabled={finishPending || paymentPending}
                    className="rounded-[1rem] bg-blue-600 px-5 text-white hover:bg-blue-500 transition-all disabled:opacity-50 shadow-lg shadow-blue-900/20"
                  >
                    <ReceiptText size={18} />
                  </button>
                </div>
              )}

              {plan === 'MINI' && sessionStatus === 'AWAITING_BILL' && (
                <button
                  onClick={() => {
                    if (!ticket.sessionId) return;
                    const paid = ticket.session?.bill?.paymentStatus === 'PAID';
                    if (!paid && !window.confirm('Payment not recorded. Clear anyway?')) return;
                    onCompleteSession(ticket.sessionId, normalizeSessionPaymentMethod(ticket.session?.bill?.paymentMethod), { shouldClose: true, force: !paid });
                  }}
                  disabled={paymentPending}
                  className="w-full flex items-center justify-center gap-2 rounded-[1rem] bg-emerald-600 hover:bg-emerald-500 py-3.5 text-[13px] font-black text-white shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.97]"
                >
                  <CheckCircle size={16} /> Clear Session & Archive
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

TicketCard.displayName = 'TicketCard';
