import { memo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Settings2, Image as ImageIcon, Minus, Sparkles } from 'lucide-react';
import { parseImageUrl, generatePosGradient, readPrice, POS_UI } from './POSCore';
import { formatINR } from '../../lib/currency';

interface ItemCardProps {
  item: any;
  cartQuantity: number;
  onAdd: (item: any) => void;
  onRemove: (item: any) => void;
  onCustomize: (item: any) => void;
}

export const ItemCard = memo(({ item, cartQuantity, onAdd, onRemove, onCustomize }: ItemCardProps) => {
  const hasModifiers = Array.isArray(item.modifierGroups) && item.modifierGroups.length > 0;
  const price = readPrice(item.price);
  const inCart = cartQuantity > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      className={`group relative flex flex-col rounded-[2.25rem] overflow-hidden ${POS_UI.CARD} h-full border border-white/5 hover:border-white/10 transition-colors shadow-xl hover:shadow-2xl hover:shadow-blue-900/10`}
    >
      {/* Visual Header */}
      <div
        className="w-full aspect-[4/3] relative overflow-hidden flex items-center justify-center group-hover:scale-[1.02] transition-transform duration-500"
        style={{
          background: item.imageUrl
            ? `url('${parseImageUrl(item.imageUrl)}') center/cover`
            : generatePosGradient(item.id),
        }}
      >
        {!item.imageUrl && (
          <ImageIcon size={32} className="text-white/5 group-hover:text-white/15 transition-colors" />
        )}

        {/* Veg/Non-veg dot - Premium Redesign */}
        <div
          className={`absolute top-4 left-4 w-5 h-5 rounded-lg border-2 flex items-center justify-center bg-white/95 shadow-lg ${item.isVeg ? 'border-emerald-600' : 'border-rose-600'
            }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${item.isVeg ? 'bg-emerald-500' : 'bg-rose-500'} shadow-sm`}
          />
        </div>

        {item.isRecommended && (
          <motion.div
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute top-4 right-4 px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5"
          >
            <Sparkles size={10} />
            Chef's Pick
          </motion.div>
        )}

        {/* Gradient scrim at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
      </div>

      {/* Item Body */}
      <div className="p-5 flex flex-1 flex-col justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex justify-between items-start gap-2">
            <h4 className="text-[17px] font-black text-white leading-tight line-clamp-1 group-hover:text-blue-400 transition-colors tracking-tight">
              {item.name}
            </h4>
            <span className="text-[16px] font-black text-blue-400 tracking-tight shrink-0">{formatINR(price)}</span>
          </div>
          {item.description && (
            <p className="text-[11px] text-slate-500 line-clamp-2 font-medium leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] leading-none mb-1">
              Net Price
            </span>
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{hasModifiers ? 'Customizable' : 'Fixed Rate'}</span>
          </div>

          {/* If item has modifiers, show "Adjust" button. Otherwise show stepper when in cart, else Add */}
          <div className="flex items-center gap-2">
            {hasModifiers ? (
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => onCustomize(item)}
                className="h-11 px-6 rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase font-black tracking-[0.12em] transition-all bg-slate-800 text-white hover:bg-white hover:text-slate-950 shadow-lg shadow-black/20"
              >
                <Settings2 size={15} />
                Adjust
              </motion.button>
            ) : inCart ? (
              <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-slate-950 p-1 shadow-inner">
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => onRemove(item)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-800 hover:text-rose-400 transition-colors"
                >
                  <Minus size={16} />
                </motion.button>
                <span className="w-8 text-center text-[15px] font-black text-white tabular-nums">
                  {cartQuantity}
                </span>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => onAdd(item)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-blue-400 border border-blue-500/20 bg-blue-600/10 hover:bg-blue-600/20 transition-colors"
                >
                  <Plus size={16} />
                </motion.button>
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => onAdd(item)}
                className={`h-11 px-8 rounded-2xl flex items-center justify-center gap-2 text-[11px] uppercase font-black tracking-[0.14em] transition-all ${POS_UI.BUTTON_ACCENT} shadow-lg shadow-blue-900/30`}
              >
                <Plus size={16} />
                Add
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

ItemCard.displayName = 'ItemCard';
