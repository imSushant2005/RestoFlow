import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, LayoutGrid, Filter } from 'lucide-react';
import { ItemCard } from './ItemCard';
import { AssistedLineItem } from './POSCore';

interface MenuGridProps {
  categories: any[];
  search: string;
  onSearchChange: (val: string) => void;
  selectedCategory: string;
  onCategoryChange: (id: string) => void;
  lineItems: AssistedLineItem[];
  onAddItem: (item: any) => void;
  onRemoveItem: (item: any) => void;
  onCustomizeItem: (item: any) => void;
  isLoading: boolean;
}

export const MenuGrid = memo(({
  categories,
  search,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  lineItems,
  onAddItem,
  onRemoveItem,
  onCustomizeItem,
  isLoading,
}: MenuGridProps) => {
  const hasSearch = search.trim().length > 0;

  // Build a map of menuItemId -> total quantity (for simple items with no modifiers)
  const simpleQuantityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const li of lineItems) {
      if (li.selectedModifiers.length === 0 && !li.notes) {
        map.set(li.menuItemId, (map.get(li.menuItemId) ?? 0) + li.quantity);
      }
    }
    return map;
  }, [lineItems]);

  const allItems = useMemo(
    () =>
      categories
        .flatMap((c) => c.menuItems || [])
        .sort((a: any, b: any) => a.name.localeCompare(b.name)),
    [categories],
  );

  const searchItems = useMemo(() => {
    if (!hasSearch) return allItems;
    const term = search.trim().toLowerCase();
    return allItems.filter(
      (item: any) =>
        String(item?.name || '').toLowerCase().includes(term) ||
        String(item?.description || '').toLowerCase().includes(term),
    );
  }, [allItems, hasSearch, search]);

  return (
    <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden border border-white/5 bg-slate-950 lg:rounded-[2.5rem] shadow-2xl">

      {/* ── Command Bar (Search & Categories) ── */}
      <div className="z-20 shrink-0 space-y-4 border-b border-white/5 bg-slate-900/40 p-5 backdrop-blur-3xl lg:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* Search Input */}
          <div className="relative flex-1 group">
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors"
            />
            <input
              type="text"
              placeholder="Search menu catalogue..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-12 rounded-2xl border border-white/5 bg-slate-950/60 pl-11 pr-4 text-[14px] font-black text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all"
            />
          </div>

          {/* Quick Stats or Filter toggle could go here */}
          <div className="hidden min-[480px]:flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950/50 border border-white/5 text-[9px] font-black uppercase tracking-widest text-slate-500">
              <LayoutGrid size={13} className="text-blue-500" />
              {allItems.length} SKUs
            </span>
          </div>
        </div>

        {/* Category rail */}
        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-0.5 scroll-smooth">
          <CategoryTab
            active={selectedCategory === 'ALL'}
            label="Unified Menu"
            count={allItems.length}
            onClick={() => onCategoryChange('ALL')}
            icon={<Sparkles size={11} />}
          />
          {categories.map((c: any) => (
            <CategoryTab
              key={c.id}
              active={selectedCategory === c.id}
              label={c.name}
              count={(c.menuItems || []).length}
              onClick={() => onCategoryChange(c.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Grid Content ── */}
      <div className="flex-1 overflow-y-auto p-5 pb-28 2xl:pb-8 lg:p-7 scroll-smooth custom-scrollbar">
        <AnimatePresence mode="wait" initial={false}>
          {isLoading ? (
            <GridLoadingState key="loading" />
          ) : hasSearch ? (
            searchItems.length === 0 ? (
              <GridEmptyState key="no-results" label="No matches found" />
            ) : (
              <motion.div
                key="search-results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 gap-5 min-[440px]:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
              >
                {searchItems.map((item: any) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    cartQuantity={simpleQuantityMap.get(String(item.id)) ?? 0}
                    onAdd={onAddItem}
                    onRemove={onRemoveItem}
                    onCustomize={onCustomizeItem}
                  />
                ))}
              </motion.div>
            )
          ) : selectedCategory === 'ALL' ? (
            allItems.length === 0 ? (
              <GridEmptyState key="empty" label="Catalogue is empty" />
            ) : (
              <motion.div
                key="all-items"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 gap-5 min-[440px]:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
              >
                {allItems.map((item: any) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    cartQuantity={simpleQuantityMap.get(String(item.id)) ?? 0}
                    onAdd={onAddItem}
                    onRemove={onRemoveItem}
                    onCustomize={onCustomizeItem}
                  />
                ))}
              </motion.div>
            )
          ) : (
            <div key="categories" className="space-y-12">
              {categories.map((category: any, catIndex: number) => (
                <motion.section
                  key={category.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: catIndex * 0.05 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-4">
                    <h3 className="text-[18px] font-black tracking-tight text-white uppercase italic">
                      {category.name}
                    </h3>
                    <div className="flex-1 h-px bg-gradient-to-r from-blue-500/20 via-white/5 to-transparent" />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.25em]">
                      {category.menuItems.length} Products
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-5 min-[440px]:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                    {(category.menuItems || []).map((item: any) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        cartQuantity={simpleQuantityMap.get(String(item.id)) ?? 0}
                        onAdd={onAddItem}
                        onRemove={onRemoveItem}
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

MenuGrid.displayName = 'MenuGrid';

// ---------- Sub-components ----------

function CategoryTab({
  active,
  label,
  count,
  onClick,
  icon,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={`shrink-0 h-10 px-4 rounded-2xl text-[10px] uppercase font-black tracking-[0.16em] transition-all flex items-center gap-2 border ${active
        ? 'bg-blue-600 border-blue-400/30 text-white shadow-xl shadow-blue-900/30'
        : 'bg-slate-900/80 border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10'
        }`}
    >
      {icon}
      {label}
      <span
        className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${active ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-700 border border-white/5'
          }`}
      >
        {count}
      </span>
    </motion.button>
  );
}

function GridLoadingState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col items-center justify-center gap-6 py-24"
    >
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 w-16 h-16 border-4 border-slate-900 rounded-2xl rotate-45" />
        <div className="absolute inset-0 w-16 h-16 border-4 border-t-blue-500 rounded-2xl animate-spin rotate-45" />
      </div>
      <div className="text-center">
        <p className="text-[11px] font-black text-white uppercase tracking-[0.3em] leading-none mb-2">Synchronizing</p>
        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Catalog data incoming</p>
      </div>
    </motion.div>
  );
}

function GridEmptyState({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col items-center justify-center gap-6 py-32"
    >
      <div className="w-24 h-24 rounded-3xl bg-slate-900/40 flex items-center justify-center border border-white/5 rotate-12">
        <Filter size={40} className="text-white opacity-5 -rotate-12" />
      </div>
      <div className="text-center">
        <p className="text-[12px] font-black uppercase tracking-[0.25em] text-slate-500">{label}</p>
        <p className="text-[9px] font-black uppercase mt-1.5 text-slate-700 tracking-wider">
          Refine yours search or clear filters
        </p>
      </div>
    </motion.div>
  );
}
