import { useEffect, useMemo, useState, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import { 
  BadgeCheck, Phone, RefreshCw, 
  Search, ShoppingBag, Sparkles, X, Plus, Minus, 
  ChevronDown, Edit3, Image as ImageIcon
} from 'lucide-react';
import { api } from '../lib/api';
import { formatINR } from '../lib/currency';
import { getCustomerAppUrl } from '../lib/network';

// --- Types & Helpers ---
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

const generateGradient = (seed: string) => {
  const hash = Array.from(seed).reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  const h = Math.abs(hash % 360);
  return `linear-gradient(135deg, hsl(${h}, 70%, 20%), hsl(${(h + 40) % 360}, 80%, 10%))`;
};

const parseImageUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  if (url.includes('drive.google.com/file/d/')) {
    const match = url.match(/\/d\/([^/]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
  } else if (url.includes('drive.google.com/open?id=')) {
    const match = url.match(/id=([^&]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
  }
  return url;
};

// --- Sheet Component (Replaces strict Modal) ---
function ModifierSheet({
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
      setValidationError('');
      return;
    }
    if (maxSelections === 1) {
      setSelectedModifierIds((previous) => ({ ...previous, [group.id]: [modifierId] }));
      setValidationError('');
      return;
    }
    if (current.length >= maxSelections) {
      setValidationError(`Choose up to ${maxSelections} options for ${group.name}.`);
      return;
    }
    setSelectedModifierIds((previous) => ({ ...previous, [group.id]: [...current, modifierId] }));
    setValidationError('');
  };

  const handleAdd = () => {
    const invalidGroup = normalizedGroups.find((group: any) => {
      const selectedCount = (selectedModifierIds[group.id] || []).length;
      const minSelections = Math.max(0, Number(group.minSelections || 0));
      const maxSelections = Math.max(1, Number(group.maxSelections || 1));
      return selectedCount < minSelections || selectedCount > maxSelections;
    });

    if (invalidGroup) {
      setValidationError(`Complete required choices for ${invalidGroup.name}.`);
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
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full sm:max-w-xl max-h-[90vh] sm:max-h-[85vh] flex flex-col sm:rounded-3xl rounded-t-3xl bg-slate-900 border border-slate-800 shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md rounded-t-3xl z-10">
          <div>
            <h3 className="text-xl font-black text-white">{item?.name || 'Customize item'}</h3>
            <p className="text-xs font-semibold text-slate-400 mt-1">{formatINR(basePrice)} Base</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth will-change-scroll">
          
          {normalizedGroups.map((group: any) => (
            <div key={group.id} className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <h4 className="text-base font-bold text-white">{group.name}</h4>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">
                    Choose {Math.max(0, Number(group.minSelections || 0))} to {Math.max(1, Number(group.maxSelections || 1))}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {(selectedModifierIds[group.id] || []).length} Selected
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(group.modifiers || []).map((modifier: any) => {
                  const selected = (selectedModifierIds[group.id] || []).includes(String(modifier.id));
                  return (
                    <button
                      key={modifier.id}
                      type="button"
                      onClick={() => toggleModifier(group, modifier)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all active:scale-[0.98] ${
                        selected 
                          ? 'border-blue-500 bg-blue-500/10' 
                          : 'border-slate-800 bg-slate-800/50 hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-left">
                        <p className={`text-sm font-bold ${selected ? 'text-blue-400' : 'text-slate-200'}`}>
                          {modifier.name}
                        </p>
                      </div>
                      <span className={`text-xs font-black ${selected ? 'text-blue-500' : 'text-slate-400'}`}>
                        {readPrice(modifier.priceAdjustment) > 0 ? `+${formatINR(readPrice(modifier.priceAdjustment))}` : 'Incl.'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="space-y-3">
            <h4 className="text-base font-bold text-white">Item Notes</h4>
            <textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              placeholder="e.g., Extra spicy, sauce on the side" 
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              rows={2} 
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
             <span className="text-sm font-bold text-slate-300">Quantity</span>
             <div className="flex items-center gap-4 bg-slate-800 rounded-xl p-1 shadow-inner">
               <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-700/50 hover:bg-slate-700 text-white transition-colors"><Minus size={16} /></button>
               <span className="w-6 text-center text-lg font-black text-white">{quantity}</span>
               <button onClick={() => setQuantity(q => q + 1)} className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"><Plus size={16} /></button>
             </div>
          </div>
          
          {validationError && (
             <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold text-center animate-in shake">
               {validationError}
             </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-md pb-safe">
          <button 
            onClick={handleAdd}
            className="w-full flex items-center justify-between p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black transition-colors active:scale-[0.98]"
          >
            <span>Add Item</span>
            <span>{formatINR(total)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page Component ---
export function AssistedOrderingPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  
  // Guest Context State
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [note, setNote] = useState('');
  const [seat, setSeat] = useState('');
  const [guestCount] = useState(1);
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY' | 'ROAMING'>('TAKEAWAY');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [fulfillmentMode, setFulfillmentMode] = useState<AssistedMode>('SEND_TO_KITCHEN');
  const [paymentPreset, setPaymentPreset] = useState<'UNPAID' | 'cash' | 'upi' | 'card' | 'online'>('UNPAID');
  
  const [lineItems, setLineItems] = useState<AssistedLineItem[]>([]);
  const [activeModalItem, setActiveModalItem] = useState<any | null>(null);
  const [, setLookupResult] = useState<any>(null);
  const [result, setResult] = useState<AssistedResult | null>(null);
  
  const { features } = usePlanFeatures();
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  const { data: business } = useQuery({
    queryKey: ['settings-business'],
    queryFn: async () => (await api.get('/settings/business')).data,
    staleTime: 1000 * 60,
  });

  const { data: floorsResponse } = useQuery<any>({
    queryKey: ['floors-overview'],
    queryFn: async () => (await api.get('/venue/zones')).data,
    staleTime: 1000 * 20,
    retry: false,
  });

  const { data: menuResponse, isLoading: menuLoading } = useQuery({
    queryKey: ['assist-order-menu', business?.slug],
    queryFn: async () => (await api.get(`/public/${business?.slug}/menu`)).data,
    enabled: Boolean(business?.slug),
    staleTime: 1000 * 60,
  });

  const lookupMutation = useMutation({
    mutationFn: async (phone: string) => (await api.get('/orders/assisted/customer-lookup', { params: { phone } })).data,
    onSuccess: (data) => {
      setLookupResult(data?.customer || null);
      if (data?.customer?.name && !customerName.trim()) {
        setCustomerName(String(data.customer.name));
      }
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
      setCustomerName('');
      setCustomerPhone('');
      setNote('');
      setSeat('');
      setSelectedTableId('');
      setPaymentPreset('UNPAID');
      setIsContextExpanded(false);
    },
  });

  // --- Memoized Data Transformations ---
  const categories = useMemo(() => (Array.isArray(menuResponse?.categories) ? menuResponse.categories : []), [menuResponse?.categories]);

  const allTables = useMemo(
    () =>
      (Array.isArray(floorsResponse?.zones) ? floorsResponse.zones : []).flatMap((zone: any) =>
        (Array.isArray(zone?.tables) ? zone.tables : []).map((table: any) => ({ ...table, floorName: zone.name })),
      ),
    [floorsResponse?.zones],
  );

  const filteredCategories = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return categories
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
  }, [categories, search]);

  const displayedCategories = useMemo(() => {
    if (selectedCategory === 'ALL') return filteredCategories;
    return filteredCategories.filter((c: any) => c.id === selectedCategory);
  }, [filteredCategories, selectedCategory]);

  const previewSubtotal = useMemo(() => lineItems.reduce((sum, item) => sum + readPrice(item.lineTotal), 0), [lineItems]);
  const taxRate = readPrice(menuResponse?.taxRate);
  const previewTax = useMemo(() => previewSubtotal * (taxRate / 100), [taxRate, previewSubtotal]);
  const previewTotal = previewSubtotal + previewTax;

  const requiresTableSelection = orderType === 'DINE_IN';
  const canSubmitOrder = lineItems.length > 0 && (!requiresTableSelection || Boolean(selectedTableId));
  const canUseDirectBill = features.hasAssistedDirectBill && orderType !== 'DINE_IN';
  
  const submitLabel = fulfillmentMode === 'DIRECT_BILL'
    ? paymentPreset === 'UNPAID' ? 'Generate Bill' : `Mark ${String(paymentPreset).toUpperCase()} & Bill`
    : 'Send to Kitchen';

  useEffect(() => {
    if (orderType === 'DINE_IN' && fulfillmentMode === 'DIRECT_BILL') {
      setFulfillmentMode('SEND_TO_KITCHEN');
      setPaymentPreset('UNPAID');
    }
  }, [fulfillmentMode, orderType]);

  // --- Handlers ---
  const addSimpleItem = (item: any) => {
    const basePrice = readPrice(item?.price);
    setLineItems((current) => {
      // Small optimistic merge for identical simple items
      const existing = current.find(i => i.menuItemId === item.id && i.selectedModifiers.length === 0 && !i.notes);
      if (existing) {
        return current.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1, lineTotal: buildLineTotal(basePrice, i.quantity + 1, []) } : i);
      }
      return [
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
      ];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setLineItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const nq = Math.max(0, item.quantity + delta);
        if (nq === 0) return { ...item, _delete: true } as any; 
        return { ...item, quantity: nq, lineTotal: buildLineTotal(item.basePrice, nq, item.selectedModifiers) };
      }).filter(item => !item._delete)
    );
  };

  // --- Render ---
  return (
    <div className="flex flex-col lg:flex-row h-[100dvh] lg:h-[calc(100vh-2rem)] gap-4 overflow-hidden -mx-4 -mt-4 lg:m-0">
      
      {/* --------------------------- */}
      {/* LEFT PANE: Menu Interaction */}
      {/* --------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950/50 lg:rounded-3xl border-r lg:border border-slate-800/60 shadow-inner overflow-hidden">
        
        {/* Header & Search */}
        <div className="shrink-0 p-4 lg:p-6 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/60 z-10">
          <div className="flex items-center gap-3">
             <div className="flex-1 relative group">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="text"
                  placeholder="Search dishes, tags, or modifiers... (Press /)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-sm bg-slate-950 border border-slate-800 rounded-2xl pl-11 pr-4 py-3.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all font-semibold"
                />
             </div>
          </div>

          {/* Sticky Category Nav */}
          <div className="mt-4 -mx-2 px-2 overflow-x-auto no-scrollbar flex items-center gap-2 pb-1" ref={categoryScrollRef}>
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`shrink-0 px-5 py-2.5 rounded-[14px] text-xs font-black tracking-widest uppercase transition-all duration-200 ${
                selectedCategory === 'ALL' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                  : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              All Items
            </button>
            {categories.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`shrink-0 px-5 py-2.5 rounded-[14px] text-xs font-black tracking-widest uppercase transition-all duration-200 ${
                  selectedCategory === c.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                    : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Grid Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 scroll-smooth will-change-scroll pb-32 lg:pb-6">
          {menuLoading && (
            <div className="h-full flex items-center justify-center">
               <div className="animate-pulse flex flex-col items-center">
                 <div className="w-10 h-10 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
                 <p className="mt-4 text-xs font-black text-slate-500 uppercase tracking-widest">Warming Up Grid</p>
               </div>
            </div>
          )}

          {filteredCategories.length === 0 && !menuLoading && (
            <div className="h-full flex items-center justify-center flex-col text-slate-500">
               <Search size={40} className="opacity-20 mb-4" />
               <p className="text-sm font-bold">No results for "{search}"</p>
            </div>
          )}

          <div className="space-y-8">
            {displayedCategories.map((category: any) => (
              <section key={category.id} className="animate-in fade-in duration-300">
                <div className="sticky top-0 z-10 py-2 mb-4 bg-slate-950/90 backdrop-blur-md rounded-xl px-2">
                  <h3 className="text-lg font-black text-white">{category.name}</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{category.menuItems.length} items</p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-2 2xl:grid-cols-3 gap-3 sm:gap-4">
                  {category.menuItems.map((item: any) => {
                    const modifiersExist = hasModifiers(item);
                    return (
                      <div 
                        key={item.id} 
                        className="group flex flex-col bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl overflow-hidden hover:border-slate-600 transition-all active:scale-[0.98]"
                      >
                        {/* Image Layer */}
                        <div 
                          className="w-full aspect-[4/3] bg-slate-800 relative flex items-center justify-center overflow-hidden" 
                          style={{ background: item.imageUrl ? `url('${parseImageUrl(item.imageUrl)}') center/cover` : generateGradient(item.id) }}
                        >
                          {!item.imageUrl && <ImageIcon size={24} className="text-white/10" />}
                          <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                             <div className={`px-2 py-1 rounded bg-slate-900/80 backdrop-blur border border-white/5 text-[9px] font-black uppercase tracking-widest ${item.isVeg ? 'text-green-400' : 'text-red-400'}`}>
                               {item.isVeg ? 'Veg' : 'Non'}
                             </div>
                          </div>
                        </div>

                        {/* Content Layer */}
                        <div className="p-3 sm:p-4 flex flex-1 flex-col">
                          <h4 className="text-sm font-black text-white truncate">{item.name}</h4>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed flex-1 font-medium">{item.description || "No description available"}</p>
                          
                          {/* Action Layer */}
                          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-base font-black text-white">{formatINR(readPrice(item.price))}</span>
                            
                            <button
                              onClick={() => modifiersExist ? setActiveModalItem(item) : addSimpleItem(item)}
                              className={`h-9 sm:h-10 px-4 rounded-xl flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider transition-colors ${
                                modifiersExist 
                                  ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' 
                                  : 'bg-blue-600/10 text-blue-500 hover:bg-blue-600/20'
                              }`}
                            >
                              {modifiersExist ? (
                                <>Customize</>
                              ) : (
                                <><Plus size={14} /> Add</>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      {/* --------------------------- */}
      {/* RIGHT PANE: Smart Cart      */}
      {/* --------------------------- */}
      <aside className="w-full lg:w-[380px] shrink-0 flex flex-col bg-slate-900 lg:rounded-3xl border-t lg:border border-slate-800 shadow-2xl relative z-40">
        
        {/* Compressed Guest Context Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur z-20">
          <div 
            className="flex items-center justify-between cursor-pointer group"
            onClick={() => setIsContextExpanded(!isContextExpanded)}
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Order Context</p>
              <div className="flex items-center gap-2 mt-1 text-sm font-black text-white">
                 <span className="truncate max-w-[120px]">{customerName || 'Walk-in'}</span>
                 <span className="text-slate-600">•</span>
                 <span className={orderType === 'DINE_IN' ? 'text-cyan-400' : 'text-blue-400'}>{orderType.replace('_', ' ')}</span>
              </div>
            </div>
            <button className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-slate-700 transition-colors">
              {isContextExpanded ? <ChevronDown size={16} /> : <Edit3 size={14} />}
            </button>
          </div>

          {/* Expanded Intake Form */}
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isContextExpanded ? 'max-h-[500px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
             <div className="space-y-4 p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                <div className="grid grid-cols-2 gap-3">
                   <select value={orderType} onChange={(e) => setOrderType(e.target.value as any)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-blue-500 outline-none">
                     <option value="TAKEAWAY">Takeaway</option>
                     <option value="DINE_IN">Dine In</option>
                     <option value="ROAMING">Delivery/Roam</option>
                   </select>

                   {orderType === 'DINE_IN' ? (
                     <select value={selectedTableId} onChange={(e) => setSelectedTableId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-blue-500 outline-none">
                       <option value="">Table...</option>
                       {allTables.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                     </select>
                   ) : (
                     <input placeholder="Seat / Identifier" value={seat} onChange={(e)=>setSeat(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder:text-slate-500 outline-none" />
                   )}
                </div>

                <div className="space-y-2 relative">
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input value={customerPhone} onChange={(e)=>setCustomerPhone(e.target.value)} placeholder="Customer Phone" className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-2 py-2 text-xs font-bold text-white placeholder:text-slate-500 outline-none" />
                    {customerPhone.length >= 8 && features.hasAssistedCustomerLookup && (
                      <button 
                        onClick={() => lookupMutation.mutate(customerPhone)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 py-1 px-3 bg-blue-600 rounded-lg text-[10px] font-black uppercase text-white hover:bg-blue-500 disabled:opacity-50"
                        disabled={lookupMutation.isPending}
                      >
                        {lookupMutation.isPending ? '...' : 'Look'}
                      </button>
                    )}
                  </div>
                  
                  <input value={customerName} onChange={(e)=>setCustomerName(e.target.value)} placeholder="Customer Name (Optional)" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder:text-slate-500 outline-none" />
                </div>
                
                <div className="flex gap-2">
                   <button 
                     onClick={() => { setFulfillmentMode('SEND_TO_KITCHEN'); setPaymentPreset('UNPAID'); }} 
                     className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${fulfillmentMode === 'SEND_TO_KITCHEN' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                   >
                     Kitchen
                   </button>
                   <button 
                     onClick={() => canUseDirectBill && setFulfillmentMode('DIRECT_BILL')}
                     className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${fulfillmentMode === 'DIRECT_BILL' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'} ${!canUseDirectBill ? 'opacity-50 cursor-not-allowed' : ''}`}
                   >
                     Direct Bill {!canUseDirectBill && <Sparkles size={10} className="inline ml-1" />}
                   </button>
                </div>
             </div>
          </div>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 relative bg-slate-950/20">
           {lineItems.length === 0 ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 opacity-50 relative top-10">
               <ShoppingBag size={48} className="mb-4 stroke-[1]" />
               <p className="text-sm font-black tracking-widest uppercase">Cart is Empty</p>
               <p className="text-xs font-medium mt-1">Add items from the menu</p>
             </div>
           ) : (
             lineItems.map(item => (
               <div key={item.id} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2 shadow-sm animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="flex items-start justify-between">
                     <span className="text-sm font-bold text-white leading-tight pr-4">{item.name}</span>
                     <span className="text-sm font-black text-white">{formatINR(item.lineTotal)}</span>
                  </div>
                  
                  {item.selectedModifiers.length > 0 && (
                     <div className="flex flex-wrap gap-1">
                        {item.selectedModifiers.map(m => (
                           <span key={m.id} className="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded-md">
                             {m.name}
                           </span>
                        ))}
                     </div>
                  )}

                  <div className="flex items-center justify-between mt-1">
                    {/* Inline Quantity Control */}
                    <div className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-0.5 border border-slate-700/50">
                       <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 rounded-md bg-slate-800 flex items-center justify-center text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
                          <Minus size={14} />
                       </button>
                       <span className="w-4 text-center text-xs font-black text-white">{item.quantity}</span>
                       <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 rounded-md bg-blue-600/20 flex items-center justify-center text-blue-400 hover:bg-blue-600/40 hover:text-blue-300 transition-colors">
                          <Plus size={14} />
                       </button>
                    </div>

                    {/* Remove Fallback */}
                    <button onClick={() => updateQuantity(item.id, -item.quantity)} className="text-[10px] uppercase tracking-widest font-black text-red-500/50 hover:text-red-400 transition-colors">
                      Remove
                    </button>
                  </div>
               </div>
             ))
           )}
        </div>

        {/* Footer Billing Area */}
        <div className="shrink-0 bg-slate-900 border-t border-slate-800 p-4 z-20 pb-safe">
           {result?.sessionId ? (
             <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl animate-in flip-in-x">
                <div className="flex items-center gap-2 text-emerald-400 mb-2 font-black">
                  <BadgeCheck size={18} /> Order Submitted
                </div>
                {result.billPath && (
                   <a href={`${getCustomerAppUrl()}${result.billPath}`} target="_blank" rel="noreferrer" className="block w-full py-2.5 bg-emerald-600 text-center text-white text-xs font-black uppercase tracking-widest rounded-xl mt-3">
                     View Bill Receipt
                   </a>
                )}
                <button onClick={() => setResult(null)} className="w-full mt-2 text-xs font-bold text-slate-400 hover:text-white py-1">Dismiss</button>
             </div>
           ) : (
             <>
               <div className="space-y-1.5 mb-4 px-2">
                 <div className="flex justify-between text-xs font-bold text-slate-500">
                   <span>Subtotal</span>
                   <span>{formatINR(previewSubtotal)}</span>
                 </div>
                 <div className="flex justify-between text-xs font-bold text-slate-500">
                   <span>Taxes ({taxRate}%)</span>
                   <span>{formatINR(previewTax)}</span>
                 </div>
                 <div className="flex justify-between text-lg font-black text-white pt-2 border-t border-slate-800/50 mt-2">
                   <span>Total</span>
                   <span className="text-blue-400">{formatINR(previewTotal)}</span>
                 </div>
               </div>

               {submitMutation.isError && (
                 <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold rounded-xl animate-in shake">
                    {(submitMutation.error as any)?.response?.data?.error || 'Submit failed.'}
                 </div>
               )}

               <button
                  onClick={() => submitMutation.mutate()}
                  disabled={!canSubmitOrder || submitMutation.isPending}
                  className={`relative w-full overflow-hidden h-14 rounded-2xl flex items-center justify-center text-sm font-black uppercase tracking-widest transition-all ${
                    canSubmitOrder 
                      ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/20 hover:bg-blue-500 active:scale-[0.98]' 
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed hidden'
                  }`}
               >
                 {submitMutation.isPending ? (
                   <span className="flex items-center gap-2"><RefreshCw size={16} className="animate-spin" /> Processing...</span>
                 ) : (
                   submitLabel
                 )}
                 {canSubmitOrder && !submitMutation.isPending && (
                   <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                 )}
               </button>
               
               {!canSubmitOrder && (
                  <div className="w-full h-14 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-800 text-xs font-bold uppercase tracking-widest text-slate-500">
                    {requiresTableSelection && !selectedTableId ? 'Select Table to Order' : 'Cart Empty'}
                  </div>
               )}
             </>
           )}
        </div>
      </aside>

      {/* Modifier Sheet Portal */}
      {activeModalItem && (
         <ModifierSheet item={activeModalItem} onClose={() => setActiveModalItem(null)} onAdd={(li) => {
           setLineItems(curr => [...curr, li]);
         }} />
      )}
    </div>
  );
}
