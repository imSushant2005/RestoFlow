import { ChevronRight } from 'lucide-react';
import { MenuItemCard } from './MenuItemCard';

type MenuSectionProps = {
  category: any;
  index?: number;
  onOpenItem: (item: any) => void;
  onQuickAddItem: (item: any, hasModifierGroups: boolean) => void;
};

export function MenuSection({ category, index = 0, onOpenItem, onQuickAddItem }: MenuSectionProps) {
  const menuItems = Array.isArray(category?.menuItems) ? category.menuItems : [];
  if (menuItems.length === 0) return null;

  return (
    <section
      className="menu-section-entry overflow-hidden rounded-[32px] border shadow-sm"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        animationDelay: `${Math.min(index, 6) * 70}ms`,
      }}
    >
      <div className="border-b px-5 py-5 sm:px-6" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-9 w-1.5 rounded-full" style={{ background: 'var(--brand)' }} />
              <div className="min-w-0">
                <h2 className="text-2xl font-black tracking-tight sm:text-[1.85rem]" style={{ color: 'var(--text-1)' }}>
                  {category?.name || 'Menu'}
                </h2>
                {category?.description ? (
                  <p className="mt-1 max-w-2xl text-sm font-medium leading-relaxed" style={{ color: 'var(--text-3)' }}>
                    {category.description}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
              style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
            >
              {menuItems.length} Items
            </span>
            <span className="hidden items-center gap-1 text-[11px] font-black uppercase tracking-[0.16em] sm:inline-flex" style={{ color: 'var(--text-3)' }}>
              Tap a card to customize
              <ChevronRight size={14} />
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-2 sm:gap-5 sm:p-5 xl:grid-cols-3">
        {menuItems.map((item: any, itemIndex: number) => (
          <MenuItemCard
            key={item?.id || `${category?.id || 'category'}-${itemIndex}`}
            item={item}
            index={itemIndex}
            onOpen={onOpenItem}
            onQuickAdd={onQuickAddItem}
          />
        ))}
      </div>
    </section>
  );
}
