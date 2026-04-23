import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChevronRight, Minus, Plus, X } from 'lucide-react';
import { formatINR } from '../lib/currency';
import { getImageUrlCandidates } from '../lib/images';
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

function incrementCustomerOverlayLock() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const current = Number(root.dataset.rfCustomerOverlayCount || '0');
  const next = current + 1;
  root.dataset.rfCustomerOverlayCount = String(next);
  root.dataset.rfCustomerOverlay = 'open';
}

function decrementCustomerOverlayLock() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const current = Number(root.dataset.rfCustomerOverlayCount || '0');
  const next = Math.max(0, current - 1);
  if (next === 0) {
    delete root.dataset.rfCustomerOverlayCount;
    delete root.dataset.rfCustomerOverlay;
    return;
  }
  root.dataset.rfCustomerOverlayCount = String(next);
  root.dataset.rfCustomerOverlay = 'open';
}

export function ModifierModal({ item, onClose }: any) {
  const { items: cartItems, addItem, removeItem, updateQuantity, activeSheet, setActiveSheet } = useCartStore();
  const isOpen = activeSheet === 'MODIFIER';
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, NormalizedModifier[]>>({});

  const safeBasePrice = Number.isFinite(Number(item?.price)) ? Number(item.price) : 0;
  const safeName = item?.name || 'Untitled Item';
  const safeDescription = item?.description || '';
  const imageUrls = useMemo(() => getImageUrlCandidates(item?.imageUrl || item?.images?.[0] || ''), [item?.imageUrl, item?.images]);
  const safeImageUrl = imageUrls[imageIndex] || '';
  const safeItemId = item?.id || '';

  const normalizedGroups = useMemo<NormalizedGroup[]>(
    () => {
      const rawGroups = item?.itemModifiers || item?.modifierGroups || item?.modifiers || [];

      return Array.isArray(rawGroups)
        ? rawGroups
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
        : [];
    },
    [item],
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
    setImageLoadFailed(false);
    setImageIndex(0);
  }, [imageUrls]);

  const handleImageError = () => {
    if (imageIndex < imageUrls.length - 1) {
      setImageIndex((current) => current + 1);
      return;
    }
    setImageLoadFailed(true);
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    incrementCustomerOverlayLock();
    return () => {
      decrementCustomerOverlayLock();
    };
  }, [isOpen]);

  const handleClose = () => {
    setActiveSheet('NONE');
    if (onClose) onClose();
  };

  const selectedModifiers = normalizedGroups.flatMap((group: NormalizedGroup) => selectedByGroup[group.id] || []);
  
  // Find if an item with these EXACT modifiers already exists in the cart
  const existingCartItem = useMemo(() => {
    return cartItems.find((cartItem) => {
      if (cartItem.menuItem.id !== safeItemId) return false;
      if (cartItem.modifiers.length !== selectedModifiers.length) return false;
      const cartModIds = cartItem.modifiers.map((m: any) => m.id).sort();
      const selectedModIds = selectedModifiers.map((m: any) => m.id).sort();
      return cartModIds.every((id: string, idx: number) => id === selectedModIds[idx]);
    });
  }, [cartItems, safeItemId, selectedModifiers]);

  if (!isOpen || !item) return null;

  const effectiveQuantity = existingCartItem ? existingCartItem.quantity : quantity;

  const modifierTotal = selectedModifiers.reduce((sum: number, modifier: NormalizedModifier) => sum + Number(modifier?.priceAdjustment || 0), 0);
  const totalPerPlate = safeBasePrice + modifierTotal;
  const currentTotal = totalPerPlate * effectiveQuantity;
  const selectedModifierCount = selectedModifiers.length;

  const toggleModifier = (group: any, modifier: any) => {
    setValidationError(null);
    setSelectedByGroup((prev: any) => {
      const currentGroupSelection = Array.isArray(prev[group.id]) ? prev[group.id] : [];
      const alreadySelected = currentGroupSelection.some((entry: any) => entry.id === modifier.id);

      if (alreadySelected) {
        if (group.isRequired && currentGroupSelection.length === 1 && group.minSelections >= 1) {
          return prev; 
        }
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
        setValidationError(`You can select up to ${group.maxSelections} for ${group.name}`);
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
      return selectedCount < group.minSelections;
    });

    if (invalidGroup) {
      setValidationError(`Please select at least ${invalidGroup.minSelections} for ${invalidGroup.name}`);
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
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center sm:items-center sm:p-5">
      <div 
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px] transition-opacity duration-300" 
        onClick={handleClose} 
      />

      <div
        className="relative mx-auto flex h-auto max-h-[76dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[28px] shadow-2xl slide-up sm:max-h-[80dvh] sm:rounded-[30px]"
        style={{ background: 'var(--surface)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute left-0 right-0 top-0 z-[70] flex justify-center py-3 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-800" />
        </div>

        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-[90] flex h-11 w-11 items-center justify-center rounded-full border bg-slate-950/55 text-white shadow-lg backdrop-blur-md transition-all active:scale-90 sm:right-5 sm:top-5"
          style={{ borderColor: 'rgba(255,255,255,0.14)' }}
        >
          <X size={18} />
        </button>

        <div className="flex max-h-[76dvh] min-h-0 flex-col sm:grid sm:max-h-[80dvh] sm:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[360px_minmax(0,1fr)]">
          <div
            className="relative flex min-h-[152px] flex-col justify-end overflow-hidden border-b sm:min-h-0 sm:border-b-0 sm:border-r"
            style={{ borderColor: 'var(--border)', background: 'linear-gradient(180deg, rgba(15,23,42,0.06), rgba(15,23,42,0.18))' }}
          >
            <div className="sm:hidden relative z-10 px-4 pb-4 pt-12">
              <div className="flex items-end gap-3">
                <div
                  className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-[24px] border"
                  style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'var(--surface-3)' }}
                >
                  {safeImageUrl && !imageLoadFailed ? (
                    <img
                      src={safeImageUrl}
                      key={safeImageUrl}
                      alt={safeName}
                      className="h-full w-full object-cover"
                      onError={handleImageError}
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-[10px] font-black uppercase tracking-[0.16em]"
                      style={{ color: 'var(--text-3)' }}
                    >
                      Food
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {item?.isVeg ? (
                      <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-green-600 bg-white p-[2px]">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-600" />
                      </div>
                    ) : item?.isEgg ? (
                      <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-orange-600 bg-white p-[2px]">
                        <div className="h-1.5 w-1.5 rounded-full bg-orange-600" />
                      </div>
                    ) : (
                      <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-red-600 bg-white p-[2px]">
                        <div className="h-1.5 w-1.5 rounded-full bg-red-600" />
                      </div>
                    )}
                    {normalizedGroups.length > 0 ? (
                      <span
                        className="rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em]"
                        style={{ borderColor: 'rgba(249,115,22,0.22)', background: 'rgba(249,115,22,0.1)', color: 'var(--brand)' }}
                      >
                        Customizable
                      </span>
                    ) : null}
                  </div>

                  <h2 className="truncate text-[1.6rem] font-black leading-none tracking-tight" style={{ color: 'var(--text-1)' }}>
                    {safeName}
                  </h2>
                  {safeDescription ? (
                    <p
                      className="mt-1 text-[13px] font-medium leading-relaxed"
                      style={{
                        color: 'var(--text-3)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {safeDescription}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-lg font-black" style={{ color: 'var(--text-1)' }}>
                      {formatINR(safeBasePrice)}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em]"
                      style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
                    >
                      {selectedModifierCount > 0 ? `${selectedModifierCount} selected` : 'Add options'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {safeImageUrl && !imageLoadFailed ? (
              <>
                <img
                  src={safeImageUrl}
                  key={safeImageUrl}
                  alt={safeName}
                  className="absolute inset-0 hidden h-full w-full object-cover transition-transform duration-700 sm:block sm:hover:scale-105"
                  onError={handleImageError}
                />
                <div className="absolute inset-0 hidden sm:block sm:bg-gradient-to-t sm:from-slate-950/90 sm:via-slate-950/25 sm:to-transparent" />
              </>
            ) : (
              <div
                className="absolute inset-0 hidden sm:block"
                style={{ background: 'linear-gradient(135deg, var(--brand-soft), rgba(15,23,42,0.14))' }}
              />
            )}

            <div className="relative z-10 hidden px-5 pb-5 pt-14 sm:block sm:px-6 sm:pb-6 sm:pt-16">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {item?.isVeg ? (
                  <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-green-600 bg-white p-[2px]">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-600" />
                  </div>
                ) : item?.isEgg ? (
                  <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-orange-600 bg-white p-[2px]">
                    <div className="h-1.5 w-1.5 rounded-full bg-orange-600" />
                  </div>
                ) : (
                  <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-red-600 bg-white p-[2px]">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-600" />
                  </div>
                )}
                <span
                  className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/90"
                  style={{ borderColor: 'rgba(255,255,255,0.18)', background: 'rgba(15,23,42,0.26)' }}
                >
                  {item?.isVeg ? 'Veg' : item?.isEgg ? 'Egg' : 'Non-Veg'}
                </span>
                {normalizedGroups.length > 0 ? (
                  <span
                    className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
                    style={{ borderColor: 'rgba(251,146,60,0.25)', background: 'rgba(251,146,60,0.16)', color: '#fdba74' }}
                  >
                    Customizable
                  </span>
                ) : null}
              </div>

              <h2 className="max-w-[15ch] text-[2rem] font-black tracking-tight text-white">
                {safeName}
              </h2>
              {safeDescription ? (
                <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-white/72">
                  {safeDescription}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="text-2xl font-black text-white">{formatINR(safeBasePrice)}</span>
                <span
                  className="rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white/75"
                  style={{ borderColor: 'rgba(255,255,255,0.14)', background: 'rgba(15,23,42,0.22)' }}
                >
                  {selectedModifierCount > 0 ? `${selectedModifierCount} add-ons selected` : 'Customize before checkout'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col bg-[color:var(--surface)]">
            <div
              className="custom-scrollbar flex-1 overflow-y-auto overscroll-contain touch-pan-y px-4 pb-[7rem] pt-3 sm:px-0 sm:pb-[8rem] sm:pt-0"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {normalizedGroups.length > 0 ? (
                <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
                  {normalizedGroups.map((group: NormalizedGroup) => {
                    const groupSelection = selectedByGroup[group.id] || [];
                    const isSingle = group.maxSelections === 1;

                    return (
                      <div key={group.id} className="px-2 py-4 sm:px-6 sm:py-5">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-[15px] font-black tracking-tight sm:text-base" style={{ color: 'var(--text-1)' }}>
                                {group.name}
                              </h3>
                              {group.isRequired ? (
                                <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-600">
                                  Required
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--text-3)' }}>
                              {isSingle ? 'Choose 1' : `Choose up to ${group.maxSelections}`}
                            </p>
                          </div>
                          <span
                            className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                            style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
                          >
                            {groupSelection.length}/{group.maxSelections}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {group.modifiers.map((modifier: NormalizedModifier) => {
                            const isSelected = groupSelection.some((entry: any) => entry.id === modifier.id);
                            return (
                              <button
                                key={modifier.id}
                                onClick={() => toggleModifier(group, modifier)}
                                className="flex w-full items-center justify-between rounded-2xl border px-3.5 py-3 text-left transition-all active:scale-[0.99]"
                                style={{
                                  borderColor: isSelected ? 'rgba(249,115,22,0.28)' : 'var(--border)',
                                  background: isSelected ? 'rgba(249,115,22,0.08)' : 'var(--surface)',
                                }}
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <div
                                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center border-2 transition-all ${
                                      isSingle ? 'rounded-full' : 'rounded-md'
                                    }`}
                                    style={{
                                      borderColor: isSelected ? 'var(--brand)' : '#cbd5e1',
                                      background: isSelected ? 'var(--brand)' : 'transparent',
                                    }}
                                  >
                                    {isSelected && !isSingle ? (
                                      <div className="h-2.5 w-1.5 rotate-45 border-b-2 border-r-2 border-white" />
                                    ) : null}
                                    {isSelected && isSingle ? <div className="h-2 w-2 rounded-full bg-white" /> : null}
                                  </div>
                                  <div className="min-w-0">
                                    <span
                                      className="block truncate text-sm font-black"
                                      style={{ color: isSelected ? 'var(--brand)' : 'var(--text-2)' }}
                                    >
                                      {modifier.name}
                                    </span>
                                    {modifier.isDefault ? (
                                      <span className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                                        Default choice
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                {modifier.priceAdjustment > 0 ? (
                                  <span className="ml-3 flex-shrink-0 text-[13px] font-black" style={{ color: 'var(--text-2)' }}>
                                    + {formatINR(modifier.priceAdjustment)}
                                  </span>
                                ) : (
                                  <span className="ml-3 flex-shrink-0 text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                                    Included
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-2 py-4 sm:px-6 sm:py-5">
                  <div
                    className="rounded-[28px] border px-5 py-5"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-3)' }}
                  >
                    <p className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: 'var(--text-3)' }}>
                      Quick add
                    </p>
                    <p className="mt-2 text-sm font-medium leading-relaxed" style={{ color: 'var(--text-2)' }}>
                      No add-ons are available for this dish, but you can still add a note for the kitchen below.
                    </p>
                  </div>
                </div>
              )}

              <div className="px-2 pb-2 pt-3 sm:px-6">
                <div
                  className="rounded-[28px] border p-4 sm:p-5"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-3)' }}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[15px] font-black tracking-tight sm:text-base" style={{ color: 'var(--text-1)' }}>
                        Special instructions
                      </h3>
                      <p className="mt-1 text-xs font-medium leading-relaxed" style={{ color: 'var(--text-3)' }}>
                        Mention allergies, spice level, or any small kitchen request.
                      </p>
                    </div>
                    {notes.trim() ? (
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                        style={{ background: 'rgba(249,115,22,0.12)', color: 'var(--brand)' }}
                      >
                        Added
                      </span>
                    ) : null}
                  </div>

                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="No onion, less spicy, serve together, allergy note..."
                    className="min-h-[88px] w-full rounded-2xl border p-4 text-sm font-bold outline-none transition-all placeholder:font-semibold placeholder:opacity-45"
                    style={{ background: 'var(--surface)', color: 'var(--text-1)', borderColor: 'var(--border)' }}
                  />
                </div>
              </div>
            </div>

            {validationError ? (
              <div className="pointer-events-none absolute bottom-[6.75rem] left-4 right-4 z-[95] animate-in fade-in slide-in-from-bottom-4 sm:bottom-28 sm:left-auto sm:right-6 sm:w-[320px]">
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-2xl">
                  <div className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                  {validationError}
                </div>
              </div>
            ) : null}

            <div
              className="sticky bottom-0 left-0 right-0 z-[80] border-t px-4 pt-4 sm:px-6"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                boxShadow: '0 -18px 36px rgba(2, 6, 23, 0.12)',
                paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 0.35rem))',
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div
                  className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 sm:min-w-[148px] sm:justify-start"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-3)' }}
                >
                  <button
                    onClick={() => {
                      if (existingCartItem) {
                        if (existingCartItem.quantity > 1) {
                          updateQuantity(existingCartItem.id, existingCartItem.quantity - 1);
                        } else {
                          removeItem(existingCartItem.id);
                        }
                      } else {
                        setQuantity(Math.max(1, quantity - 1));
                      }
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm transition-all active:scale-90 dark:bg-slate-700"
                  >
                    <Minus size={14} className="text-slate-900 dark:text-white" />
                  </button>
                  <div className="text-center">
                    <span className="block text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--text-3)' }}>
                      Qty
                    </span>
                    <span className="block text-lg font-black" style={{ color: 'var(--text-1)' }}>
                      {effectiveQuantity}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (existingCartItem) {
                        updateQuantity(existingCartItem.id, existingCartItem.quantity + 1);
                      } else {
                        setQuantity(quantity + 1);
                      }
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm transition-all active:scale-90 dark:bg-slate-700"
                  >
                    <Plus size={14} className="text-slate-900 dark:text-white" />
                  </button>
                </div>

                <button
                  onClick={() => {
                    if (existingCartItem) {
                      handleClose();
                      return;
                    }
                    handleAdd();
                  }}
                  className="flex flex-1 items-center justify-between rounded-2xl px-5 py-4 font-black text-white transition-all active:scale-[0.98]"
                  style={{ background: 'var(--brand)' }}
                >
                  <div className="flex flex-col items-start leading-tight">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Total</span>
                    <span className="text-lg">{formatINR(currentTotal)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>{existingCartItem ? 'Done' : 'Add to order'}</span>
                    <ChevronRight size={18} />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
