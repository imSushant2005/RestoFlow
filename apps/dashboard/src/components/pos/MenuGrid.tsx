import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, Filter } from 'lucide-react';
import { ItemCard } from './ItemCard';

interface MenuGridProps {
  categories: any[];
  search: string;
  onSearchChange: (val: string) => void;
  selectedCategory: string;
  onCategoryChange: (id: string) => void;
  onAddItem: (item: any) => void;
  onCustomizeItem: (item: any) => void;
  isLoading: boolean;
}

export const MenuGrid = memo(({
  categories,
  search,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  onAddItem,
  onCustomizeItem,
  isLoading,
}: MenuGridProps) => {
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-950 lg:rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden relative">
      
      {/* Search & Global Category Bar */}
      <div className="shrink-0 p-6 lg:p-8 bg-slate-900/40 backdrop-blur-3xl border-b border-white/5 z-20 space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative group">
            <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text"
              placeholder="Deep search menu..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-14 bg-slate-950/50 border border-white/10 rounded-[1.25rem] pl-14 pr-6 text-sm font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all"
            />
          </div>
          <button className="h-14 w-14 rounded-[1.25rem] bg-slate-900 border border-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-colors">
            <Filter size={20} />
          </button>
        </div>

        {/* Rapid Tab Category Selection */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1 px-1">
          <CategoryTab 
            active={selectedCategory === 'ALL'} 
            label="Omni View" 
            onClick={() => onCategoryChange('ALL')} 
          />
          {categories.map((c: any) => (
            <CategoryTab 
              key={c.id}
              active={selectedCategory === c.id} 
              label={c.name} 
              onClick={() => onCategoryChange(c.id)} 
            />
          ))}
        </div>
      </div>

      {/* Grid Content with Staggered Animations */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-10 scroll-smooth pb-32 lg:pb-10">
        <AnimatePresence mode="popLayout" initial={false}>
          {isLoading ? (
            <GridLoadingState />
          ) : categories.length === 0 ? (
            <GridEmptyState />
          ) : selectedCategory === 'ALL' ? (
            /* Flattened Omni View */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4 gap-6 lg:gap-8"
            >
              {categories
                .flatMap(c => c.menuItems || [])
                .sort((a: any, b: any) => a.name.localeCompare(b.name))
                .map((item: any) => (
                  <ItemCard 
                    key={item.id} 
                    item={item} 
                    onAdd={onAddItem} 
                    onCustomize={onCustomizeItem}
                  />
                ))}
            </motion.div>
          ) : (
            /* Individual Category Sections */
            <div className="space-y-16">
              {categories.map((category: any, catIndex: number) => (
                <motion.section 
                  key={category.id} 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: catIndex * 0.05 }}
                  className="space-y-8"
                >
                  <div className="flex items-baseline gap-4">
                    <h3 className="text-2xl font-black text-white tracking-tight">{category.name}</h3>
                    <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">{category.menuItems.length} Products</span>
                  </div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4 gap-6 lg:gap-8">
                    {category.menuItems.map((item: any) => (
                      <ItemCard 
                        key={item.id} 
                        item={item} 
                        onAdd={onAddItem} 
                        onCustomize={onCustomizeItem}
                      />
                    ))}
                  </div>
                </motion.section>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

function CategoryTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`shrink-0 h-11 px-6 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all ${
        active 
          ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/30' 
          : 'bg-slate-900/80 text-slate-500 hover:text-slate-300 border border-white/5'
      }`}
    >
      {label}
    </motion.button>
  );
}

function GridLoadingState() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-6">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-slate-800 rounded-full" />
        <div className="absolute inset-0 w-16 h-16 border-4 border-t-blue-500 rounded-full animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-sm font-black text-white uppercase tracking-widest">Hydrating Catalog</p>
        <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Please wait a moment</p>
      </div>
    </div>
  );
}

function GridEmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-6">
      <div className="w-24 h-24 rounded-full bg-slate-900/50 flex items-center justify-center border border-white/5">
        <Sparkles size={40} className="text-white opacity-10" />
      </div>
      <div className="text-center">
        <p className="text-sm font-black uppercase tracking-widest text-slate-500">No results matched</p>
        <p className="text-[10px] font-bold uppercase mt-1">Try refining your search keywords</p>
      </div>
    </div>
  );
}
