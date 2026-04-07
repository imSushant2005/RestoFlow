import { useState, useEffect } from 'react';
import { useCartStore } from '../store/cartStore';
import { v4 as uuidv4 } from 'uuid';
import { Minus, Plus, X, Sparkles, ChevronRight } from 'lucide-react';
import { formatINR } from '../lib/currency';

export function ModifierModal({ item, isOpen, onClose }: any) {
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<any[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

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
    <div className="fixed inset-0 z-[100] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      
      <div
        className="relative w-full max-w-2xl mx-auto rounded-t-[40px] flex flex-col slide-up shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg)', maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Handle */}
        <div className="absolute top-0 left-0 right-0 flex justify-center py-4 z-40">
          <div className="w-12 h-1.5 rounded-full transition-transform hover:scale-x-125" style={{ background: 'var(--border)' }} />
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-6 top-6 w-10 h-10 flex items-center justify-center rounded-full text-white backdrop-blur-xl z-40 transition-all active:scale-90 hover:rotate-90"
          style={{ background: 'rgba(0,0,0,0.4)' }}
        >
          <X size={20} />
        </button>

        <div className="overflow-y-auto w-full custom-scrollbar" style={{ paddingBottom: '180px' }}>
          {safeImageUrl ? (
            <div className="w-full h-72 relative overflow-hidden group">
              <img src={safeImageUrl} alt={safeName} loading="lazy" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-8 left-8 right-8 text-white">
                 <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-black uppercase tracking-widest mb-3 border border-white/20">
                    <Sparkles size={12} fill="white" /> Personalize your dish
                 </div>
                 <h2 className="text-3xl font-black tracking-tight leading-tight">{safeName}</h2>
              </div>
            </div>
          ) : (
            <div className="p-8 pb-4 pt-16">
              <h2 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>{safeName}</h2>
            </div>
          )}

          <div className="px-8 py-6 space-y-10">
            {safeDescription && (
              <div className="relative pl-4 border-l-4" style={{ borderColor: 'var(--brand)' }}>
                <p className="text-base font-medium leading-relaxed italic" style={{ color: 'var(--text-3)' }}>{safeDescription}</p>
              </div>
            )}

            {normalizedGroups.map((group: any) => (
              <div key={group.id} className="space-y-4">
                <div className="flex justify-between items-end">
                  <h3 className="text-xl font-black flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
                    {group.name}
                    {group.isRequired && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--error)' }} />}
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shadow-sm" style={{ background: 'var(--surface-3)', color: 'var(--text-3)', borderColor: 'var(--border)' }}>
                    {group.isRequired ? 'Mandatory' : 'Optional'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {group.modifiers.map((mod: any) => {
                    const isSelected = !!selectedModifiers.find((m) => m.id === mod.id);
                    return (
                      <label
                        key={mod.id}
                        className="flex justify-between items-center p-5 rounded-2xl cursor-pointer transition-all border active:scale-[0.98]"
                        style={{ 
                          background: isSelected ? 'var(--brand-soft)' : 'var(--surface)', 
                          borderColor: isSelected ? 'var(--brand)' : 'var(--border)',
                          boxShadow: isSelected ? '0 10px 20px -10px var(--brand)' : 'none'
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <div 
                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'rotate-6' : ''}`}
                            style={{ 
                              background: isSelected ? 'var(--brand)' : 'transparent',
                              borderColor: isSelected ? 'var(--brand)' : 'var(--border)'
                            }}
                          >
                            {isSelected && <div className="w-1.5 h-3 border-r-2 border-b-2 border-white rotate-45 transform -translate-y-[1px]" />}
                          </div>
                          <span className="font-bold text-[15px]" style={{ color: isSelected ? 'var(--brand)' : 'var(--text-1)' }}>{mod.name}</span>
                        </div>
                        {mod.priceAdjustment > 0 && (
                          <span className="font-black text-sm" style={{ color: isSelected ? 'var(--brand)' : 'var(--text-3)' }}>
                            +{formatINR(mod.priceAdjustment)}
                          </span>
                        )}
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={isSelected}
                          onChange={() => toggleModifier(mod)}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="space-y-4">
              <h3 className="text-xl font-black" style={{ color: 'var(--text-1)' }}>Chef's Notes</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add special instructions (e.g., No onions, extra spicy)..."
                className="w-full p-5 rounded-2xl font-bold outline-none transition-all min-h-[140px] shadow-inner focus:ring-4 placeholder:font-medium"
                style={{ 
                  background: 'var(--surface-3)', 
                  color: 'var(--text-1)',
                  '--placeholder': 'var(--text-3)',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
                } as any}
              />
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div
          className="absolute bottom-0 left-0 right-0 p-8 pt-4 flex flex-col gap-6 z-40 border-t shadow-[0_-20px_40px_rgba(0,0,0,0.05)]"
          style={{ 
            background: 'var(--glass-bg)', 
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderColor: 'var(--border)',
            paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' 
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
               <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Total Price</span>
               <span className="text-3xl font-black" style={{ color: 'var(--brand)' }}>{formatINR(currentTotal)}</span>
            </div>
            
            <div className="flex items-center gap-6 rounded-2xl p-2 bg-black/5" style={{ background: 'var(--surface-3)' }}>
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-12 h-12 flex items-center justify-center rounded-xl bg-white shadow-sm transition-all active:scale-90"
              >
                <Minus size={22} style={{ color: 'var(--text-1)' }} />
              </button>
              <span className="text-xl font-black w-6 text-center" style={{ color: 'var(--text-1)' }}>{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-12 h-12 flex items-center justify-center rounded-xl bg-white shadow-sm transition-all active:scale-90"
              >
                <Plus size={22} style={{ color: 'var(--text-1)' }} />
              </button>
            </div>
          </div>

          <button
            onClick={handleAdd}
            className="w-full bg-[#1a1c23] text-white py-5 rounded-3xl font-black text-lg transition-all active:scale-[0.98] shadow-2xl flex items-center justify-center gap-3 group"
          >
            Add to Order
            <ChevronRight size={20} className="transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
