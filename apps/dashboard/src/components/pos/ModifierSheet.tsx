import { useState, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, CheckCircle2, AlertCircle, Sparkles, ChefHat, Notebook } from 'lucide-react';
import { readPrice, calculateLineTotal, AssistedLineItem } from './POSCore';
import { formatINR } from '../../lib/currency';

interface ModifierSheetProps {
  item: any;
  onClose: () => void;
  onAdd: (lineItem: AssistedLineItem) => void;
}

export const ModifierSheet = memo(({ item, onClose, onAdd }: ModifierSheetProps) => {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Normalize modifier groups
  const groups = useMemo(
    () =>
      Array.isArray(item?.modifierGroups)
        ? item.modifierGroups
          .map((g: any) => g?.modifierGroup || g)
          .filter((g: any) => g?.id)
        : [],
    [item],
  );

  // Pre-select defaults
  const [selectedIds, setSelectedIds] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    groups.forEach((g: any) => {
      const defaults = (g.modifiers || [])
        .filter((m: any) => m?.isDefault)
        .map((m: any) => String(m.id))
        .slice(0, Math.max(1, Number(g.maxSelections || 1)));
      if (defaults.length > 0) initial[g.id] = defaults;
    });
    return initial;
  });

  const activeModifiers = useMemo<AssistedLineItem['selectedModifiers']>(
    () =>
      groups.flatMap((g: any) =>
        (g.modifiers || [])
          .filter((m: any) => (selectedIds[g.id] || []).includes(String(m.id)))
          .map((m: any) => ({
            id: String(m.id),
            name: String(m.name),
            groupName: String(g.name),
            priceAdjustment: readPrice(m.priceAdjustment),
          })),
      ),
    [groups, selectedIds],
  );

  const subtotal = useMemo(
    () => calculateLineTotal(item?.price, quantity, activeModifiers),
    [item?.price, quantity, activeModifiers],
  );

  // Validate required groups
  const validationErrors = useMemo(
    () =>
      groups
        .filter((g: any) => {
          const min = Number(g.minSelections || 0);
          return min > 0 && (selectedIds[g.id] || []).length < min;
        })
        .map((g: any) => g.name),
    [groups, selectedIds],
  );

  const handleToggle = (g: any, m: any) => {
    const current = selectedIds[g.id] || [];
    const mid = String(m.id);
    const max = Math.max(1, Number(g.maxSelections || 1));

    if (current.includes(mid)) {
      setSelectedIds({ ...selectedIds, [g.id]: current.filter((id) => id !== mid) });
      return;
    }

    if (max === 1) {
      setSelectedIds({ ...selectedIds, [g.id]: [mid] });
      return;
    }

    if (current.length >= max) {
      setErrorMsg(`Limit of ${max} reached for ${g.name}`);
      setTimeout(() => setErrorMsg(''), 2500);
      return;
    }

    setSelectedIds({ ...selectedIds, [g.id]: [...current, mid] });
  };

  const handleAdd = () => {
    if (validationErrors.length > 0) {
      setErrorMsg(`Required: ${validationErrors.join(', ')}`);
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    onAdd({
      id: `pos_${item.id}_${Date.now()}`,
      menuItemId: String(item.id),
      name: String(item.name),
      basePrice: readPrice(item.price),
      quantity,
      notes: notes.trim(),
      selectedModifierIds: activeModifiers.map((am) => am.id),
      selectedModifiers: activeModifiers,
      lineTotal: subtotal,
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/80 backdrop-blur-md sm:items-center p-0 sm:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        layoutId={`item-${item.id}`}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full sm:max-w-2xl max-h-[95dvh] flex flex-col rounded-t-[3rem] sm:rounded-[3rem] bg-slate-900 border border-white/10 shadow-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section */}
        <div className="relative px-8 pt-8 pb-6 border-b border-white/5 flex-shrink-0 bg-slate-950/40">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <ChefHat size={14} className="text-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500/80">
                  Customization Suite
                </span>
              </div>
              <h3 className="text-2xl font-black text-white leading-tight tracking-tight">{item?.name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest leading-none">Standard Base:</span>
                <span className="text-sm font-black text-blue-400">{formatINR(readPrice(item?.price))}</span>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all flex-shrink-0 shadow-lg"
            >
              <X size={24} />
            </motion.button>
          </div>
        </div>

        {/* Scrollable Modifiers List */}
        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10 custom-scrollbar">
          {groups.map((g: any, gIndex: number) => {
            const min = Number(g.minSelections || 0);
            const max = Number(g.maxSelections || 1);
            const selected = selectedIds[g.id] || [];
            const isSatisfied = selected.length >= min;

            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gIndex * 0.05 }}
                className="space-y-5"
              >
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h4 className="text-[12px] font-black text-white uppercase tracking-[0.25em]">
                      {g.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] font-black uppercase tracking-widest ${min > 0 ? 'text-blue-400' : 'text-slate-600'}`}>
                        {min > 0 ? `Compulsory (${min}+)` : 'Optional'}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-800" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                        Limit {max}
                      </span>
                    </div>
                  </div>
                  {isSatisfied && (
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full shadow-lg shadow-emerald-900/10">
                      <CheckCircle2 size={13} className="text-emerald-500" />
                      <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Selected</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(g.modifiers || []).map((m: any) => {
                    const isSelected = selected.includes(String(m.id));
                    const adj = readPrice(m.priceAdjustment);
                    return (
                      <motion.button
                        key={m.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleToggle(g, m)}
                        className={`group relative flex items-center justify-between p-5 rounded-[1.75rem] border-2 transition-all shadow-lg ${isSelected
                          ? 'border-blue-500 bg-blue-600/10 shadow-blue-900/20'
                          : 'border-slate-800 bg-slate-800/20 hover:border-slate-700 hover:bg-slate-800/40'
                          }`}
                      >
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`text-[15px] font-black transition-colors ${isSelected ? 'text-white' : 'text-slate-400'}`}
                          >
                            {m.name}
                          </span>
                          <span className={`text-[11px] font-black tracking-tight ${isSelected ? 'text-blue-400' : 'text-slate-600'}`}>
                            {adj > 0 ? `+${formatINR(adj)}` : 'No Extra Cost'}
                          </span>
                        </div>
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-400' : 'border-slate-700 bg-slate-900'
                          }`}>
                          {isSelected && <CheckCircle2 size={14} className="text-white" />}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}

          {/* Kitchen Directives Field */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: groups.length * 0.05 }}
            className="space-y-4"
          >
            <h4 className="text-[12px] font-black text-white uppercase tracking-[0.25em] px-1">
              Kitchen Directives
            </h4>
            <div className="relative group">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Specify allergy considerations, spice levels, or packaging preferences…"
                className="w-full bg-slate-950/60 border border-slate-800 rounded-[1.75rem] p-5 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all font-black leading-relaxed shadow-lg resize-none"
                rows={4}
              />
              <Notebook size={20} className="absolute bottom-5 right-5 text-slate-800 group-focus-within:text-blue-500/30 transition-colors" />
            </div>
          </motion.div>
        </div>

        {/* Global Control Bar */}
        <div className="px-8 py-8 bg-slate-950 border-t border-white/5 space-y-6 flex-shrink-0 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">
                Volume Control
              </span>
              <div className="flex items-center gap-5 mt-1">
                <motion.button
                  whileTap={{ scale: 0.8 }}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-11 h-11 flex items-center justify-center rounded-2xl bg-slate-900 border border-white/5 text-slate-500 hover:text-white hover:bg-slate-800 transition-all shadow-lg"
                >
                  <Minus size={20} />
                </motion.button>
                <span className="text-2xl font-black text-white tabular-nums w-8 text-center tracking-tighter">
                  {quantity}
                </span>
                <motion.button
                  whileTap={{ scale: 0.8 }}
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-11 h-11 flex items-center justify-center rounded-2xl bg-blue-600/10 text-blue-500 border border-blue-500/20 hover:bg-blue-600/20 transition-all shadow-lg"
                >
                  <Plus size={20} />
                </motion.button>
              </div>
            </div>

            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-3 text-rose-400 bg-rose-500/10 px-4 py-3 rounded-2xl border border-rose-500/20 max-w-[220px] shadow-2xl"
                >
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider leading-tight">
                    {errorMsg}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Staging Confirmation */}
          <motion.button
            whileHover={{ scale: validationErrors.length === 0 ? 1.01 : 1 }}
            whileTap={{ scale: validationErrors.length === 0 ? 0.98 : 1 }}
            onClick={handleAdd}
            className={`w-full h-16 rounded-[1.75rem] flex items-center justify-between px-8 font-black text-[14px] uppercase tracking-[0.25em] shadow-3xl transition-all ${validationErrors.length === 0
              ? 'bg-blue-600 text-white shadow-blue-900/30 hover:bg-blue-500'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-white/5'
              }`}
          >
            <div className="flex items-center gap-3">
              <Sparkles size={18} className={validationErrors.length === 0 ? 'animate-pulse' : ''} />
              <span>Stage Order</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-px h-6 bg-white/10" />
              <span className="text-xl tracking-tighter text-white">{formatINR(subtotal)}</span>
            </div>
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
});

ModifierSheet.displayName = 'ModifierSheet';
