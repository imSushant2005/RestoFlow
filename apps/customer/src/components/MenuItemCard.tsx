import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { ChevronRight, Clock3, Plus, Minus, Sparkles, Zap } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { formatINR } from '../lib/currency';
import { DEFAULT_MENU_IMAGE, getImageUrlCandidates, pickFirstImageSource } from '../lib/images';

type MenuItemCardProps = {
  item: any;
  index?: number;
  onOpen: (item: any) => void;
  onQuickAdd: (item: any, hasModifierGroups: boolean) => void;
};

export function MenuItemCard({ item, index = 0, onOpen, onQuickAdd }: MenuItemCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  const rawImageUrl = pickFirstImageSource(item?.images, item?.imageUrl);
  const imageUrls = useMemo(() => {
    const candidates = getImageUrlCandidates(rawImageUrl);
    if (!rawImageUrl) return [DEFAULT_MENU_IMAGE];
    return Array.from(new Set([...candidates, DEFAULT_MENU_IMAGE]));
  }, [rawImageUrl]);
  const imageUrl = imageUrls[imageIndex] || '';
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

  const cartItems = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  
  // Find matching items in cart that have no modifiers
  const existingCartItems = Array.isArray(cartItems) 
    ? cartItems.filter((i) => i.menuItem?.id === item?.id && (!i.modifiers || i.modifiers.length === 0))
    : [];
  const totalQuantity = existingCartItems.reduce((acc, curr) => acc + (Number(curr.quantity) || 1), 0);
  const mainCartItemId = existingCartItems[0]?.id;

  const actionLabel = hasModifierGroups ? 'Customize' : 'Add';

  useEffect(() => {
    setImageError(false);
    setImageIndex(0);
  }, [imageUrls]);

  const handleQuickAction = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onQuickAdd(normalizedItem, hasModifierGroups);
  };

  const handleIncrement = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (mainCartItemId) {
      updateQuantity(mainCartItemId, totalQuantity + 1);
    } else {
      onQuickAdd(normalizedItem, false);
    }
  };

  const handleDecrement = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (mainCartItemId) {
      updateQuantity(mainCartItemId, totalQuantity - 1);
    }
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(normalizedItem)}
      className="menu-card-entry group relative flex w-full flex-col overflow-hidden rounded-[24px] border text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] active:scale-[0.99]"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        animationDelay: `${Math.min(index, 8) * 60}ms`,
      }}
    >
      <div className="relative w-full flex-shrink-0 overflow-hidden h-36 sm:h-52">
        {imageError || !imageUrl ? (
          <div
            className="flex h-full min-h-[124px] w-full items-center justify-center text-[11px] font-black uppercase tracking-[0.16em] opacity-60"
            style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
          >
            Image unavailable
          </div>
        ) : (
          <img
            src={imageUrl}
            key={imageUrl}
            alt={itemName}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={() => {
              if (imageIndex < imageUrls.length - 1) {
                setImageIndex((current) => current + 1);
                return;
              }
              setImageError(true);
            }}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent sm:from-black/70 sm:via-black/15" />

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {(item?.isBestSeller || item?.isPopular) ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/95 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white shadow-lg backdrop-blur-sm">
              <Zap size={10} fill="white" />
              Popular
            </span>
          ) : null}
          {item?.isChefSpecial ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/95 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white shadow-lg backdrop-blur-sm">
              <Sparkles size={10} fill="white" />
              Chef pick
            </span>
          ) : null}
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${foodTagTone}`}>
            {foodTag}
          </span>
          {prepTime > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white backdrop-blur-sm">
              <Clock3 size={10} />
              {prepTime}m
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[0.95rem] font-black leading-tight sm:text-lg" style={{ color: 'var(--text-1)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {itemName}
              </h3>
              {/* Description is shown only in the customizer screen */}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
              style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
            >
              {hasModifierGroups ? 'Customizable' : 'Ready to add'}
            </span>
            {compareAtPrice > itemPrice ? (
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600">
                Save {formatINR(compareAtPrice - itemPrice)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-auto flex flex-col justify-end gap-2.5 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          <div className="min-w-0">
            <p className="text-lg font-black tracking-tight leading-none" style={{ color: 'var(--text-1)' }}>
              {formatINR(itemPrice)}
            </p>
            {compareAtPrice > itemPrice ? (
              <p className="mt-1 text-[10px] font-bold line-through opacity-45" style={{ color: 'var(--text-3)' }}>
                {formatINR(compareAtPrice)}
              </p>
            ) : null}
          </div>

          <div onClick={(e) => e.stopPropagation()} className="w-full">
            {!hasModifierGroups && totalQuantity > 0 ? (
              <div 
                className="flex w-full items-center justify-between rounded-full border shadow-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
              >
                <button
                  type="button"
                  onClick={handleDecrement}
                  className="flex h-8 w-1/3 items-center justify-center rounded-l-full text-slate-500 transition-colors hover:bg-slate-100 active:bg-slate-200"
                >
                  <Minus size={14} strokeWidth={3} />
                </button>
                <span className="w-1/3 text-center text-xs font-black" style={{ color: 'var(--text-1)' }}>
                  {totalQuantity}
                </span>
                <button
                  type="button"
                  onClick={handleIncrement}
                  className="flex h-8 w-1/3 items-center justify-center rounded-r-full text-slate-500 transition-colors hover:bg-slate-100 active:bg-slate-200"
                >
                  <Plus size={14} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleQuickAction}
                className="flex w-full h-8 items-center justify-center gap-1.5 rounded-full px-3 text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-md transition-all active:scale-[0.98]"
                style={{ background: 'var(--brand)' }}
              >
                {hasModifierGroups ? <ChevronRight size={14} /> : <Plus size={14} strokeWidth={3} />}
                {actionLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
