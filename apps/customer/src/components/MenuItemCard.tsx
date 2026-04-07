import { useState } from 'react';
import { Info, Plus, Sparkles, Zap } from 'lucide-react';
import { formatINR } from '../lib/currency';
import { ModifierModal } from './ModifierModal';

export function MenuItemCard({ item }: { item: any }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const fallbackImage =
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
  const imageUrl = item?.imageUrl || item?.images?.[0] || fallbackImage;
  const itemName = item?.name || 'Untitled Item';
  const itemDescription = item?.description || '';
  const itemPrice = Number.isFinite(Number(item?.price)) ? Number(item.price) : 0;
  const foodTag = item?.isVeg ? 'Veg' : item?.isEgg ? 'Egg' : 'Non-Veg';
  const foodTagTone = item?.isVeg
    ? 'bg-green-50 text-green-700 border-green-200'
    : item?.isEgg
      ? 'bg-orange-50 text-orange-700 border-orange-200'
      : 'bg-red-50 text-red-700 border-red-200';

  const normalizedItem = {
    ...item,
    imageUrl,
    name: itemName,
    description: itemDescription,
    price: itemPrice,
  };

  return (
    <>
      <div
        onClick={() => setIsModalOpen(true)}
        className="group relative flex cursor-pointer flex-col overflow-hidden rounded-[24px] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl active:scale-[0.98]"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="relative h-[180px] w-full overflow-hidden">
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

          <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
            {(item?.isBestSeller || item?.isPopular) && (
              <div className="flex items-center gap-1 rounded-lg bg-orange-500/85 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white shadow-lg backdrop-blur-md">
                <Zap size={10} fill="white" />
                Bestseller
              </div>
            )}
            {item?.isChefSpecial && (
              <div className="flex items-center gap-1 rounded-lg bg-blue-500/85 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white shadow-lg backdrop-blur-md">
                <Sparkles size={10} fill="white" />
                Chef Choice
              </div>
            )}
          </div>

          <div className="absolute bottom-3 right-3">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-[14px] shadow-lg transition-all group-hover:rotate-6 active:scale-90"
              style={{ background: 'var(--brand)', color: 'white' }}
              onClick={(e) => {
                e.stopPropagation();
                setIsModalOpen(true);
              }}
            >
              <Plus size={22} strokeWidth={3} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
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
                {item?.isNew && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                    New
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
            <div className="whitespace-nowrap text-xl font-black" style={{ color: 'var(--text-1)' }}>
              {formatINR(itemPrice)}
            </div>
          </div>

          {itemDescription && (
            <p
              className="mb-4 mt-1 line-clamp-2 flex-1 text-[13px] font-medium italic leading-relaxed"
              style={{ color: 'var(--text-3)' }}
            >
              {itemDescription}
            </p>
          )}

          <div className="mt-auto flex items-center gap-2 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
            <Info size={14} style={{ color: 'var(--text-3)' }} />
            <span
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: 'var(--text-3)' }}
            >
              View details and customization
            </span>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <ModifierModal item={normalizedItem} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
}
