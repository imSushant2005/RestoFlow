import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Search, LayoutGrid } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'MENU' | 'SEARCH' | 'CART';
  onTabChange: (tab: 'MENU' | 'SEARCH' | 'CART') => void;
  cartItemCount: number;
}

export const BottomNav = memo(({ activeTab, onTabChange, cartItemCount }: BottomNavProps) => {
  return (
    <div className="fixed inset-x-4 bottom-6 z-[100] flex h-[4.5rem] items-center justify-between overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 px-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-3xl 2xl:hidden border-t-white/20">
      <NavItem
        active={activeTab === 'MENU'}
        icon={<LayoutGrid size={22} />}
        label="Catalogue"
        onClick={() => onTabChange('MENU')}
        glowColor="rgba(59, 130, 246, 0.5)"
      />

      <NavItem
        active={activeTab === 'SEARCH'}
        icon={<Search size={22} />}
        label="Search"
        onClick={() => onTabChange('SEARCH')}
        glowColor="rgba(168, 85, 247, 0.5)"
      />

      <div className="relative">
        <NavItem
          active={activeTab === 'CART'}
          icon={<ShoppingBag size={22} />}
          label="Review"
          onClick={() => onTabChange('CART')}
          glowColor="rgba(236, 72, 153, 0.5)"
        />
        <AnimatePresence>
          {cartItemCount > 0 && (
            <motion.span
              initial={{ scale: 0, y: 10, rotate: -20 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              exit={{ scale: 0, y: 10 }}
              className="absolute -top-1.5 -right-1.5 min-w-[1.6rem] h-6 px-1.5 bg-blue-600 text-white text-[10px] font-black flex items-center justify-center rounded-full ring-4 ring-slate-900 shadow-xl shadow-blue-900/40"
            >
              {cartItemCount > 99 ? '99+' : cartItemCount}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Decorative gradient background */}
      <div className="pointer-events-none absolute inset-0 z-[-1] bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10 opacity-30" />
    </div>
  );
});

BottomNav.displayName = 'BottomNav';

function NavItem({
  active,
  icon,
  label,
  onClick,
  glowColor,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  glowColor: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-1 flex-col items-center justify-center gap-1.5 transition-all duration-300 outline-none ${active ? 'scale-110' : 'text-slate-500 opacity-60 hover:opacity-100 hover:scale-105'
        }`}
    >
      <motion.div
        animate={
          active
            ? {
              color: ['#3b82f6', '#a855f7', '#3b82f6'],
              filter: `drop-shadow(0 0 15px ${glowColor})`,
            }
            : { color: '#64748b', filter: 'none' }
        }
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      >
        {icon}
      </motion.div>
      <span
        className={`text-[9px] font-black uppercase tracking-[0.2em] transition-colors ${active ? 'text-white' : 'text-slate-600'}`}
      >
        {label}
      </span>

      {active && (
        <motion.div
          layoutId="tabUnderline"
          className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,1)]"
        />
      )}
    </button>
  );
}
