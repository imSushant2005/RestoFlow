import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AlertCircle, Clock3, Flame, Minus, Plus, Sparkles, X } from 'lucide-react';
import { formatINR } from '../lib/currency';
import { useCartStore } from '../store/cartStore';

type NormalizedModifier = {
  id: string;
  name: string;
  isDefault: boolean;
  price: number;
  priceAdjustment: number;
};

type NormalizedGroup = {
  id: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  modifiers: NormalizedModifier[];
};

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

export function ModifierModal({ item, isOpen, onClose }: any) {
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, NormalizedModifier[]>>({});

  const safeBasePrice = Number.isFinite(Number(item?.price)) ? Number(item.price) : 0;
  const safeName = item?.name || 'Untitled Item';
  const safeDescription = item?.description || '';
  const safeImageUrl = item?.imageUrl || item?.images?.[0] || '';
  const prepTime = Number(item?.prepTimeMinutes || 0);
  const spiceLabel = getSpiceLabel(item?.spiceLevel);

  const normalizedGroups = useMemo<NormalizedGroup[]>(
    () =>
      Array.isArray(item?.modifierGroups)
        ? item.modifierGroups
            .map((rawGroup: any) => rawGroup?.modifierGroup || rawGroup)
            .filter((group: any) => group?.id)
            .map((group: any): NormalizedGroup => {
              const minSelections = Math.max(0, Number(group?.minSelections || 0));
              const rawMaxSelections = Number(group?.maxSelections || 0);
              const maxSelections =
                Number.isFinite(rawMaxSelections) && rawMaxSelections > 0
                  ? rawMaxSelections
                  : Math.max(1, minSelections || 1);

              return {
                id: group.id,
                name: group.name || 'Options',
                isRequired: Boolean(group.isRequired || minSelections > 0),
                minSelections,
                maxSelections,
                modifiers: Array.isArray(group.modifiers)
                  ? group.modifiers
                      .filter((modifier: any) => modifier?.id)
                      .map((modifier: any): NormalizedModifier => ({
                        ...modifier,
                        name: modifier.name || 'Option',
                        isDefault: Boolean(modifier.isDefault),
                        price: Number.isFinite(Number(modifier.priceAdjustment))
                          ? Number(modifier.priceAdjustment)
                          : Number.isFinite(Number(modifier.price))
                            ? Number(modifier.price)
                            : 0,
                        priceAdjustment: Number.isFinite(Number(modifier.priceAdjustment))
                          ? Number(modifier.priceAdjustment)
                          : Number.isFinite(Number(modifier.price))
                            ? Number(modifier.price)
                            : 0,
                      }))
                  : [],
              };
            })
        : [],
    [item?.modifierGroups],
  );

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = 'auto';
      return undefined;
    }

    document.body.style.overflow = 'hidden';
    setQuantity(1);
    setNotes('');
    setValidationError(null);

    const nextSelections = normalizedGroups.reduce((acc: Record<string, NormalizedModifier[]>, group: NormalizedGroup) => {
      const defaults = group.modifiers.filter((modifier) => modifier.isDefault).slice(0, group.maxSelections);
      if (defaults.length > 0) {
        acc[group.id] = defaults;
      }
      return acc;
    }, {});

    setSelectedByGroup(nextSelections);

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, normalizedGroups]);

  useEffect(() => {
    if (!validationError) return undefined;
    const timer = window.setTimeout(() => setValidationError(null), 3500);
    return () => window.clearTimeout(timer);
  }, [validationError]);

  if (!isOpen || !item) return null;

  const selectedModifiers = normalizedGroups.flatMap((group: NormalizedGroup) => selectedByGroup[group.id] || []);
  const modifierTotal = selectedModifiers.reduce((sum: number, modifier: NormalizedModifier) => sum + Number(modifier?.priceAdjustment || 0), 0);
  const totalPerPlate = safeBasePrice + modifierTotal;
  const currentTotal = totalPerPlate * quantity;

  const toggleModifier = (group: any, modifier: any) => {
    setValidationError(null);
    setSelectedByGroup((prev) => {
      const currentGroupSelection = Array.isArray(prev[group.id]) ? prev[group.id] : [];
      const alreadySelected = currentGroupSelection.some((entry: any) => entry.id === modifier.id);

      if (alreadySelected) {
        return {
          ...prev,
          [group.id]: currentGroupSelection.filter((entry: any) => entry.id !== modifier.id),
        };
      }

      if (group.maxSelections === 1) {
        return {
          ...prev,
          [group.id]: [modifier],
        };
      }

      if (currentGroupSelection.length >= group.maxSelections) {
        setValidationError(`Choose up to ${group.maxSelections} option${group.maxSelections > 1 ? 's' : ''} for ${group.name}.`);
        return prev;
      }

      return {
        ...prev,
        [group.id]: [...currentGroupSelection, modifier],
      };
    });
  };

  const handleAdd = () => {
    const invalidGroup = normalizedGroups.find((group: NormalizedGroup) => {
      const selectedCount = (selectedByGroup[group.id] || []).length;
      return selectedCount < group.minSelections || selectedCount > group.maxSelections;
    });

    if (invalidGroup) {
      const minLabel =
        invalidGroup.minSelections > 0
          ? `Choose at least ${invalidGroup.minSelections} option${invalidGroup.minSelections > 1 ? 's' : ''}`
          : `Choose up to ${invalidGroup.maxSelections} option${invalidGroup.maxSelections > 1 ? 's' : ''}`;
      setValidationError(`${minLabel} for ${invalidGroup.name}.`);
      return;
    }

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
      notes: notes.trim(),
      totalPrice: totalPerPlate,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-md" />

      <div
        className="relative mx-auto flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[40px] shadow-2xl slide-up"
        style={{ background: 'var(--bg)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute left-0 right-0 top-0 z-40 flex justify-center py-4">
          <div className="h-1.5 w-12 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        <button
          onClick={onClose}
          className="absolute right-6 top-6 z-40 flex h-10 w-10 items-center justify-center rounded-full text-white backdrop-blur-xl transition-all active:scale-90"
          style={{ background: 'rgba(0,0,0,0.4)' }}
        >
          <X size={20} />
        </button>

        <div className="custom-scrollbar w-full overflow-y-auto" style={{ paddingBottom: '190px' }}>
          {safeImageUrl ? (
            <div className="group relative h-72 w-full overflow-hidden">
              <img
                src={safeImageUrl}
                alt={safeName}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <div className="absolute bottom-8 left-8 right-8 text-white">
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                  <Sparkles size={12} fill="white" /> Customize your plate
                </div>
                <h2 className="text-3xl font-black tracking-tight leading-tight">{safeName}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {prepTime > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]">
                      <Clock3 size={11} />
                      {prepTime} min
                    </span>
                  )}
                  {spiceLabel && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]">
                      <Flame size={11} />
                      {spiceLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="px-8 pb-4 pt-16">
              <h2 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
                {safeName}
              </h2>
            </div>
          )}

          <div className="space-y-8 px-8 py-6">
            {safeDescription && (
              <div className="border-l-4 pl-4" style={{ borderColor: 'var(--brand)' }}>
                <p className="text-base font-medium leading-relaxed" style={{ color: 'var(--text-3)' }}>
                  {safeDescription}
                </p>
              </div>
            )}

            {validationError ? (
              <div
                className="flex items-start gap-3 rounded-2xl border px-4 py-3"
                style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.18)' }}
              >
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-red-500" />
                <p className="text-sm font-bold text-red-500">{validationError}</p>
              </div>
            ) : null}

            {normalizedGroups.map((group: any) => {
              const groupSelection = selectedByGroup[group.id] || [];
              const helperText =
                group.minSelections > 0 && group.maxSelections > 1
                  ? `Choose ${group.minSelections} to ${group.maxSelections}`
                  : group.minSelections > 0
                    ? `Choose at least ${group.minSelections}`
                    : `Choose up to ${group.maxSelections}`;

              return (
                <div key={group.id} className="space-y-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-xl font-black" style={{ color: 'var(--text-1)' }}>
                        {group.name}
                        {group.isRequired ? (
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--error)' }} />
                        ) : null}
                      </h3>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--text-3)' }}>
                        {helperText}
                      </p>
                    </div>
                    <span
                      className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]"
                      style={{ background: 'var(--surface-3)', borderColor: 'var(--border)', color: 'var(--text-3)' }}
                    >
                      {groupSelection.length}/{group.maxSelections}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {group.modifiers.map((modifier: any) => {
                      const isSelected = groupSelection.some((entry: any) => entry.id === modifier.id);
                      return (
                        <button
                          key={modifier.id}
                          type="button"
                          onClick={() => toggleModifier(group, modifier)}
                          className="flex items-center justify-between rounded-2xl border p-4 text-left transition-all active:scale-[0.98]"
                          style={{
                            background: isSelected ? 'var(--brand-soft)' : 'var(--surface)',
                            borderColor: isSelected ? 'var(--brand)' : 'var(--border)',
                            boxShadow: isSelected ? '0 8px 20px -12px var(--brand)' : 'none',
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className="flex h-6 w-6 items-center justify-center rounded-lg border-2"
                              style={{
                                background: isSelected ? 'var(--brand)' : 'transparent',
                                borderColor: isSelected ? 'var(--brand)' : 'var(--border)',
                              }}
                            >
                              {isSelected ? (
                                <div className="h-3 w-1.5 -translate-y-[1px] rotate-45 border-b-2 border-r-2 border-white" />
                              ) : null}
                            </div>
                            <div>
                              <p className="text-[15px] font-bold" style={{ color: isSelected ? 'var(--brand)' : 'var(--text-1)' }}>
                                {modifier.name}
                              </p>
                              {modifier.isDefault ? (
                                <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--text-3)' }}>
                                  Recommended default
                                </p>
                              ) : null}
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-black" style={{ color: isSelected ? 'var(--brand)' : 'var(--text-2)' }}>
                              {modifier.priceAdjustment > 0 ? `+${formatINR(modifier.priceAdjustment)}` : 'Included'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-black" style={{ color: 'var(--text-1)' }}>
                  Special instructions
                </h3>
                <p className="mt-1 text-sm font-medium" style={{ color: 'var(--text-3)' }}>
                  Add kitchen notes like no onion, less spicy, or sauce on the side.
                </p>
              </div>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Write a note for the kitchen"
                className="min-h-[130px] w-full rounded-2xl p-5 font-medium outline-none transition-all placeholder:font-medium"
                style={{ background: 'var(--surface-3)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
              />
            </div>
          </div>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 z-40 border-t px-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-20px_40px_rgba(0,0,0,0.05)]"
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--text-3)' }}>
                Total price
              </span>
              <p className="text-3xl font-black" style={{ color: 'var(--brand)' }}>
                {formatINR(currentTotal)}
              </p>
            </div>

            <div className="flex items-center gap-4 rounded-2xl px-2 py-2" style={{ background: 'var(--surface-3)' }}>
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-xl border transition-all active:scale-90"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <Minus size={20} style={{ color: 'var(--text-1)' }} />
              </button>
              <span className="w-5 text-center text-xl font-black" style={{ color: 'var(--text-1)' }}>
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border transition-all active:scale-90"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <Plus size={20} style={{ color: 'var(--text-1)' }} />
              </button>
            </div>
          </div>

          <button
            onClick={handleAdd}
            className="w-full rounded-3xl bg-[#1a1c23] py-5 text-lg font-black text-white shadow-2xl transition-all active:scale-[0.98]"
          >
            Add to order
          </button>
        </div>
      </div>
    </div>
  );
}
