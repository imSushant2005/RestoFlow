import { MenuItemCard } from './MenuItemCard';

export function MenuSection({ category }: { category: any }) {
  const menuItems = Array.isArray(category?.menuItems) ? category.menuItems : [];
  if (menuItems.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-black text-gray-900">{category?.name || 'Menu'}</h2>
        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{menuItems.length}</span>
      </div>
      {category?.description && <p className="text-gray-400 text-sm mb-4">{category.description}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {menuItems.map((item: any, index: number) => (
          <MenuItemCard key={item?.id || `${category?.id || 'category'}-${index}`} item={item} />
        ))}
      </div>
    </section>
  );
}
