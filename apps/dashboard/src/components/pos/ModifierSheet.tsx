import { useState, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Minus, CheckCircle2, AlertCircle } from 'lucide-react';
import { readPrice, calculateLineTotal, AssistedLineItem, POS_ANIMATIONS, POS_UI } from './POSCore';
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

  // 1. Group Normalization
  const groups = useMemo(() => 
    Array.isArray(item?.modifierGroups)
      ? item.modifierGroups.map((g: any) => g?.modifierGroup || g).filter((g: any) => g?.id)
      : [], [item]);

  // 2. Selection Logic
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

  const activeModifiers = useMemo<AssistedLineItem['selectedModifiers']>(() =>
    groups.flatMap((g: any) =>
      (g.modifiers || [])
        .filter((m: any) => (selectedIds[g.id] || []).includes(String(m.id)))
        .map((m: any) => ({
          id: String(m.id),
          name: String(m.name),
          groupName: String(g.name),
          priceAdjustment: readPrice(m.priceAdjustment),
        }))
    ), [groups, selectedIds]);

  const subtotal = useMemo(() => 
    calculateLineTotal(item?.price, quantity, activeModifiers), 
  [item?.price, quantity, activeModifiers]);

  const handleToggle = (g: any, m: any) => {
    const current = selectedIds[g.id] || [];
    const mid = String(m.id);
    const max = Math.max(1, Number(g.maxSelections || 1));

    if (current.includes(mid)) {
      setSelectedIds({ ...selectedIds, [g.id]: current.filter(id => id !== mid) });
      return;
    }

    if (max === 1) {
      setSelectedIds({ ...selectedIds, [g.id]: [mid] });
      return;
    }

    if (current.length >= max) {
      setErrorMsg(`Only ${max} choices allowed for ${g.name}`);
      setTimeout(() => setErrorMsg(''), 2500);
      return;
    }

    setSelectedIds({ ...selectedIds, [g.id]: [...current, mid] });
  };

  const handleAdd = () => {
    onAdd({
      id: `pos_${item.id}_${Date.now()}`,
      menuItemId: String(item.id),
      name: String(item.name),
      basePrice: readPrice(item.price),
      quantity,
      notes: notes.trim(),
      selectedModifierIds: activeModifiers.map(am => am.id),
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
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center p-0 lg:p-6"
    >
      <motion.div
        {...POS_ANIMATIONS.SPRING}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="w-full sm:max-w-xl max-h-[95vh] flex flex-col rounded-t-[3rem] sm:rounded-[3rem] bg-slate-900 border border-white/10 shadow-2xl overflow-hidden shadow-blue-500/10"
      >
        {/* Header Section */}
        <div className="relative p-8 lg:p-10 border-b border-white/5 bg-slate-900/50 backdrop-blur-xl">
           <div className="flex justify-between items-start gap-6">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500">Customization</span>
                <h3 className="text-2xl font-black text-white leading-tight">{item?.name}</h3>
              </div>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={onClose} 
                className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
              >
                <X size={24} />
              </motion.button>
           </div>
        </div>

        {/* Scrollable Modification Surface */}
        <div className="flex-1 overflow-y-auto p-8 lg:p-10 space-y-12">
          {groups.map((g: any) => (
            <div key={g.id} className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">{g.name}</h4>
                  <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase">
                    Min: {g.minSelections || 0} • Max: {g.maxSelections || 1}
                  </p>
                </div>
                {(selectedIds[g.id] || []).length >= (g.minSelections || 0) && (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(g.modifiers || []).map((m: any) => {
                  const isSelected = (selectedIds[g.id] || []).includes(String(m.id));
                  return (
                    <motion.button
                      key={m.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleToggle(g, m)}
                      className={`relative flex items-center justify-between p-5 rounded-2xl border-2 transition-all overflow-hidden ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-500/10' 
                          : 'border-slate-800 bg-slate-800/20 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col items-start gap-1">
                        <span className={`text-[13px] font-black ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                          {m.name}
                        </span>
                        <span className="text-[10px] font-black text-blue-500/80">
                          {readPrice(m.priceAdjustment) > 0 ? `+${formatINR(m.priceAdjustment)}` : 'Included'}
                        </span>
                      </div>
                      {isSelected && (
                         <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                            <CheckCircle2 size={14} className="text-white" />
                         </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Notes Area */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Kitchen Notes</h4>
            <div className="relative">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Allergy alerts or special requests..."
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-6 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500 transition-all font-medium"
                rows={4}
              />
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="p-8 lg:p-10 bg-slate-950 border-t border-white/5 space-y-8">
          <div className="flex items-center justify-between px-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">Batch Size</span>
              <div className="flex items-center gap-6 mt-2">
                <motion.button 
                  whileTap={{ scale: 0.8 }}
                  onClick={() => setQuantity(q => Math.max(1, q - 1))} 
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-900 border border-white/5 text-slate-500 hover:text-white"
                >
                   <Minus size={18} />
                </motion.button>
                <span className="text-xl font-black text-white tabular-nums w-4 text-center">{quantity}</span>
                <motion.button 
                   whileTap={{ scale: 0.8 }}
                   onClick={() => setQuantity(q => q + 1)} 
                   className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-600/10 text-blue-500 border border-blue-500/20"
                >
                   <Plus size={18} />
                </motion.button>
              </div>
            </div>
            
            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-rose-500 bg-rose-500/10 px-4 py-2 rounded-xl border border-rose-500/20"
              >
                <AlertCircle size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">{errorMsg}</span>
              </motion.div>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAdd}
            className={`w-full h-18 rounded-[1.5rem] flex items-center justify-between px-10 font-black text-[13px] uppercase tracking-[0.2em] shadow-2xl ${POS_UI.BUTTON_ACCENT}`}
          >
            <span>Confirm Selection</span>
            <span className="text-lg tracking-tighter">{formatINR(subtotal)}</span>
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
});
