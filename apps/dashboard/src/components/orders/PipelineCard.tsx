import { memo, useMemo } from 'react';
import {
  CheckCircle,
  ChevronDown,
  Clock3,
  IndianRupee,
  ReceiptText,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatINR } from '../../lib/currency';
import {
  formatElapsedLabel,
  getCompactOrderToken,
  getMiniPrimaryActionLabel,
  getPaymentIndicatorTone,
  getTableLabel,
  isMiniAwaitingOnlinePayment,
  isMiniAwaitingVerification,
  isMiniTokenFlowPlan,
  normalizeSessionPaymentMethod,
  resolveOrderWorkflowStatus,
  resolveTicketTotal,
  SessionPaymentMethod,
  toValidTimestamp,
} from '../../lib/orders-live-board';

type SessionActionOptions = {
  shouldClose?: boolean;
  ensureBillFirst?: boolean;
  force?: boolean;
};

type PipelineCardProps = {
  order: any;
  displayIdentity?: string;
  orderSummary?: string;
  expanded?: boolean;
  hasKDS: boolean;
  canSetKitchenStages: boolean;
  canSetServiceStages: boolean;
  canCloseSession: boolean;
  isStatusPending: boolean;
  onUpdateStatus: (id: string, status: string, cancelReason?: string) => void;
  onFinishSession?: (sessionId: string, force?: boolean) => void;
  onCompleteSession?: (
    sessionId: string,
    paymentMethod: SessionPaymentMethod,
    options?: SessionActionOptions,
  ) => void;
  isCompletePending?: boolean;
  plan?: string;
  onToggleExpanded?: (id: string) => void;
  onOpenSettlementModal?: (payload: {
    sessionId: string;
    tableLabel: string;
    totalAmount: number;
    sessionStatus: string;
    paymentMethod: SessionPaymentMethod;
  }) => void;
};

function getTopStripeClass(status: string) {
  if (status === 'NEW' || status === 'ACCEPTED') return 'bg-blue-500';
  if (status === 'PREPARING') return 'bg-amber-500';
  if (status === 'READY') return 'bg-emerald-500';
  return 'bg-slate-600';
}

function getStageBadge(status: string) {
  if (status === 'NEW' || status === 'ACCEPTED') {
    return {
      label: status === 'ACCEPTED' ? 'Accepted' : 'New',
      cls: 'border-blue-500/30 bg-blue-500/15 text-blue-300',
    };
  }
  if (status === 'PREPARING') {
    return {
      label: 'Preparing',
      cls: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
    };
  }
  if (status === 'READY') {
    return {
      label: 'Ready',
      cls: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
    };
  }
  if (status === 'SERVED') {
    return {
      label: 'Served',
      cls: 'border-slate-500/30 bg-slate-500/15 text-slate-300',
    };
  }
  return {
    label: 'Live',
    cls: 'border-slate-500/30 bg-slate-500/15 text-slate-300',
  };
}

