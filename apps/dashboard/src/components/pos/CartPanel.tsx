import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Minus, Plus, Trash2, ChevronDown, Phone, CreditCard, Receipt, Clock, Sparkles } from 'lucide-react';
import { AssistedLineItem, POS_ANIMATIONS, POS_UI } from './POSCore';
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
  onSubmit,
  isSubmitting,
}: CartPanelProps) => {
  return (
    <aside className="w-full lg:w-[420px] shrink-0 flex flex-col bg-slate-900 lg:rounded-[2.5rem] border-t lg:border border-white/5 shadow-2xl relative z-40 overflow-hidden">
      
      {/* 1. Perspective Context Header */}
      <div className="p-6 lg:p-8 border-b border-white/5 bg-slate-900/60 backdrop-blur-3xl sticky top-0 z-30">
        <div 
          className="flex items-center justify-between cursor-pointer group"
          onClick={onToggleExpand}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 group-hover:text-blue-500 transition-colors">Session Intel</span>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-black text-white truncate max-w-[180px]">
                {guestContext.customerName || 'New Guest'}
              </h2>
              <div className="h-4 w-px bg-white/10" />
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-400/10 px-2 py-0.5 rounded-md border border-blue-400/20">
                {guestContext.orderType}
              </span>
            </div>
          </div>
          <motion.div 
            animate={{ rotate: isExpanded ? 180 : 0 }}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isExpanded ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500 group-hover:text-white'}`}
          >
            <ChevronDown size={20} />
          </motion.div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: 'auto', opacity: 1, marginTop: 24 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-4 pb-2">
                <ContextInput 
                  label="Type"
                  element={
                    <select 
                      value={guestContext.orderType} 
                      onChange={e => onUpdateContext({ ...guestContext, orderType: e.target.value })}
                      className="bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-blue-500 w-full"
                    >
                      <option value="TAKEAWAY">Takeaway</option>
                      <option value="DINE_IN">Dine In</option>
                    </select>
                  }
                />
                <ContextInput 
                  label="Station/Seat"
                  element={
                    <input 
                      placeholder="e.g. Table 04" 
                      value={guestContext.seat}
                      onChange={e => onUpdateContext({ ...guestContext, seat: e.target.value })}
                      className="bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-blue-500 w-full" 
                    />
                  }
                />
                <div className="col-span-2">
                  <ContextInput 
                    label="Guest Profile (Phone)"
                    element={
                      <div className="relative">
                        <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                        <input 
                          placeholder="Contact Info" 
                          value={guestContext.customerPhone}
                          onChange={e => onUpdateContext({ ...guestContext, customerPhone: e.target.value })}
                          className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-xs font-bold text-white outline-none focus:border-blue-500" 
                        />
                      </div>
                    }
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Reactive Cart Surface */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-5">
        <AnimatePresence mode="popLayout" initial={false}>
          {items.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-full flex flex-col items-center justify-center text-slate-700 gap-6 py-20"
            >
              <div className="w-20 h-20 rounded-[2rem] bg-slate-800/40 border border-white/5 flex items-center justify-center relative">
                <ShoppingBag size={40} className="text-white opacity-10" />
                <motion.div 
                   animate={{ scale: [1, 1.2, 1] }} 
                   transition={{ repeat: Infinity, duration: 3 }}
                   className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500/20 rounded-full" 
                />
              </div>
              <div className="text-center space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Cart Empty</p>
                <p className="text-[9px] font-bold uppercase opacity-20">Select items to begin</p>
              </div>
            </motion.div>
          ) : (
            items.map((item, idx) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30, scale: 0.9 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300, delay: idx * 0.05 }}
                className="group flex flex-col gap-4 p-5 bg-slate-950/40 border border-white/5 rounded-3xl"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <h5 className="text-[14px] font-black text-white truncate">{item.name}</h5>
                    <div className="flex flex-wrap gap-1.5">
                      {item.selectedModifiers.map(m => (
                        <span key={m.id} className="text-[9px] font-black uppercase text-blue-400/80 bg-blue-400/5 px-2 py-0.5 rounded-md border border-blue-400/10">
                          {m.name}
                        </span>
                      ))}
                      {item.notes && (
                        <span className="text-[9px] font-bold text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-md truncate max-w-full italic">
                          "{item.notes}"
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-white">{formatINR(item.lineTotal)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {/* Quantity Controls */}
                  <div className="flex items-center gap-3 bg-slate-900 border border-white/5 rounded-2xl p-1.5 shadow-inner">
                    <motion.button 
                      whileTap={{ scale: 0.85 }}
                      onClick={() => onUpdateQuantity(item.id, -1)} 
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                      <Minus size={16} />
                    </motion.button>
                    <span className="text-sm font-black text-white w-6 text-center tabular-nums">{item.quantity}</span>
                    <motion.button 
                      whileTap={{ scale: 0.85 }}
                      onClick={() => onUpdateQuantity(item.id, 1)} 
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-600/10 text-blue-400 hover:bg-blue-600/30 transition-all border border-blue-500/20 shadow-lg shadow-blue-900/10"
                    >
                      <Plus size={16} />
                    </motion.button>
                  </div>

                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onRemove(item.id)} 
                    className="w-10 h-10 rounded-2xl text-slate-700 hover:text-rose-500 hover:bg-rose-500/10 transition-all flex items-center justify-center group/del"
                  >
                    <Trash2 size={18} className="group-hover/del:scale-110 transition-transform" />
                  </motion.button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* 3. Deep-Insights Billing Surface */}
      <div className="p-8 lg:p-10 bg-slate-950/80 backdrop-blur-3xl border-t border-white/5 space-y-8 z-30">
        <div className="space-y-4">
          <div className="flex justify-between items-baseline">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Subtotal</span>
            <span className="text-sm font-bold text-slate-300 tabular-nums">{formatINR(subtotal)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Service Tax</span>
            <span className="text-sm font-bold text-slate-300 tabular-nums">{formatINR(tax)}</span>
          </div>
          <div className="pt-6 border-t border-white/5 flex justify-between items-center">
             <div>
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-1">Payable Total</p>
               <motion.p 
                 key={total}
                 initial={{ scale: 1.1, color: '#60a5fa' }}
                 animate={{ scale: 1, color: '#3b82f6' }}
                 transition={{ type: 'spring', stiffness: 500 }}
                 className="text-3xl font-black tabular-nums"
                >
                  {formatINR(total)}
                </motion.p>
             </div>
             <div className="flex flex-col items-end opacity-40">
                <Sparkles size={24} className="text-blue-500 animate-pulse" />
             </div>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: items.length > 0 ? 1.02 : 1 }}
          whileTap={{ scale: items.length > 0 ? 0.98 : 1 }}
          onClick={onSubmit}
          disabled={items.length === 0 || isSubmitting}
          className={`relative w-full h-[72px] rounded-[1.5rem] flex items-center justify-center gap-4 transition-all overflow-hidden ${
            items.length > 0 
              ? POS_UI.BUTTON_ACCENT 
              : 'bg-slate-800 text-slate-600 grayscale cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
               <Clock size={22} />
            </motion.div>
          ) : (
            <div className="flex items-center gap-3">
              {guestContext.fulfillmentMode === 'DIRECT_BILL' ? <Receipt size={22} /> : <CreditCard size={22} />}
              <span className="text-[15px] font-black uppercase tracking-[0.15em]">
                {guestContext.fulfillmentMode === 'DIRECT_BILL' ? 'Finalize Order' : 'Dispatch Order'}
              </span>
            </div>
          )}
          
          <AnimatePresence>
            {items.length > 0 && !isSubmitting && (
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

function ContextInput({ label, element }: { label: string; element: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[9px] font-black uppercase tracking-widest text-slate-600 pl-1">{label}</label>
      {element}
    </div>
  );
}
