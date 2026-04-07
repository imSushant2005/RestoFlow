import { MenuItemCard } from './MenuItemCard';

export function MenuSection({ category }: { category: any }) {
  const menuItems = Array.isArray(category?.menuItems) ? category.menuItems : [];
  if (menuItems.length === 0) return null;

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6 px-1">
        <div className="h-8 w-1 rounded-full" style={{ background: 'var(--brand)' }} />
        <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
          {category?.name || 'Menu'}
        </h2>
        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-3)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
          {menuItems.length} Items
        </span>
      </div>
      
      {category?.description && (
        <p className="text-sm font-medium mb-6 px-1 leading-relaxed" style={{ color: 'var(--text-3)' }}>
          {category.description}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {menuItems.map((item: any, index: number) => (
          <MenuItemCard key={item?.id || `${category?.id || 'category'}-${index}`} item={item} />
        ))}
      </div>
    </section>
  );
}
