import { useState, type MouseEvent } from 'react';
import { Clock3, Flame, Info, Plus, Sparkles, Tag, Zap } from 'lucide-react';
import { formatINR } from '../lib/currency';
import { useCartStore } from '../store/cartStore';
import { ModifierModal } from './ModifierModal';

function getSpiceLabel(level?: number | null) {
  switch (Number(level || 0)) {
    case 1:
      return 'Mild';
    case 2:
      return 'Medium';
    case 3:
      return 'Hot';
    case 4:
      return 'Extra hot';
    default:
      return null;
  }
}

export function MenuItemCard({ item }: { item: any }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  const fallbackImage =
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
  const imageUrl = item?.imageUrl || item?.images?.[0] || fallbackImage;
  const itemName = item?.name || 'Untitled Item';
  const itemDescription = item?.description || '';
  const itemPrice = Number.isFinite(Number(item?.price)) ? Number(item.price) : 0;
  const compareAtPrice = Number.isFinite(Number(item?.compareAtPrice)) ? Number(item.compareAtPrice) : 0;
  const foodTag = item?.isVeg ? 'Veg' : item?.isEgg ? 'Egg' : 'Non-Veg';
  const foodTagTone = item?.isVeg
    ? 'bg-green-50 text-green-700 border-green-200'
    : item?.isEgg
      ? 'bg-orange-50 text-orange-700 border-orange-200'
      : 'bg-red-50 text-red-700 border-red-200';
  const prepTime = Number(item?.prepTimeMinutes || 0);
  const spiceLabel = getSpiceLabel(item?.spiceLevel);
  const detailTags = [
    item?.isVegan ? 'Vegan' : null,
    item?.isGlutenFree ? 'Gluten free' : null,
    ...(Array.isArray(item?.tags) ? item.tags.slice(0, 2) : []),
  ]
    .filter(Boolean)
    .slice(0, 3);
  const hasModifierGroups =
    Array.isArray(item?.modifierGroups) &&
    item.modifierGroups.some((rawGroup: any) => {
      const group = rawGroup?.modifierGroup || rawGroup;
      return group?.id && Array.isArray(group?.modifiers) && group.modifiers.length > 0;
    });

  const normalizedItem = {
    ...item,
    imageUrl,
    name: itemName,
    description: itemDescription,
    price: itemPrice,
  };

  const handleOpen = () => setIsModalOpen(true);

  const handleQuickAdd = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (hasModifierGroups) {
      setIsModalOpen(true);
      return;
    }

    addItem({
      id: `menu-${item?.id || itemName}-${Date.now()}`,
      menuItem: normalizedItem,
      quantity: 1,
      modifiers: [],
      notes: '',
      totalPrice: itemPrice,
    });
  };

  return (
    <>
      <div
        onClick={handleOpen}
        className="group relative flex cursor-pointer flex-col overflow-hidden rounded-[24px] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl active:scale-[0.98]"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="relative h-[190px] w-full overflow-hidden">
          {imageError || !imageUrl ? (
            <div
              className="flex h-full w-full items-center justify-center text-sm font-bold opacity-50"
              style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
            >
              Image unavailable
            </div>
          ) : (
            <img
              src={imageUrl}
              alt={itemName}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
              onError={() => setImageError(true)}
            />
          )}

          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />

          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
            {(item?.isBestSeller || item?.isPopular) && (
              <div className="flex items-center gap-1 rounded-lg bg-orange-500/90 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white shadow-lg backdrop-blur-md">
                <Zap size={10} fill="white" />
                Bestseller
              </div>
            )}
            {item?.isChefSpecial && (
              <div className="flex items-center gap-1 rounded-lg bg-blue-500/90 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white shadow-lg backdrop-blur-md">
                <Sparkles size={10} fill="white" />
                Chef choice
              </div>
            )}
            {item?.isNew && (
              <div className="rounded-lg bg-white/90 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-900 shadow-lg">
                New
              </div>
            )}
          </div>

          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
            {prepTime > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white backdrop-blur-md">
                <Clock3 size={10} />
                {prepTime} min
              </span>
            )}
            {spiceLabel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white backdrop-blur-md">
                <Flame size={10} />
                {spiceLabel}
              </span>
            )}
          </div>

          <div className="absolute bottom-3 right-3">
            <button
              className="flex h-11 w-11 items-center justify-center rounded-[14px] shadow-lg transition-all group-hover:rotate-6 active:scale-90"
              style={{ background: 'var(--brand)', color: 'white' }}
              onClick={handleQuickAdd}
            >
              <Plus size={22} strokeWidth={3} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {item?.isVeg ? (
                  <div className="flex h-4 w-4 items-center justify-center rounded-sm border-2 border-green-600 bg-white p-[2px]">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-600" />
                  </div>
                ) : item?.isEgg ? (
                  <div className="flex h-4 w-4 items-center justify-center rounded-sm border-2 border-orange-400 bg-white p-[2px]">
                    <div className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                  </div>
                ) : (
                  <div className="flex h-4 w-4 items-center justify-center rounded-sm border-2 border-red-600 bg-white p-[2px]">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-600" />
                  </div>
                )}

                <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${foodTagTone}`}>
                  {foodTag}
                </span>
                {Array.isArray(item?.allergens) && item.allergens.length > 0 && (
                  <span
                    className="rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
                  >
                    Allergens
                  </span>
                )}
              </div>

              <h3
                className="text-[17px] font-black leading-tight transition-colors group-hover:text-brand"
                style={{ color: 'var(--text-1)' }}
              >
                {itemName}
              </h3>
            </div>

            <div className="text-right">
              {compareAtPrice > itemPrice ? (
                <p className="text-[11px] font-bold line-through" style={{ color: 'var(--text-3)' }}>
                  {formatINR(compareAtPrice)}
                </p>
              ) : null}
              <div className="whitespace-nowrap text-xl font-black" style={{ color: 'var(--text-1)' }}>
                {formatINR(itemPrice)}
              </div>
            </div>
          </div>

          {itemDescription && (
            <p
              className="mb-4 mt-1 line-clamp-2 flex-1 text-[13px] font-medium leading-relaxed"
              style={{ color: 'var(--text-3)' }}
            >
              {itemDescription}
            </p>
          )}

          {detailTags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {detailTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-3)', color: 'var(--text-3)' }}
                >
                  <Tag size={10} />
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <Info size={14} style={{ color: 'var(--text-3)' }} />
              <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--text-3)' }}>
                {hasModifierGroups ? 'Customize before adding' : 'Tap for details'}
              </span>
            </div>
            <span className="text-[11px] font-black" style={{ color: 'var(--brand)' }}>
              {hasModifierGroups ? 'Customize' : 'Quick add'}
            </span>
          </div>
        </div>
      </div>

      {isModalOpen ? (
        <ModifierModal item={normalizedItem} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      ) : null}
    </>
  );
}