export const PipelineCard = memo(function PipelineCard({
  order,
  displayIdentity,
  orderSummary,
  expanded = false,
  hasKDS,
  canSetKitchenStages,
  canSetServiceStages,
  canCloseSession,
  isStatusPending,
  onUpdateStatus,
  onFinishSession,
  onCompleteSession,
  isCompletePending,
  plan,
  onToggleExpanded,
  onOpenSettlementModal,
}: PipelineCardProps) {
  const actionableOrderId = String(order?.sourceOrderId || order?.actionOrderId || order?.id || '');
  const currentStatus = resolveOrderWorkflowStatus(order);
  const createdAtMs = toValidTimestamp(order?.createdAt) || toValidTimestamp(order?.updatedAt);
  const elapsedMinutes = createdAtMs > 0 ? Math.max(0, Math.floor((Date.now() - createdAtMs) / 60000)) : 0;
  const isUrgent = elapsedMinutes >= 15 && ['NEW', 'ACCEPTED', 'PREPARING'].includes(currentStatus);
  const isSessionOrder = Boolean(order?.diningSessionId);
  const isMiniTokenFlow = isMiniTokenFlowPlan(plan);
  const sessionStatus = String(order?.diningSession?.sessionStatus || '').toUpperCase();
  const sessionPaymentStatus = String(order?.diningSession?.bill?.paymentStatus || '').toUpperCase();
  const isPaid = sessionPaymentStatus === 'PAID';
  const sessionPaymentMethod = normalizeSessionPaymentMethod(order?.diningSession?.bill?.paymentMethod);
  const miniAwaitingVerification = isMiniAwaitingVerification(order);
  const miniAwaitingOnline = isMiniAwaitingOnlinePayment(order);
  const miniActionLabel = getMiniPrimaryActionLabel(order);
  const safeItems = Array.isArray(order?.items) ? order.items : [];
  const itemCount = safeItems.reduce((sum: number, item: any) => sum + Number(item?.quantity || 0), 0);
  const paymentTone = getPaymentIndicatorTone(order);
  const tokenLabel = getCompactOrderToken(order?.orderNumber, order?.id);
  const stageBadge = getStageBadge(currentStatus);
  const totalAmount = Number(order?.totalAmount || 0);

  const rawIdentity = String(displayIdentity || `Guest#${tokenLabel}`).trim();
  const namePart = rawIdentity.includes('#') ? rawIdentity.split('#')[0].replace(/^\d+-/, '') : rawIdentity;
  const compactIdentity = `${namePart || 'Guest'}#${tokenLabel}`;

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
  const canManageSettlementDesk =
    canCloseSession && isSessionOrder && (canMoveSessionToBilling || canArchiveSession);
  const settlementTableLabel = getTableLabel(order);

  const displayItems = useMemo(() => {
    if (safeItems.length > 0) {
      return safeItems
        .slice(0, 12)
        .map((item: any) => ({
          name: String(item?.menuItem?.name || item?.name || '').trim(),
          qty: Number(item?.quantity || 1),
          notes: String(item?.notes || '').trim(),
        }))
        .filter((item: { name: string; qty: number; notes: string }) => item.name);
    }

    return String(orderSummary || '')
      .split(',')
      .map((value) => ({ name: value.trim(), qty: 1, notes: '' }))
      .filter((item) => item.name)
      .slice(0, 12);
  }, [orderSummary, safeItems]);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      style={{
        background: 'var(--card-bg)',
        border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.45)' : 'var(--card-border)'}`,
        boxShadow: isUrgent
          ? '0 0 0 2px rgba(239,68,68,0.18), var(--card-shadow)'
          : 'var(--card-shadow)',
      }}
      className="relative overflow-hidden rounded-[1.35rem] transition-all duration-300"
    >
      <div className={`h-1 w-full ${getTopStripeClass(currentStatus)}`} />

      <button
        type="button"
        onClick={() => onToggleExpanded?.(String(order?.id || actionableOrderId))}
        className="flex w-full items-center gap-3 px-4 py-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="min-w-0 truncate text-[18px] font-black uppercase tracking-tight text-white" title={compactIdentity}>
              {compactIdentity}
            </span>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-black ${
                isUrgent
                  ? 'border-red-500/30 bg-red-500/10 text-red-300'
                  : 'border-white/10 bg-white/[0.03] text-slate-300'
              }`}
            >
              <Clock3 size={13} className={isUrgent ? 'text-red-400' : 'text-slate-500'} />
              {formatElapsedLabel(elapsedMinutes)}
            </span>
          </div>
        </div>

        <motion.span
          animate={{ rotate: expanded ? 180 : 0, scale: expanded ? 1.04 : 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
        >
          <ChevronDown size={15} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="min-h-0 overflow-hidden border-t border-white/5">
              <div className="flex max-h-[min(60vh,36rem)] flex-col">
                <motion.div
                  layout
                  className="custom-scrollbar flex-1 overflow-y-auto px-4 py-4"
                >
                  <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${stageBadge.cls}`}
                    >
                      {stageBadge.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${paymentTone.dotClassName}`} />
                      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                        Payment {paymentTone.label}
                      </span>
                    </div>
                  </div>

                  <motion.section
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04, duration: 0.2 }}
                    className="rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3"
                  >
                    {displayItems.length > 0 ? (
                      <ul className="space-y-2">
                        {displayItems.map((item: { name: string; qty: number; notes: string }, idx: number) => (
                          <li key={`${item.name}-${idx}`} className="flex items-start gap-2.5">
                            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                            <span className="text-[13px] font-semibold leading-5 text-slate-100">
                              {item.qty > 1 ? <span className="font-black text-blue-400">{item.qty}x </span> : null}
                              {item.name}
                              {item.notes ? <span className="ml-1 text-[11px] text-slate-500">- {item.notes}</span> : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] font-semibold text-slate-500">No items</p>
                    )}
                  </motion.section>

                  <motion.section
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.07, duration: 0.2 }}
                    className="grid grid-cols-2 gap-3 rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3"
                  >
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Total</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <IndianRupee size={14} className="text-slate-500" />
                        <span className="text-[14px] font-black text-slate-100">{formatINR(totalAmount)}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Items</p>
                      <p className="mt-1 text-[14px] font-black text-slate-100">
                        {itemCount} item{itemCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Placed</p>
                      <p className="mt-1 text-[13px] font-bold text-slate-300">
                        {new Date(order?.createdAt || Date.now()).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </motion.section>

                  {isMiniTokenFlow && isSessionOrder && !isPaid && (
                    <motion.section
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.2 }}
                      className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-3"
                    >
                      <p className="mb-1 text-[9px] font-black uppercase tracking-[0.14em] text-amber-400">
                        Payment Gate
                      </p>
                      <p className="text-xs font-semibold leading-snug text-amber-200/80">
                        {miniAwaitingVerification
                          ? 'Vendor verification pending for this token.'
                          : miniAwaitingOnline
                            ? 'Customer is completing UPI. Wait for confirmation before kitchen starts.'
                            : 'Collect payment before kitchen starts.'}
                      </p>
                    </motion.section>
                  )}

                  {order.specialInstructions && (
                    <motion.section
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.12, duration: 0.2 }}
                      className="rounded-xl border border-orange-500/20 bg-orange-500/8 p-3"
                    >
                      <p className="mb-1 text-[9px] font-black uppercase tracking-[0.14em] text-orange-400">
                        Kitchen Note
                      </p>
                      <p className="text-xs font-semibold leading-snug text-orange-200/80">
                        {order.specialInstructions}
                      </p>
                    </motion.section>
                  )}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08, duration: 0.22 }}
                  className="border-t border-white/5 bg-slate-950/85 px-4 py-4 backdrop-blur"
                >
                  <div className="space-y-2">
                  {currentStatus === 'NEW' && canSetKitchenStages && (
                    <div className="grid grid-cols-5 gap-2">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={(event) => {
                          event.stopPropagation();
                          onUpdateStatus(actionableOrderId, 'PREPARING');
                        }}
                        disabled={isStatusPending || (isMiniTokenFlow && isSessionOrder && miniAwaitingOnline)}
                        className="col-span-3 rounded-[1rem] bg-blue-600 py-3.5 text-[13px] font-black text-white transition-all hover:bg-blue-500 active:scale-[0.97] disabled:opacity-50"
                      >
                        {isMiniTokenFlow && isSessionOrder && !isPaid ? miniActionLabel : 'Accept'}
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={(event) => {
                          event.stopPropagation();
                          onUpdateStatus(actionableOrderId, 'CANCELLED', 'Rejected');
                        }}
                        disabled={isStatusPending}
                        className="col-span-2 rounded-[1rem] border border-red-500/30 py-3.5 text-[13px] font-bold text-red-400 transition-all hover:bg-red-500/10 active:scale-[0.97]"
                      >
                        Reject
                      </motion.button>
                    </div>
                  )}

                  {currentStatus === 'ACCEPTED' && canSetKitchenStages && (
                    <motion.button
                      whileTap={{ scale: 0.985 }}
                      onClick={(event) => {
                        event.stopPropagation();
                        onUpdateStatus(actionableOrderId, 'PREPARING');
                      }}
                      disabled={isStatusPending}
                      className="w-full rounded-[1rem] bg-amber-500 py-3.5 text-[13px] font-black text-white transition-all hover:bg-amber-400 active:scale-[0.97]"
                    >
                      {hasKDS ? 'Start Preparing' : 'Start Prep'}
                    </motion.button>
                  )}

                  {currentStatus === 'PREPARING' && canSetKitchenStages && (
                    <motion.button
                      whileTap={{ scale: 0.985 }}
                      whileHover={{ y: -1 }}
                      onClick={(event) => {
                        event.stopPropagation();
                        onUpdateStatus(actionableOrderId, 'READY');
                      }}
                      disabled={isStatusPending}
                      className="w-full rounded-[1rem] bg-emerald-600 py-4 text-[14px] font-black text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-500 active:scale-[0.97]"
                    >
                      Mark Ready
                    </motion.button>
                  )}

                  {currentStatus === 'READY' && canSetServiceStages && (
                    <motion.button
                      whileTap={{ scale: 0.985 }}
                      whileHover={{ y: -1 }}
                      onClick={(event) => {
                        event.stopPropagation();
                        onUpdateStatus(actionableOrderId, 'SERVED');
                      }}
                      disabled={isStatusPending}
                      className="w-full rounded-[1rem] bg-emerald-600 py-4 text-[14px] font-black text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-500 active:scale-[0.97]"
                    >
                      {isMiniTokenFlow ? 'Handed to Guest' : 'Mark Served'}
                    </motion.button>
                  )}

                  {currentStatus === 'SERVED' && !isSessionOrder && (
                    <motion.button
                      whileTap={{ scale: 0.985 }}
                      onClick={(event) => {
                        event.stopPropagation();
                        onUpdateStatus(actionableOrderId, 'RECEIVED');
                      }}
                      disabled={isStatusPending}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-700 py-3 text-xs font-black text-white transition-all hover:bg-slate-600 active:scale-[0.97]"
                    >
                      <CheckCircle size={14} />
                      Complete Pickup
                    </motion.button>
                  )}

                  {currentStatus === 'SERVED' &&
                    isSessionOrder &&
                    canManageSettlementDesk &&
                    onOpenSettlementModal &&
                    plan !== 'MINI' && (
                      <motion.button
                        whileTap={{ scale: 0.985 }}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!order.diningSessionId) return;
                          onOpenSettlementModal({
                            sessionId: order.diningSessionId,
                            tableLabel: settlementTableLabel,
                            totalAmount: resolveTicketTotal([order], order?.diningSession),
                            sessionStatus,
                            paymentMethod: sessionPaymentMethod,
                          });
                        }}
                        disabled={isStatusPending || isCompletePending}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 text-xs font-black text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-400 active:scale-[0.97]"
                      >
                        <ReceiptText size={14} />
                        {sessionStatus === 'AWAITING_BILL' ? 'Payment Desk' : 'Billing and Payment'}
                      </motion.button>
                    )}

                  {currentStatus === 'SERVED' &&
                    isSessionOrder &&
                    canMoveSessionToBilling &&
                    onFinishSession &&
                    plan === 'MINI' &&
                    !isPaid && (
                      <motion.button
                        whileTap={{ scale: 0.985 }}
                        onClick={(event) => {
                          event.stopPropagation();
                          onUpdateStatus(actionableOrderId, 'COMPLETE_SETTLE');
                        }}
                        disabled={isStatusPending || isCompletePending}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 text-xs font-black text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-400 active:scale-[0.97]"
                      >
                        <ReceiptText size={14} />
                        Record Payment First
                      </motion.button>
                    )}

                  {currentStatus === 'SERVED' &&
                    isSessionOrder &&
                    canArchiveSession &&
                    onCompleteSession &&
                    plan === 'MINI' && (
                      <motion.button
                        whileTap={{ scale: 0.985 }}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!order.diningSessionId) return;
                          if (sessionPaymentStatus !== 'PAID') {
                            onUpdateStatus(actionableOrderId, 'COMPLETE_SETTLE');
                            return;
                          }
                          onCompleteSession(order.diningSessionId, sessionPaymentMethod, {
                            shouldClose: true,
                            ensureBillFirst:
                              sessionStatus !== 'AWAITING_BILL' && sessionPaymentStatus !== 'PAID',
                          });
                        }}
                        disabled={isStatusPending || isCompletePending}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-xs font-black text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-500 active:scale-[0.97]"
                      >
                        <CheckCircle size={14} />
                        {sessionPaymentStatus === 'PAID' ? 'Complete Token' : 'Record Payment and Complete'}
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
});
