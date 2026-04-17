import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import { ArrowRight, BadgeCheck, Phone, ReceiptText, RefreshCw, Search, ShoppingBag, Sparkles, Users, X } from 'lucide-react';
import { api } from '../lib/api';
import { formatINR } from '../lib/currency';
import { getCustomerAppUrl } from '../lib/network';

type AssistedMode = 'SEND_TO_KITCHEN' | 'DIRECT_BILL';

type AssistedLineModifier = {
  id: string;
  name: string;
  groupName: string;
  priceAdjustment: number;
};

type AssistedLineItem = {
  id: string;
  menuItemId: string;
  name: string;
  basePrice: number;
  quantity: number;
  notes: string;
  selectedModifierIds: string[];
  selectedModifiers: AssistedLineModifier[];
  lineTotal: number;
};

type AssistedResult = {
  billPath?: string | null;
  invoiceNumber?: string | null;
  sessionId?: string;
  paymentStatus?: string | null;
  source?: string;
};

function readPrice(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function hasModifiers(item: any) {
  return Array.isArray(item?.modifierGroups) && item.modifierGroups.some((group: any) => {
    const resolvedGroup = group?.modifierGroup || group;
    return resolvedGroup?.id && Array.isArray(resolvedGroup?.modifiers) && resolvedGroup.modifiers.length > 0;
  });
}

function buildLineTotal(basePrice: number, quantity: number, modifiers: AssistedLineModifier[]) {
  const modifierTotal = modifiers.reduce((sum, modifier) => sum + readPrice(modifier.priceAdjustment), 0);
  return (basePrice + modifierTotal) * Math.max(1, quantity);
}

function normalizeModifierGroups(item: any) {
  return Array.isArray(item?.modifierGroups)
    ? item.modifierGroups.map((group: any) => group?.modifierGroup || group).filter((group: any) => group?.id)
    : [];
}

function AssistedItemModal({
  item,
  onClose,
  onAdd,
}: {
  item: any;
  onClose: () => void;
  onAdd: (lineItem: AssistedLineItem) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState('');
  const [selectedModifierIds, setSelectedModifierIds] = useState<Record<string, string[]>>(() => {
    const next: Record<string, string[]> = {};
    normalizeModifierGroups(item).forEach((group: any) => {
      const defaults = (group.modifiers || [])
        .filter((modifier: any) => modifier?.isDefault)
        .map((modifier: any) => String(modifier.id))
        .slice(0, Math.max(1, Number(group.maxSelections || 1)));
      if (defaults.length > 0) next[group.id] = defaults;
    });
    return next;
  });

  const normalizedGroups = useMemo(() => normalizeModifierGroups(item), [item]);
  const selectedModifiers = useMemo(
    () =>
      normalizedGroups.flatMap((group: any) =>
        (group.modifiers || [])
          .filter((modifier: any) => (selectedModifierIds[group.id] || []).includes(String(modifier.id)))
          .map((modifier: any) => ({
            id: String(modifier.id),
            name: String(modifier.name || 'Option'),
            groupName: String(group.name || 'Options'),
            priceAdjustment: readPrice(modifier.priceAdjustment),
          })),
      ),
    [normalizedGroups, selectedModifierIds],
  );

  const basePrice = readPrice(item?.price);
  const total = buildLineTotal(basePrice, quantity, selectedModifiers);

  const toggleModifier = (group: any, modifier: any) => {
    const current = selectedModifierIds[group.id] || [];
    const modifierId = String(modifier.id);
    const maxSelections = Math.max(1, Number(group.maxSelections || 1));
    if (current.includes(modifierId)) {
      setSelectedModifierIds((previous) => ({ ...previous, [group.id]: current.filter((entry) => entry !== modifierId) }));
      return;
    }
    if (maxSelections === 1) {
      setSelectedModifierIds((previous) => ({ ...previous, [group.id]: [modifierId] }));
      return;
    }
    if (current.length >= maxSelections) {
      setValidationError(`Choose up to ${maxSelections} options for ${group.name}.`);
      return;
    }
    setSelectedModifierIds((previous) => ({ ...previous, [group.id]: [...current, modifierId] }));
  };

  const handleAdd = () => {
    const invalidGroup = normalizedGroups.find((group: any) => {
      const selectedCount = (selectedModifierIds[group.id] || []).length;
      const minSelections = Math.max(0, Number(group.minSelections || 0));
      const maxSelections = Math.max(1, Number(group.maxSelections || 1));
      return selectedCount < minSelections || selectedCount > maxSelections;
    });

    if (invalidGroup) {
      setValidationError(`Complete the required choices for ${invalidGroup.name}.`);
      return;
    }

    onAdd({
      id: `assisted_${item.id}_${Date.now()}`,
      menuItemId: String(item.id),
      name: String(item.name || 'Item'),
      basePrice,
      quantity,
      notes: notes.trim(),
      selectedModifierIds: selectedModifiers.map((modifier: AssistedLineModifier) => modifier.id),
      selectedModifiers,
      lineTotal: total,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border shadow-2xl" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-start justify-between gap-4 border-b px-6 py-5" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>Assisted item setup</p>
            <h3 className="mt-2 text-2xl font-black" style={{ color: 'var(--text-1)' }}>{item?.name || 'Customize item'}</h3>
            <p className="mt-2 text-sm font-medium" style={{ color: 'var(--text-2)' }}>Server-side pricing is recalculated before the order is saved.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}>
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-5 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-5">
              {normalizedGroups.map((group: any) => (
                <section key={group.id} className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-black" style={{ color: 'var(--text-1)' }}>{group.name}</h4>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-3)' }}>
                        Choose {Math.max(0, Number(group.minSelections || 0))} to {Math.max(1, Number(group.maxSelections || 1))}
                      </p>
                    </div>
                    <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]" style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}>
                      {(selectedModifierIds[group.id] || []).length} selected
                    </span>
                  </div>
                  <div className="grid gap-3">
                    {(group.modifiers || []).map((modifier: any) => {
                      const selected = (selectedModifierIds[group.id] || []).includes(String(modifier.id));
                      return (
                        <button
                          key={modifier.id}
                          type="button"
                          onClick={() => toggleModifier(group, modifier)}
                          className="flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all"
                          style={{ borderColor: selected ? 'var(--brand)' : 'var(--border)', background: selected ? 'var(--brand-soft)' : 'var(--surface)' }}
                        >
                          <div>
                            <p className="text-sm font-black" style={{ color: selected ? 'var(--brand)' : 'var(--text-1)' }}>{modifier.name}</p>
                            {modifier.isDefault ? <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-3)' }}>Default suggestion</p> : null}
                          </div>
                          <span className="text-xs font-black" style={{ color: selected ? 'var(--brand)' : 'var(--text-2)' }}>
                            {readPrice(modifier.priceAdjustment) > 0 ? `+${formatINR(readPrice(modifier.priceAdjustment))}` : 'Included'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            <div className="space-y-4">
              <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>Quantity</p>
                <div className="mt-3 flex items-center gap-3 rounded-2xl px-2 py-2" style={{ background: 'var(--surface-3)' }}>
                  <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--surface)', color: 'var(--text-1)' }}>-</button>
                  <span className="flex-1 text-center text-2xl font-black" style={{ color: 'var(--text-1)' }}>{quantity}</span>
                  <button type="button" onClick={() => setQuantity((current) => current + 1)} className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--surface)', color: 'var(--text-1)' }}>+</button>
                </div>
              </section>
              <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>Item note</p>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Kitchen note or customer preference" className="mt-3 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-1)' }} />
              </section>
              <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>Preview total</p>
                <p className="mt-3 text-3xl font-black" style={{ color: 'var(--brand)' }}>{formatINR(total)}</p>
                {validationError ? <p className="mt-3 text-sm font-bold text-red-500">{validationError}</p> : null}
              </section>
            </div>
          </div>
        </div>
        <div className="border-t px-6 py-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <button type="button" onClick={handleAdd} className="w-full rounded-2xl px-5 py-4 text-base font-black text-white" style={{ background: 'var(--brand)' }}>
            Add to assisted order
          </button>
        </div>
      </div>
    </div>
  );
}

export function AssistedOrderingPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [note, setNote] = useState('');
  const [seat, setSeat] = useState('');
  const [guestCount, setGuestCount] = useState(1);
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY' | 'ZOMATO' | 'SWIGGY'>('TAKEAWAY');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [fulfillmentMode, setFulfillmentMode] = useState<AssistedMode>('SEND_TO_KITCHEN');
  const [paymentPreset, setPaymentPreset] = useState<'UNPAID' | 'cash' | 'upi' | 'card' | 'online'>('UNPAID');
  const [lineItems, setLineItems] = useState<AssistedLineItem[]>([]);
  const [activeModalItem, setActiveModalItem] = useState<any | null>(null);
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookupError, setLookupError] = useState('');
  const [result, setResult] = useState<AssistedResult | null>(null);
  const { features } = usePlanFeatures();

  const { data: business } = useQuery({
    queryKey: ['settings-business'],
    queryFn: async () => (await api.get('/settings/business')).data,
    staleTime: 1000 * 60,
  });

  const { data: zonesResponse } = useQuery({
    queryKey: ['assist-order-zones'],
    queryFn: async () => (await api.get('/venue/zones')).data,
    staleTime: 1000 * 60,
  });

  const { data: menuResponse, isLoading: menuLoading, refetch: refetchMenu } = useQuery({
    queryKey: ['assist-order-menu', business?.slug],
    queryFn: async () => (await api.get(`/public/${business.slug}/menu`)).data,
    enabled: Boolean(business?.slug),
    staleTime: 1000 * 60,
  });

  const lookupMutation = useMutation({
    mutationFn: async (phone: string) => (await api.get('/orders/assisted/customer-lookup', { params: { phone } })).data,
    onSuccess: (data) => {
      setLookupResult(data?.customer || null);
      setLookupError('');
      if (data?.customer?.name && !customerName.trim()) {
        setCustomerName(String(data.customer.name));
      }
    },
    onError: (error: any) => {
      setLookupResult(null);
      setLookupError(error?.response?.data?.error || 'Customer lookup failed.');
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/orders/assisted', {
          customerName,
          customerPhone,
          note,
          seat,
          guestCount,
          orderType,
          tableId: orderType === 'DINE_IN' ? selectedTableId : undefined,
          fulfillmentMode,
          markPaid: fulfillmentMode === 'DIRECT_BILL' && paymentPreset !== 'UNPAID',
          paymentMethod: fulfillmentMode === 'DIRECT_BILL' && paymentPreset !== 'UNPAID' ? paymentPreset : undefined,
          items: lineItems.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            notes: item.notes || undefined,
            selectedModifierIds: item.selectedModifierIds,
          })),
        })
      ).data,
    onSuccess: (data) => {
      setResult(data);
      setLineItems([]);
      setNote('');
      setSeat('');
      setGuestCount(1);
      setSelectedTableId('');
      setPaymentPreset('UNPAID');
    },
  });

  const categories = useMemo(
    () => (Array.isArray(menuResponse?.categories) ? menuResponse.categories : []),
    [menuResponse?.categories],
  );

  const allTables = useMemo(
    () =>
      (Array.isArray(zonesResponse?.zones) ? zonesResponse.zones : []).flatMap((zone: any) =>
        (Array.isArray(zone?.tables) ? zone.tables : []).map((table: any) => ({ ...table, zoneName: zone.name })),
      ),
    [zonesResponse?.zones],
  );

  const filteredCategories = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return categories
      .filter((category: any) => selectedCategory === 'ALL' || category.id === selectedCategory)
      .map((category: any) => ({
        ...category,
        menuItems: (Array.isArray(category?.menuItems) ? category.menuItems : []).filter((item: any) => {
          if (!normalizedSearch) return true;
          const haystack = [item?.name, item?.description, ...(Array.isArray(item?.tags) ? item.tags : [])]
            .map((entry) => String(entry || '').toLowerCase())
            .join(' ');
          return haystack.includes(normalizedSearch);
        }),
      }))
      .filter((category: any) => category.menuItems.length > 0);
  }, [categories, search, selectedCategory]);

  const previewSubtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + readPrice(item.lineTotal), 0),
    [lineItems],
  );
  const previewTax = useMemo(
    () => previewSubtotal * (readPrice(menuResponse?.taxRate) / 100),
    [menuResponse?.taxRate, previewSubtotal],
  );
  const previewTotal = previewSubtotal + previewTax;
  const billUrl = result?.billPath ? `${getCustomerAppUrl()}${result.billPath}` : '';

  const addSimpleItem = (item: any) => {
    const basePrice = readPrice(item?.price);
    setLineItems((current) => [
      ...current,
      {
        id: `assisted_${item.id}_${Date.now()}`,
        menuItemId: String(item.id),
        name: String(item.name || 'Item'),
        basePrice,
        quantity: 1,
        notes: '',
        selectedModifierIds: [],
        selectedModifiers: [],
        lineTotal: basePrice,
      },
    ]);
  };

  const updateLineItemQuantity = (id: string, nextQuantity: number) => {
    setLineItems((current) =>
      nextQuantity <= 0
        ? current.filter((item) => item.id !== id)
        : current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  quantity: nextQuantity,
                  lineTotal: buildLineTotal(item.basePrice, nextQuantity, item.selectedModifiers),
                }
              : item,
          ),
    );
  };

  const totalItems = useMemo(() => lineItems.reduce((sum, item) => sum + item.quantity, 0), [lineItems]);
  const lookupAllowed = customerPhone.trim().length >= 8;

  const removeLineItem = (id: string) => {
    setLineItems((current) => current.filter((item) => item.id !== id));
  };

  const resetSession = () => {
    setResult(null);
    setLineItems([]);
    setNote('');
    setSeat('');
    setGuestCount(1);
    setSelectedTableId('');
    setPaymentPreset('UNPAID');
  };

  return (
    <div className="space-y-6 pb-10">
      <section
        className="rounded-[32px] border p-6 lg:p-8"
        style={{ borderColor: 'var(--border)', background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.9))' }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300">Staff-assisted ordering</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white lg:text-4xl">Take an order for a guest, then route it to kitchen or bill it directly.</h1>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              This mode is separate from public self-ordering. Staff can capture guest details quickly, build the basket with server-validated pricing, and choose whether the order should enter the live kitchen flow or go straight to an invoice-ready bill.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/50">Mode</p>
              <p className="mt-2 text-sm font-black text-white">{fulfillmentMode === 'DIRECT_BILL' ? 'Direct bill' : 'Kitchen workflow'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/50">Guest</p>
              <p className="mt-2 text-sm font-black text-white">{customerName.trim() || 'Walk-in guest'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/50">Preview total</p>
              <p className="mt-2 text-sm font-black text-white">{formatINR(previewTotal)}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.35fr,0.65fr]">
        <div className="space-y-6">
          <section className="rounded-[28px] border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--text-3)' }}>Guest intake</p>
                <h2 className="mt-2 text-xl font-black" style={{ color: 'var(--text-1)' }}>Capture customer details before ordering.</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                 <button
                  type="button"
                  onClick={() => setFulfillmentMode('SEND_TO_KITCHEN')}
                  className={`rounded-full px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${fulfillmentMode === 'SEND_TO_KITCHEN' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 ring-2 ring-blue-500/10' : 'bg-transparent border'}`}
                  style={fulfillmentMode === 'SEND_TO_KITCHEN' ? {} : { borderColor: 'var(--border)', color: 'var(--text-3)' }}
                >
                  Send to kitchen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (features.hasAssistedDirectBill) {
                      setFulfillmentMode('DIRECT_BILL');
                    } else {
                      window.alert(`Direct billing is a ${features.name === 'Mini' ? 'Café' : 'Pro'} feature. Please upgrade your plan.`);
                    }
                  }}
                  className={`rounded-full px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 relative overflow-hidden group ${fulfillmentMode === 'DIRECT_BILL' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 ring-2 ring-blue-500/10' : 'bg-transparent border'}`}
                  style={fulfillmentMode === 'DIRECT_BILL' ? {} : { borderColor: 'var(--border)', color: 'var(--text-3)', opacity: features.hasAssistedDirectBill ? 1 : 0.6 }}
                >
                  {!features.hasAssistedDirectBill && <span className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />}
                  Direct bill {!features.hasAssistedDirectBill && <Sparkles size={10} className="inline ml-1 text-blue-500 animate-pulse" />}
                </button>
              </div>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                    Guest name
                    <input
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Walk-in guest"
                      className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-1)' }}
                    />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                    Mobile number
                    <div className="mt-2 flex items-center gap-2 rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                      <Phone size={16} style={{ color: 'var(--text-3)' }} />
                      <input
                        value={customerPhone}
                        onChange={(event) => setCustomerPhone(event.target.value)}
                        placeholder="10-digit phone"
                        className="w-full bg-transparent text-sm font-semibold outline-none"
                        style={{ color: 'var(--text-1)' }}
                      />
                      <button
                        type="button"
                        disabled={!lookupAllowed || lookupMutation.isPending || !features.hasAssistedCustomerLookup}
                        onClick={() => {
                          if (features.hasAssistedCustomerLookup) {
                            lookupMutation.mutate(customerPhone);
                          } else {
                            window.alert('Returning guest insights are only available on the DinePro plan.');
                          }
                        }}
                        className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] transition-all relative overflow-hidden group shadow-md ${lookupAllowed && features.hasAssistedCustomerLookup ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-60'}`}
                      >
                        {lookupMutation.isPending ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <>
                            {features.hasAssistedCustomerLookup ? 'Lookup' : 'Pro Gated'}
                            {!features.hasAssistedCustomerLookup && <Sparkles size={10} className="ml-1.5 inline text-blue-500" />}
                          </>
                        )}
                      </button>
                    </div>
                  </label>
                </div>
                {lookupError ? <p className="text-sm font-semibold text-red-500">{lookupError}</p> : null}
                {lookupResult ? (
                  <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>{lookupResult.name || 'Known guest'}</p>
                        <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Visits: {lookupResult.visitCount || 0}</p>
                      </div>
                      <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]" style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}>
                        Returning
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
                      <span>Last visit: {lookupResult.lastSessionAt ? new Date(lookupResult.lastSessionAt).toLocaleDateString() : 'Unknown'}</span>
                      <span>Last table: {lookupResult.lastTableName || 'N/A'}</span>
                      <span>Last source: {lookupResult.lastSource || 'N/A'}</span>
                    </div>
                  </div>
                ) : null}
                <label className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                  Guest note
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Allergies, seating note, delivery detail"
                    rows={3}
                    className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-1)' }}
                  />
                </label>
              </div>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                    Order type
                    <select
                      value={orderType}
                      onChange={(event) => setOrderType(event.target.value as any)}
                      className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-1)' }}
                    >
                      <option value="TAKEAWAY">Takeaway (T-)</option>
                      <option value="DINE_IN">Dine in (D-)</option>
                      <option value="ZOMATO">Zomato (Z-)</option>
                      <option value="SWIGGY">Swiggy (S-)</option>
                    </select>
                  </label>
                  <label className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                    Guest count
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={guestCount}
                      onChange={(event) => setGuestCount(Math.max(1, Math.min(24, Number(event.target.value) || 1)))}
                      className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-1)' }}
                    />
                  </label>
                </div>
                <label className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                  Table selection
                  <select
                    value={selectedTableId}
                    onChange={(event) => setSelectedTableId(event.target.value)}
                    disabled={orderType !== 'DINE_IN'}
                    className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none disabled:opacity-60"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-1)' }}
                  >
                    <option value="">Select table</option>
                    {allTables.map((table: any) => (
                      <option key={table.id} value={table.id}>
                        {table.zoneName ? `${table.zoneName} • ` : ''}{table.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                  Seat / reference
                  <input
                    value={seat}
                    onChange={(event) => setSeat(event.target.value)}
                    placeholder="Seat or counter info"
                    className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-1)' }}
                  />
                </label>
                {fulfillmentMode === 'DIRECT_BILL' ? (
                  <label className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                    Payment status
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {[
                        { value: 'UNPAID', label: 'Unpaid' },
                        { value: 'cash', label: 'Cash' },
                        { value: 'upi', label: 'UPI' },
                        { value: 'card', label: 'Card' },
                        { value: 'online', label: 'Online' },
                      ].map((entry) => (
                        <button
                          key={entry.value}
                          type="button"
                          onClick={() => setPaymentPreset(entry.value as any)}
                          className="rounded-2xl border px-4 py-3 text-left text-xs font-black uppercase tracking-[0.14em]"
                          style={{ borderColor: paymentPreset === entry.value ? 'var(--brand)' : 'var(--border)', background: paymentPreset === entry.value ? 'var(--brand-soft)' : 'var(--bg)', color: paymentPreset === entry.value ? 'var(--brand)' : 'var(--text-2)' }}
                        >
                          {entry.label}
                        </button>
                      ))}
                    </div>
                  </label>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--text-3)' }}>Menu selection</p>
                <h2 className="mt-2 text-xl font-black" style={{ color: 'var(--text-1)' }}>Find items fast and build the order with modifiers.</h2>
              </div>
              <button
                type="button"
                onClick={() => refetchMenu()}
                className="flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.18em]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
              >
                <RefreshCw size={14} />
                Refresh menu
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="flex flex-1 items-center gap-2 rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                <Search size={16} style={{ color: 'var(--text-3)' }} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search dish, tag, or modifier"
                  className="w-full bg-transparent text-sm font-semibold outline-none"
                  style={{ color: 'var(--text-1)' }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  className="rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em]"
                  style={{ background: selectedCategory === 'ALL' ? 'var(--brand)' : 'var(--surface-3)', color: selectedCategory === 'ALL' ? 'white' : 'var(--text-2)' }}
                >
                  All
                </button>
                {categories.map((category: any) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategory(category.id)}
                    className="rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em]"
                    style={{ background: selectedCategory === category.id ? 'var(--brand)' : 'var(--surface-3)', color: selectedCategory === category.id ? 'white' : 'var(--text-2)' }}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {menuLoading ? (
                <div className="rounded-3xl border px-4 py-6 text-center text-sm font-semibold" style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-2)' }}>
                  Loading menu items...
                </div>
              ) : null}
              {!menuLoading && filteredCategories.length === 0 ? (
                <div className="rounded-3xl border px-4 py-6 text-center text-sm font-semibold" style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-2)' }}>
                  No menu items match this search.
                </div>
              ) : null}
              {filteredCategories.map((category: any) => (
                <div key={category.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black" style={{ color: 'var(--text-1)' }}>{category.name}</h3>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>{category.menuItems.length} items</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {category.menuItems.map((item: any) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => (hasModifiers(item) ? setActiveModalItem(item) : addSimpleItem(item))}
                        className="flex h-full flex-col justify-between rounded-3xl border p-4 text-left transition-all hover:-translate-y-0.5"
                        style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-black" style={{ color: 'var(--text-1)' }}>{item.name}</p>
                              <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--text-2)' }}>{item.description || 'No description provided.'}</p>
                            </div>
                            <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]" style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}>
                              {item.isVeg ? 'Veg' : 'Non-veg'}
                            </span>
                          </div>
                          {Array.isArray(item.tags) && item.tags.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {item.tags.slice(0, 3).map((tag: string) => (
                                <span key={tag} className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-sm font-black" style={{ color: 'var(--text-1)' }}>{formatINR(readPrice(item.price))}</span>
                          <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--brand)' }}>
                            {hasModifiers(item) ? <Sparkles size={14} /> : <ShoppingBag size={14} />}
                            {hasModifiers(item) ? 'Customize' : 'Add'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[28px] border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--text-3)' }}>Order summary</p>
                <h2 className="mt-2 text-xl font-black" style={{ color: 'var(--text-1)' }}>Items in this assisted order</h2>
              </div>
              <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]" style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}>
                {totalItems} items
              </span>
            </div>
            <div className="mt-4 space-y-4">
              {lineItems.length === 0 ? (
                <div className="rounded-3xl border px-4 py-6 text-center text-sm font-semibold" style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-2)' }}>
                  Add menu items to start building the assisted order.
                </div>
              ) : null}
              {lineItems.map((item) => (
                <div key={item.id} className="rounded-3xl border px-4 py-4" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>{item.name}</p>
                      <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--text-2)' }}>{formatINR(item.basePrice)} base</p>
                    </div>
                    <button type="button" onClick={() => removeLineItem(item.id)} className="rounded-full p-2" style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}>
                      <X size={14} />
                    </button>
                  </div>
                  {item.selectedModifiers.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.selectedModifiers.map((modifier) => (
                        <span key={modifier.id} className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}>
                          {modifier.groupName}: {modifier.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {item.notes ? <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Note: {item.notes}</p> : null}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 rounded-full px-2 py-1" style={{ background: 'var(--surface-3)' }}>
                      <button type="button" onClick={() => updateLineItemQuantity(item.id, item.quantity - 1)} className="h-7 w-7 rounded-full text-sm font-black" style={{ background: 'var(--surface)', color: 'var(--text-1)' }}>-</button>
                      <span className="w-6 text-center text-sm font-black" style={{ color: 'var(--text-1)' }}>{item.quantity}</span>
                      <button type="button" onClick={() => updateLineItemQuantity(item.id, item.quantity + 1)} className="h-7 w-7 rounded-full text-sm font-black" style={{ background: 'var(--surface)', color: 'var(--text-1)' }}>+</button>
                    </div>
                    <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>{formatINR(item.lineTotal)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-3 rounded-3xl border px-4 py-4" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
              <div className="flex items-center justify-between text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                <span>Subtotal</span>
                <span>{formatINR(previewSubtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                <span>Tax ({readPrice(menuResponse?.taxRate)}%)</span>
                <span>{formatINR(previewTax)}</span>
              </div>
              <div className="flex items-center justify-between text-base font-black" style={{ color: 'var(--text-1)' }}>
                <span>Total</span>
                <span>{formatINR(previewTotal)}</span>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={lineItems.length === 0 || submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
                className="flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-black text-white disabled:opacity-60"
                style={{ background: 'var(--brand)' }}
              >
                <ReceiptText size={16} />
                {submitMutation.isPending ? 'Submitting...' : fulfillmentMode === 'DIRECT_BILL' ? 'Generate bill now' : 'Send order to kitchen'}
              </button>
              <button
                type="button"
                disabled={lineItems.length === 0}
                onClick={resetSession}
                className="rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[0.14em] disabled:opacity-60"
                style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
              >
                Clear order
              </button>
              {submitMutation.isError ? (
                <p className="text-sm font-semibold text-red-500">{(submitMutation.error as any)?.response?.data?.error || 'Failed to submit assisted order.'}</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-[2.5rem] border p-8 shadow-2xl transition-all hover:shadow-blue-500/5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>Assisted output</p>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            </div>
            <h3 className="text-xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>Realtime status & details</h3>
            <div className="mt-3 space-y-3 rounded-3xl border px-4 py-4" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
              {result ? (
                <>
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                    <BadgeCheck size={16} />
                    Assisted order created.
                  </div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>Session: {result.sessionId || 'Active'}</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>Payment: {result.paymentStatus || (fulfillmentMode === 'DIRECT_BILL' ? 'UNPAID' : 'Kitchen flow')}</p>
                  {billUrl ? (
                    <a href={billUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-black" style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}>
                      Open bill view
                      <ArrowRight size={16} />
                    </a>
                  ) : null}
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                  <Users size={16} />
                  Create an assisted order to see the bill link and session details.
                </div>
              )}
            </div>
            <div className="mt-4 rounded-3xl border px-4 py-4" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
              <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>Assisted notes</p>
              <ul className="mt-3 space-y-2 text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                <li className="flex items-center gap-2"><Sparkles size={14} /> Server-side pricing & taxes stay enforced.</li>
                <li className="flex items-center gap-2"><ShoppingBag size={14} /> Items flow to kitchen only in kitchen mode.</li>
                <li className="flex items-center gap-2"><ReceiptText size={14} /> Direct bill mode creates a bill immediately.</li>
              </ul>
            </div>
          </section>
        </aside>
      </div>

      {activeModalItem ? (
        <AssistedItemModal
          item={activeModalItem}
          onClose={() => setActiveModalItem(null)}
          onAdd={(lineItem) => {
            setLineItems((current) => [...current, lineItem]);
            setResult(null);
          }}
        />
      ) : null}
    </div>
  );
}
