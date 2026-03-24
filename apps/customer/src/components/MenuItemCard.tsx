import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ModifierModal } from './ModifierModal';
import { formatINR } from '../lib/currency';

export function MenuItemCard({ item }: { item: any }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const fallbackImage =
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
  const imageUrl = item?.imageUrl || item?.images?.[0] || fallbackImage;
  const itemName = item?.name || 'Untitled Item';
  const itemDescription = item?.description || '';
  const itemPrice = Number.isFinite(Number(item?.price)) ? Number(item.price) : 0;
  const hasTags = Boolean(item?.isVeg || item?.isVegan || item?.isGlutenFree || item?.isChefSpecial || item?.isNew);

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
        className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-200 hover:shadow-md hover:border-gray-200"
      >
        <div className="relative w-full h-44 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
          {imageError || !imageUrl ? (
            <div className="w-full h-full flex items-center justify-center text-5xl opacity-40">🍽️</div>
          ) : (
            <img
              src={imageUrl}
              alt={itemName}
              loading="lazy"
              className="w-full h-full object-cover absolute inset-0 transition-transform duration-700 group-hover:scale-110"
              onError={() => setImageError(true)}
            />
          )}

          <div className="absolute top-3 left-3 flex flex-wrap gap-1">
            {item?.isBestSeller && (
              <span className="bg-brand text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-sm shadow-md">
                Bestseller
              </span>
            )}
          </div>

          <button
            className="absolute bottom-3 right-3 w-9 h-9 bg-brand hover:bg-brand-dark text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsModalOpen(true);
            }}
          >
            <Plus size={18} strokeWidth={3} />
          </button>
        </div>

        <div className="p-4">
          {hasTags && (
            <div className="flex flex-wrap gap-1 mb-3">
              {item?.isVeg && <span className="inline-flex flex-shrink-0 items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">🌿 VEG</span>}
              {item?.isVegan && <span className="inline-flex flex-shrink-0 items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-green-100 text-green-800 border-green-300">🌱 VEGAN</span>}
              {item?.isGlutenFree && <span className="inline-flex flex-shrink-0 items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-orange-50 text-orange-700 border-orange-200">🌾 GF</span>}
              {item?.isChefSpecial && <span className="inline-flex flex-shrink-0 items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">👨‍🍳 CHEF SPECIAL</span>}
              {item?.isNew && <span className="inline-flex flex-shrink-0 items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200">✨ NEW</span>}
            </div>
          )}

          <h3 className="font-bold text-gray-900 text-[15px] leading-snug mb-1">{itemName}</h3>

          {itemDescription && (
            <p className="text-gray-400 text-[13px] line-clamp-2 leading-relaxed mb-3">{itemDescription}</p>
          )}

          <div className="flex items-center justify-between">
            <span className="font-black text-gray-900 text-base">{formatINR(itemPrice)}</span>
            <span className="text-xs text-gray-400 font-medium">Tap to add</span>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <ModifierModal item={normalizedItem} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
}
