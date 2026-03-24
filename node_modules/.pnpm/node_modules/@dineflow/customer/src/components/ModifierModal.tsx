import { useState } from 'react';
import { useCartStore } from '../store/cartStore';
import { v4 as uuidv4 } from 'uuid';
import { Minus, Plus, X } from 'lucide-react';
import { formatINR } from '../lib/currency';

export function ModifierModal({ item, isOpen, onClose }: any) {
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<any[]>([]);
  const [notes, setNotes] = useState('');

  if (!isOpen || !item) return null;

  const safeBasePrice = Number.isFinite(Number(item.price)) ? Number(item.price) : 0;
  const safeName = item.name || 'Untitled Item';
  const safeDescription = item.description || '';
  const safeImageUrl = item.imageUrl || item.images?.[0] || '';

  const normalizedGroups = Array.isArray(item.modifierGroups)
    ? item.modifierGroups
        .map((rawGroup: any) => rawGroup?.modifierGroup || rawGroup)
        .filter((group: any) => group && group.id)
        .map((group: any) => ({
          id: group.id,
          name: group.name || 'Options',
          isRequired: Boolean(group.isRequired),
          modifiers: Array.isArray(group.modifiers)
            ? group.modifiers
                .filter((mod: any) => mod && mod.id)
                .map((mod: any) => ({
                  ...mod,
                  name: mod.name || 'Option',
                  priceAdjustment: Number.isFinite(Number(mod.priceAdjustment))
                    ? Number(mod.priceAdjustment)
                    : Number.isFinite(Number(mod.price))
                      ? Number(mod.price)
                      : 0,
                }))
            : [],
        }))
    : [];

  const toggleModifier = (mod: any) => {
    setSelectedModifiers((prev) => {
      const exists = prev.find((m) => m.id === mod.id);
      if (exists) return prev.filter((m) => m.id !== mod.id);
      return [...prev, mod];
    });
  };

  const modifierTotal = selectedModifiers.reduce((acc, mod) => {
    const price = Number.isFinite(Number(mod.priceAdjustment))
      ? Number(mod.priceAdjustment)
      : Number.isFinite(Number(mod.price))
        ? Number(mod.price)
        : 0;
    return acc + price;
  }, 0);

  const currentTotal = (safeBasePrice + modifierTotal) * quantity;

  const handleAdd = () => {
    addItem({
      id: uuidv4(),
      menuItem: {
        ...item,
        name: safeName,
        description: safeDescription,
        imageUrl: safeImageUrl || null,
        price: safeBasePrice,
      },
      quantity,
      modifiers: selectedModifiers,
      notes,
      totalPrice: safeBasePrice + modifierTotal,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col justify-end">
      <div
        className="bg-white rounded-t-3xl max-h-[90vh] flex flex-col animate-in animate-duration-300 slide-in-from-bottom-full relative shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 flex justify-center py-3 z-20">
          <div className="w-12 h-1.5 bg-gray-300/80 rounded-full"></div>
        </div>
        <button
          onClick={onClose}
          className="absolute right-4 top-4 bg-black/50 backdrop-blur-md text-white p-2 rounded-full z-20 hover:bg-black/70 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="overflow-y-auto w-full custom-scrollbar" style={{ paddingBottom: '160px' }}>
          {safeImageUrl && (
            <div className="w-full h-56 bg-gray-100 relative">
              <img src={safeImageUrl} alt={safeName} loading="lazy" className="w-full h-full object-cover rounded-t-3xl" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent rounded-t-3xl"></div>
            </div>
          )}
          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900">{safeName}</h2>
            {safeDescription && <p className="text-gray-500 mt-2 leading-relaxed">{safeDescription}</p>}

            {normalizedGroups.map((group: any) => (
              <div key={group.id} className="mt-8 shadow-sm border p-4 rounded-xl">
                <div className="flex justify-between items-baseline mb-3">
                  <h3 className="font-bold text-lg">{group.name}</h3>
                  <span className="text-xs font-semibold bg-gray-100 px-2 py-1 rounded text-gray-600">
                    {group.isRequired ? 'Required' : 'Optional'}
                  </span>
                </div>
                <div className="flex flex-col gap-3 mt-4">
                  {group.modifiers.map((mod: any) => (
                    <label
                      key={mod.id}
                      className="flex justify-between items-center p-3 border rounded-xl cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                          checked={!!selectedModifiers.find((m) => m.id === mod.id)}
                          onChange={() => toggleModifier(mod)}
                        />
                        <span className="font-medium text-gray-800">{mod.name}</span>
                      </div>
                      {mod.priceAdjustment > 0 && (
                        <span className="text-gray-500 text-sm font-medium">+{formatINR(mod.priceAdjustment)}</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="mt-8">
              <h3 className="font-bold text-lg mb-2">Special Instructions</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes (e.g., No onions, extra spicy)..."
                className="w-full p-4 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none min-h-[120px] shadow-sm resize-none"
              />
            </div>
          </div>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 pb-6 pt-4 px-5 bg-white/90 backdrop-blur-md border-t border-gray-100 flex flex-col gap-3 z-10"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex justify-between items-center bg-gray-50 p-2 rounded-2xl border border-gray-100">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-12 h-12 flex items-center justify-center bg-white rounded-xl shadow-sm hover:bg-gray-50 active:scale-95 transition-all text-gray-600"
            >
              <Minus size={22} />
            </button>
            <span className="text-xl font-black w-12 text-center text-gray-900">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-12 h-12 flex items-center justify-center bg-white rounded-xl shadow-sm hover:bg-gray-50 active:scale-95 transition-all text-gray-600"
            >
              <Plus size={22} />
            </button>
          </div>
          <button
            onClick={handleAdd}
            className="w-full bg-blue-600 text-white py-4.5 rounded-2xl font-black flex justify-between items-center px-6 shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all"
          >
            <span className="text-base tracking-wide">ADD TO ORDER</span>
            <span className="text-lg bg-black/10 px-3 py-1 rounded-lg">{formatINR(currentTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
