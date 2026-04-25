import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Minus, Plus, Trash2, ChevronDown, Phone, Receipt, Clock, Sparkles, Link, UserRound, Notebook
} from 'lucide-react';
import { AssistedLineItem, POS_ANIMATIONS } from './POSCore';
import { formatINR } from '../../lib/currency';

interface CartPanelProps {
  items: AssistedLineItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  subtotal: number;
  tax: number;
  total: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  guestContext: any;
  onUpdateContext: (ctx: any) => void;
  linkedSessionSummary?: {
    label: string;
    guestName: string;
    phone: string;
  } | null;
  activeSessions?: Array<{
    key: string;
    sessionId: string | null;
    tokenLabel: string;
    guestName: string;
    guestPhone: string;
    itemCount: number;
    totalAmount: number;
    status: string;
    updatedAt: string;
  }>;
  linkedSessionKey?: string | null;
  onSelectSession?: (session: {
    key: string;
    sessionId: string | null;
    tokenLabel: string;
    guestName: string;
    guestPhone: string;
    itemCount: number;
    totalAmount: number;
    status: string;
    updatedAt: string;
  }) => void;
  onCollectBill?: (sessionId: string) => void;
  billingSessionId?: string | null;
  onClearLinkedSession?: () => void;
  submitBlockedReason?: string;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export const CartPanel = memo(({
  items,
  onUpdateQuantity,
  onRemove,
  subtotal,
  tax,
  total,
  isExpanded,
  onToggleExpand,
  guestContext,
  onUpdateContext,
  linkedSessionSummary = null,
  activeSessions = [],
  linkedSessionKey = null,
  onSelectSession,
  onCollectBill,
  billingSessionId = null,
  onClearLinkedSession,
  submitBlockedReason = '',
  onSubmit,
  isSubmitting,
}: CartPanelProps) => {
  const isSubmitDisabled = items.length === 0 || isSubmitting || Boolean(submitBlockedReason);

  return (
    <aside className="relative z-40 flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-white/5 bg-slate-900 shadow-3xl 2xl:w-[420px] 2xl:border-l 2xl:border-t-0 2xl:bg-slate-900/50 2xl:backdrop-blur-xl">
      {activeSessions.length > 0 && (
        <div className="border-b border-white/5 bg-slate-950/55 px-5 py-4 backdrop-blur-3xl lg:px-7">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.26em] text-blue-500/80">Live Assisted Orders</p>
              <p className="mt-1 text-[11px] font-bold text-slate-500">Tap a token to keep adding items into the same order.</p>
            </div>
            <span className="rounded-xl border border-white/5 bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
              {activeSessions.length}
            </span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1 custom-scrollbar">
            {activeSessions.map((session) => {
              const isLinked = linkedSessionKey === session.key;
              const isBilling = billingSessionId === session.sessionId;

              return (
                <div
                  key={session.key}
                  className={`min-w-[220px] rounded-[1.5rem] border p-4 transition-all ${
                    isLinked
                      ? 'border-blue-400 bg-blue-600 shadow-xl shadow-blue-900/30'
                      : 'border-white/6 bg-slate-950/75 hover:border-white/12'
                  }`}
                >
                  <button type="button" onClick={() => onSelectSession?.(session)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`truncate text-[15px] font-black tracking-tight ${isLinked ? 'text-white' : 'text-slate-100'}`}>
                          {session.tokenLabel}
                        </p>
                        <p className={`mt-1 truncate text-[12px] font-bold ${isLinked ? 'text-blue-100' : 'text-slate-400'}`}>
                          {session.guestName}
                        </p>
                      </div>
                      <span className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] ${
                        session.status === 'READY'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : session.status === 'PREPARING'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {session.status}
                      </span>
                    </div>

                    <div className={`mt-3 flex items-center justify-between text-[11px] font-black ${isLinked ? 'text-white' : 'text-slate-500'}`}>
                      <span>{session.itemCount} items</span>
                      <span className="tabular-nums">{formatINR(session.totalAmount)}</span>
                    </div>
                  </button>

                  {session.sessionId && onCollectBill && (
                    <button
                      type="button"
                      onClick={() => onCollectBill(session.sessionId!)}
                      className={`mt-3 h-9 w-full rounded-xl border text-[10px] font-black uppercase tracking-[0.14em] transition-all ${
                        isLinked
                          ? 'border-white/15 bg-white text-blue-600 hover:bg-blue-50'
                          : 'border-white/6 bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {isBilling ? 'Processing...' : 'Generate Bill'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Header / Guest Context ── */}
      <div className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/40 p-5 backdrop-blur-3xl lg:p-7">
        <div
          className="flex items-center justify-between cursor-pointer group"
          onClick={onToggleExpand}
        >
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-500/80 group-hover:text-blue-400 transition-colors">
              Operational Context
            </span>
            <div className="flex items-center gap-2">
              <h2 className="max-w-[170px] truncate text-lg font-black text-white tracking-tight">
                {guestContext.customerName || 'Walk-in Guest'}
              </h2>
              {linkedSessionSummary && (
                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2.5 py-0.5 shadow-lg shadow-blue-900/20">
                  <Link size={10} />
                  {linkedSessionSummary.label}
                </span>
              )}
            </div>
          </div>

          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0, scale: isExpanded ? 1.05 : 1 }}
            className={`flex h-10 w-10 items-center justify-center rounded-2xl transition-all shadow-lg ${isExpanded ? 'bg-blue-600 text-white shadow-blue-900/40' : 'bg-slate-800 text-slate-500 group-hover:text-white group-hover:bg-slate-700'
              }`}
          >
            <ChevronDown size={20} />
          </motion.div>
        </div>

        {/* Expandable guest form */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-6 grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel icon={<UserRound size={11} />}>Guest Identification</FieldLabel>
                  <input
                    placeholder="Enter guest name..."
                    value={guestContext.customerName}
                    onChange={(e) => onUpdateContext({ ...guestContext, customerName: e.target.value })}
                    className="w-full h-11 rounded-2xl border border-white/5 bg-slate-950/60 px-4 text-sm font-black text-white outline-none focus:border-blue-500/40 focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-700"
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel icon={<Phone size={11} />}>Communication Channel</FieldLabel>
                  <input
                    placeholder="10-digit mobile number"
                    value={guestContext.customerPhone}
                    onChange={(e) =>
                      onUpdateContext({ ...guestContext, customerPhone: e.target.value })
                    }
                    className="w-full h-11 rounded-2xl border border-white/5 bg-slate-950/60 px-4 text-sm font-black text-white outline-none focus:border-blue-500/40 focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-700"
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel icon={<Notebook size={11} />}>Kitchen Directive</FieldLabel>
                  <input
                    placeholder="Special requests or notes..."
                    value={guestContext.seat}
                    onChange={(e) => onUpdateContext({ ...guestContext, seat: e.target.value })}
                    className="w-full h-11 rounded-2xl border border-white/5 bg-slate-950/60 px-4 text-sm font-black text-white outline-none focus:border-blue-500/40 focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-700"
                  />
                </div>

                {linkedSessionSummary && onClearLinkedSession && (
                  <div className="mt-2 rounded-[1.75rem] border border-blue-500/20 bg-blue-500/5 p-4 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-[11px] font-black text-white leading-none">Adding to {linkedSessionSummary.label}</p>
                      <p className="text-[10px] font-bold text-blue-400 opacity-60">{linkedSessionSummary.phone}</p>
                    </div>
                    <button
                      type="button"
                      onClick={onClearLinkedSession}
                      className="h-8 px-4 rounded-xl border border-white/10 bg-slate-950/80 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-900 transition-all shadow-lg"
                    >
                      Unlink
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Cart Items ── */}
      <div className="flex-1 overflow-y-auto p-5 lg:p-7 space-y-4 custom-scrollbar">
        <AnimatePresence mode="popLayout" initial={false}>
          {items.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-20 gap-6 text-slate-800"
            >
              <div className="relative w-24 h-24 rounded-[2.5rem] bg-slate-950/40 border-2 border-white/5 flex items-center justify-center rotate-12 group">
                <ShoppingBag size={40} className="text-white opacity-5 -rotate-12 group-hover:scale-110 transition-transform" />
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.5, 0.2] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute inset-0 bg-blue-500/5 rounded-full blur-2xl"
                />
              </div>
              <div className="text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-600">Cart Empty</p>
                <p className="text-[9px] font-bold uppercase text-slate-800 tracking-widest mt-2">No items staged for order</p>
              </div>
            </motion.div>
          ) : (
            <motion.div layout className="space-y-3">
              <div className="flex items-center justify-between px-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500">
                    Staged Items
                  </p>
                </div>
                <span className="text-[11px] font-black text-slate-600 tabular-nums">
                  {items.length} Units
                </span>
              </div>

              {items.map((item, idx) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300, delay: idx * 0.04 }}
                  className="group relative p-4 rounded-[1.75rem] border border-white/5 bg-slate-950/40 hover:bg-slate-950/60 transition-colors shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-start gap-2">
                        <h5 className="truncate text-[15px] font-black text-white group-hover:text-blue-400 transition-colors">{item.name}</h5>
                        <span className="shrink-0 text-[15px] font-black text-white tabular-nums tracking-tight">
                          {formatINR(item.lineTotal)}
                        </span>
                      </div>

                      {item.selectedModifiers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {item.selectedModifiers.map((m) => (
                            <span key={m.id} className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-[9px] font-black text-slate-500 uppercase tracking-wider">
                              {m.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {item.notes && (
                        <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-900/60 p-2 border border-white/5">
                          <Notebook size={11} className="text-blue-500/50 mt-0.5 shrink-0" />
                          <p className="text-[10px] font-medium italic text-slate-400 line-clamp-2 leading-relaxed">
                            {item.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/5 pt-4">
                    <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-slate-950 p-1">
                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-rose-400 transition-colors"
                      >
                        <Minus size={14} />
                      </motion.button>
                      <span className="w-8 text-center text-[14px] font-black text-white tabular-nums">
                        {item.quantity}
                      </span>
                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 transition-colors"
                      >
                        <Plus size={14} />
                      </motion.button>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onRemove(item.id)}
                      className="h-8 px-4 flex items-center gap-2 rounded-xl bg-slate-900 border border-white/5 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-rose-400 hover:border-rose-500/20 transition-all"
                    >
                      <Trash2 size={13} />
                      Discard
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bill Surface ── */}
      <div className="z-30 border-t border-white/5 bg-slate-950/80 p-6 lg:p-8 backdrop-blur-3xl space-y-6 shadow-[0_-12px_40px_rgba(0,0,0,0.4)]">
        {/* Totals Grid */}
        <div className="grid grid-cols-2 gap-y-3">
          <TotalRow label="Operational Base" value={formatINR(subtotal)} />
          <TotalRow label="Taxes & Levies" value={formatINR(tax)} align="right" />

          <div className="col-span-2 pt-4 border-t border-white/5 flex items-end justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600">Total Payable</p>
              <motion.div
                key={total}
                initial={{ opacity: 0.5, y: 10, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                className="text-4xl font-black tabular-nums text-white tracking-tighter"
              >
                {formatINR(total)}
              </motion.div>
            </div>
            <div className="pb-1">
              <div className="p-2.5 rounded-2xl bg-blue-600/10 border border-blue-500/20 shadow-xl shadow-blue-900/10">
                <Sparkles size={20} className="text-blue-500 group-hover:scale-110 transition-transform" />
              </div>
            </div>
          </div>
        </div>

        {/* Primary Operational Action */}
        <motion.button
          whileHover={{ scale: !isSubmitDisabled ? 1.01 : 1 }}
          whileTap={{ scale: !isSubmitDisabled ? 0.98 : 1 }}
          onClick={onSubmit}
          disabled={isSubmitDisabled}
          className={`relative flex h-14 w-full items-center justify-center gap-4 overflow-hidden rounded-3xl shadow-2xl transition-all ${!isSubmitDisabled
            ? 'bg-blue-600 text-white shadow-blue-900/40 hover:bg-blue-500'
            : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-white/5'
            }`}
        >
          {isSubmitting ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            >
              <Clock size={20} />
            </motion.div>
          ) : (
            <div className="flex items-center gap-3">
              <Receipt size={18} />
              <span className="text-[13px] font-black uppercase tracking-[0.2em]">
                {submitBlockedReason ? submitBlockedReason : (linkedSessionSummary ? 'Attach to Session' : 'Generate Token')}
              </span>
            </div>
          )}

          <AnimatePresence>
            {!isSubmitDisabled && !isSubmitting && (
              <motion.div
                {...POS_ANIMATIONS.SHIMMER}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"
              />
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </aside>
  );
});

CartPanel.displayName = 'CartPanel';

// ── Helpers ──
function FieldLabel({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 pl-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
      <span className="text-blue-500/50">{icon}</span>
      {children}
    </label>
  );
}

function TotalRow({ label, value, align = 'left' }: { label: string; value: string; align?: 'left' | 'right' }) {
  return (
    <div className={`flex flex-col ${align === 'right' ? 'items-end' : 'items-start'}`}>
      <span className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-600 mb-0.5">
        {label}
      </span>
      <span className="text-sm font-bold text-slate-300 tabular-nums tracking-wide">{value}</span>
    </div>
  );
}
