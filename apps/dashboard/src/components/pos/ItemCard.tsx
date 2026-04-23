import { memo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Settings2, Image as ImageIcon } from 'lucide-react';
import { parseImageUrl, generatePosGradient, readPrice, POS_UI } from './POSCore';
import { formatINR } from '../../lib/currency';

interface ItemCardProps {
  item: any;
  onAdd: (item: any) => void;
  onCustomize: (item: any) => void;
}

export const ItemCard = memo(({ item, onAdd, onCustomize }: ItemCardProps) => {
  const hasModifiers = Array.isArray(item.modifierGroups) && item.modifierGroups.length > 0;
  const price = readPrice(item.price);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.97 }}
      className={`group relative flex flex-col rounded-[2rem] overflow-hidden ${POS_UI.CARD} h-full`}
    >
      {/* Visual Header */}
      <div 
        className="w-full aspect-[4/3] relative overflow-hidden flex items-center justify-center bg-slate-800"
        style={{ 
          background: item.imageUrl ? `url('${parseImageUrl(item.imageUrl)}') center/cover` : generatePosGradient(item.id) 
        }}
      >
        {!item.imageUrl && (
          <ImageIcon size={32} className="text-white/10 group-hover:text-white/20 transition-colors" />
        )}
        
        {/* Badges */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
          <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter backdrop-blur-md border border-white/5 ${item.isVeg ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
            {item.isVeg ? 'Veg' : 'Non-Veg'}
          </div>
          {item.isRecommended && (
             <div className="px-2 py-1 rounded-lg bg-amber-500 text-slate-950 text-[9px] font-black uppercase tracking-tighter">
               Star
             </div>
          )}
        </div>
      </div>

      {/* Item Body */}
      <div className="p-5 flex flex-1 flex-col justify-between gap-4">
        <div className="space-y-1.5">
          <h4 className="text-[15px] font-black text-white leading-tight truncate group-hover:text-blue-400 transition-colors">
            {item.name}
          </h4>
          <p className="text-[11px] text-slate-500 line-clamp-2 font-medium leading-relaxed italic">
            {item.description || "A chef's special selection from the current season."}
          </p>
        </div>

        <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Price</span>
            <span className="text-lg font-black text-white tracking-tighter">{formatINR(price)}</span>
          </div>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => hasModifiers ? onCustomize(item) : onAdd(item)}
            className={`h-11 px-5 rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase font-black tracking-[0.1em] transition-all ${
              hasModifiers 
                ? 'bg-slate-800 text-slate-200 hover:bg-white hover:text-slate-950' 
                : POS_UI.BUTTON_ACCENT
            }`}
          >
            {hasModifiers ? (
              <><Settings2 size={14} /> Adjust</>
            ) : (
              <><Plus size={16} /> Add</>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
});
