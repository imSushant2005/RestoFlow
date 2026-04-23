import { memo } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Search, Sparkles } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'MENU' | 'SEARCH' | 'CART';
  onTabChange: (tab: 'MENU' | 'SEARCH' | 'CART') => void;
  cartItemCount: number;
}

export const BottomNav = memo(({ activeTab, onTabChange, cartItemCount }: BottomNavProps) => {
  return (
    <div className="lg:hidden fixed bottom-8 left-8 right-8 h-20 bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] px-10 flex items-center justify-between z-[100] shadow-2xl overflow-hidden pb-safe">
      
      <NavItem 
        active={activeTab === 'MENU'} 
        icon={<Sparkles size={24} />} 
        label="Items" 
        onClick={() => onTabChange('MENU')} 
        glowColor="rgba(59, 130, 246, 0.5)"
      />
      
      <NavItem 
        active={activeTab === 'SEARCH'} 
        icon={<Search size={24} />} 
        label="Find" 
        onClick={() => onTabChange('SEARCH')} 
        glowColor="rgba(168, 85, 247, 0.5)"
      />

      <div className="relative">
        <NavItem 
          active={activeTab === 'CART'} 
          icon={<ShoppingBag size={24} />} 
          label="Cart" 
          onClick={() => onTabChange('CART')} 
          glowColor="rgba(236, 72, 153, 0.5)"
        />
        <AnimatePresence>
          {cartItemCount > 0 && (
            <motion.span
              initial={{ scale: 0, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0, y: 10 }}
              className="absolute -top-1 -right-1 w-6 h-6 bg-blue-600 text-white text-[10px] font-black flex items-center justify-center rounded-full ring-4 ring-slate-900/60 shadow-lg shadow-blue-900/40"
            >
              {cartItemCount}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Modern High-End Active Background Indicator */}
      <motion.div
        layoutId="activeTabSlot"
        initial={false}
        className="absolute inset-x-0 inset-y-0 z-[-1] bg-gradient-to-r from-blue-600/5 via-purple-600/5 to-blue-600/5 opacity-50"
      />
    </div>
  );
});

import { AnimatePresence } from 'framer-motion';

function NavItem({ active, icon, label, onClick, glowColor }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void; glowColor: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 transition-all duration-500 outline-none ${
        active ? 'scale-110' : 'text-slate-500 opacity-60 hover:opacity-100'
      }`}
    >
      <motion.div 
        animate={active ? { 
           color: ['#3b82f6', '#a855f7', '#3b82f6'],
           filter: `drop-shadow(0 0 12px ${glowColor})`
        } : { color: '#64748b', filter: 'none' }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        {icon}
      </motion.div>
      <span className={`text-[9px] font-black uppercase tracking-[0.2em] transition-colors ${active ? 'text-white' : 'text-slate-600'}`}>
        {label}
      </span>
      {active && (
        <motion.div
          layoutId="tabUnderline"
          className="w-1 h-1 rounded-full bg-blue-500 mt-1 shadow-[0_0_8px_rgba(59,130,246,1)]"
        />
      )}
    </button>
  );
}
