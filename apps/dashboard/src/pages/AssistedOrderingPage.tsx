import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, BadgeCheck, UtensilsCrossed, Zap } from 'lucide-react';
import { api } from '../lib/api';
import { getCustomerAppUrl } from '../lib/network';

// --- Expert POS Components ---
import { AssistedLineItem, AssistedResult, readPrice, calculateLineTotal, POS_ANIMATIONS, FulfillmentMode } from '../components/pos/POSCore';
import { MenuGrid } from '../components/pos/MenuGrid';
import { CartPanel } from '../components/pos/CartPanel';
import { BottomNav } from '../components/pos/BottomNav';
import { ModifierSheet } from '../components/pos/ModifierSheet';

export function AssistedOrderingPage() {
  // 1. Navigation & Search State
  const [activeTab, setActiveTab] = useState<'MENU' | 'SEARCH' | 'CART'>('MENU');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  
  // 2. Business Context State
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [guestContext, setGuestContext] = useState({
    customerName: '',
    customerPhone: '',
    note: '',
    seat: '',
    guestCount: 1,
    orderType: 'TAKEAWAY' as 'DINE_IN' | 'TAKEAWAY',
    fulfillmentMode: 'SEND_TO_KITCHEN' as FulfillmentMode,
    paymentPreset: 'UNPAID' as any,
  });
  
  // 3. Operational State
  const [lineItems, setLineItems] = useState<AssistedLineItem[]>([]);
  const [activeModalItem, setActiveModalItem] = useState<any | null>(null);
  const [result, setResult] = useState<AssistedResult | null>(null);
  
  // --- Data Fetching (Queries) ---
  const { data: business } = useQuery({
    queryKey: ['settings-business'],
    queryFn: async () => (await api.get('/settings/business')).data,
    staleTime: 1000 * 60,
  });

  const { data: menuResponse, isLoading: menuLoading } = useQuery({
    queryKey: ['assist-order-menu', business?.slug],
    queryFn: async () => (await api.get(`/public/${business?.slug}/menu`)).data,
    enabled: Boolean(business?.slug),
    staleTime: 1000 * 60,
  });

  const { data: summaryData } = useQuery({
    queryKey: ['assist-order-summary'],
    queryFn: async () => (await api.get('/orders/assisted/summary')).data,
    refetchInterval: 1000 * 30,
  });

  // --- Core Lifecycle (Mutations) ---
  const submitMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/orders/assisted', {
          ...guestContext,
          markPaid: guestContext.fulfillmentMode === 'DIRECT_BILL' && guestContext.paymentPreset !== 'UNPAID',
          paymentMethod: guestContext.fulfillmentMode === 'DIRECT_BILL' && guestContext.paymentPreset !== 'UNPAID' ? guestContext.paymentPreset : undefined,
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
      setGuestContext(curr => ({ ...curr, customerName: '', customerPhone: '', note: '', seat: '' }));
      setIsContextExpanded(false);
      setActiveTab('MENU');
    },
  });

  // --- Isolated Compute (Memos) ---
  const rawCategories = useMemo(() => (Array.isArray(menuResponse?.categories) ? menuResponse.categories : []), [menuResponse?.categories]);

  const filteredCatalog = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rawCategories
      .map((cat: any) => ({
        ...cat,
        menuItems: (cat.menuItems || []).filter((item: any) => {
          if (!term) return true;
          return item.name.toLowerCase().includes(term) || (item.description || '').toLowerCase().includes(term);
        })
      }))
      .filter((cat: any) => cat.menuItems.length > 0);
  }, [rawCategories, search]);

  const displayedCatalog = useMemo(() => {
    if (selectedCategory === 'ALL') return filteredCatalog;
    return filteredCatalog.filter((c: any) => c.id === selectedCategory);
  }, [filteredCatalog, selectedCategory]);

  const subtotal = useMemo(() => lineItems.reduce((sum, i) => sum + i.lineTotal, 0), [lineItems]);
  const taxRate = readPrice(menuResponse?.taxRate);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  // --- Handlers (Isolated for Perf) ---
  const handleAddSimpleItem = useCallback((item: any) => {
    const base = readPrice(item.price);
    setLineItems(curr => {
      const existingIdx = curr.findIndex(i => i.menuItemId === item.id && i.selectedModifiers.length === 0 && !i.notes);
      if (existingIdx > -1) {
        const next = [...curr];
        const updated = { ...next[existingIdx] };
        updated.quantity += 1;
        updated.lineTotal = calculateLineTotal(base, updated.quantity, []);
        next[existingIdx] = updated;
        return next;
      }
      return [...curr, {
        id: `pos_${item.id}_${Date.now()}`,
        menuItemId: String(item.id),
        name: String(item.name),
        basePrice: base,
        quantity: 1,
        notes: '',
        selectedModifierIds: [],
        selectedModifiers: [],
        lineTotal: base,
      }];
    });
  }, []);

  const handleUpdateQuantity = useCallback((id: string, delta: number) => {
    setLineItems(curr => curr.map(i => {
      if (i.id !== id) return i;
      const nq = Math.max(0, i.quantity + delta);
      return nq === 0 ? { ...i, _del: true } : { ...i, quantity: nq, lineTotal: calculateLineTotal(i.basePrice, nq, i.selectedModifiers) };
    }).filter((i: any) => !i._del) as any);
  }, []);

  return (
    <div className="flex flex-col lg:flex-row h-[100dvh] lg:h-[calc(100vh-2rem)] gap-4 lg:gap-8 overflow-hidden -mx-4 -mt-4 lg:m-0 bg-slate-950 font-sans selection:bg-blue-500 selection:text-white">
      
      {/* 🟢 Mobile Terminal Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="lg:hidden flex items-center justify-between p-6 bg-slate-900 shadow-2xl border-b border-white/5 z-50 sticky top-0"
      >
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
             <Zap size={24} className="text-white fill-white" />
           </div>
           <div>
             <h1 className="text-sm font-black text-white uppercase tracking-widest">BHOJFLOW PRO</h1>
             <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Terminal Active</span>
             </div>
           </div>
        </div>
        <div className="text-right flex flex-col items-end">
           <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1">Session Value</p>
           <p className="text-base font-black text-emerald-400 tabular-nums">{formatINR(summaryData?.totalRevenue || 0)}</p>
        </div>
      </motion.div>

      {/* 🔴 Left Surface: Primary Grid Content */}
      <div className={`flex-1 flex flex-col min-w-0 transition-opacity duration-300 ${activeTab === 'CART' ? 'opacity-0 h-0 lg:opacity-100 lg:h-full lg:flex' : 'opacity-100 flex'}`}>
        <MenuGrid 
          categories={displayedCatalog}
          search={search}
          onSearchChange={setSearch}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onAddItem={handleAddSimpleItem}
          onCustomizeItem={setActiveModalItem}
          isLoading={menuLoading}
        />
      </div>

      {/* 🔵 Right Surface: Intent-Driven Cart */}
      <div className={`transition-all duration-300 ${activeTab === 'CART' ? 'w-full opacity-100 flex' : 'w-0 opacity-0 hidden lg:w-[420px] lg:opacity-100 lg:flex'} h-full shrink-0`}>
        <CartPanel 
          items={lineItems}
          onUpdateQuantity={handleUpdateQuantity}
          onRemove={(id) => handleUpdateQuantity(id, -Infinity)}
          subtotal={subtotal}
          tax={tax}
          total={total}
          isExpanded={isContextExpanded}
          onToggleExpand={() => setIsContextExpanded(!isContextExpanded)}
          guestContext={guestContext}
          onUpdateContext={setGuestContext}
          onSubmit={() => submitMutation.mutate()}
          isSubmitting={submitMutation.isPending}
        />
      </div>

      {/* 🟣 Deep Search Overlay (Mobile Intent) */}
      <AnimatePresence>
        {activeTab === 'SEARCH' && (
          <motion.div
            initial={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
            className="lg:hidden fixed inset-0 z-[120] bg-slate-950 flex flex-col pt-safe"
          >
            <div className="p-8 bg-slate-900 border-b border-white/5 flex items-center gap-6 shadow-2xl">
              <div className="flex-1 relative group">
                <Search size={24} className="absolute left-6 top-1/2 -translate-y-1/2 text-blue-500" />
                <input 
                  autoFocus
                  placeholder="Global Item Search..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full h-16 bg-slate-950/80 border border-white/10 rounded-3xl pl-16 pr-6 text-base font-black text-white outline-none focus:border-blue-500 transition-all shadow-inner"
                />
              </div>
              <button 
                onClick={() => setActiveTab('MENU')} 
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-800 text-slate-500 font-black"
              >
                ESC
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 scale-95 origin-top">
               <MenuGrid 
                  categories={displayedCatalog}
                  search={search}
                  onSearchChange={setSearch}
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                  onAddItem={handleAddSimpleItem}
                  onCustomizeItem={setActiveModalItem}
                  isLoading={menuLoading}
               />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🟡 Interaction Shell Components */}
      <BottomNav 
        activeTab={activeTab}
        onTabChange={setActiveTab}
        cartItemCount={lineItems.length}
      />

      <AnimatePresence>
        {activeModalItem && (
          <ModifierSheet 
            item={activeModalItem} 
            onClose={() => setActiveModalItem(null)} 
            onAdd={(li) => setLineItems(curr => [...curr, li])}
          />
        )}
      </AnimatePresence>

      {/* ⚪ Success Portal (Modal Intent) */}
      <AnimatePresence>
        {result && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-slate-950/90 backdrop-blur-2xl"
          >
            <motion.div 
              {...POS_ANIMATIONS.SPRING}
              initial={{ scale: 0.8, y: 50, rotateX: 20 }}
              animate={{ scale: 1, y: 0, rotateX: 0 }}
              className="w-full max-w-sm bg-slate-900 border border-emerald-500/20 rounded-[3rem] p-12 text-center space-y-8 shadow-2xl shadow-emerald-500/10"
            >
              <div className="relative mx-auto w-24 h-24">
                 <motion.div 
                   animate={{ rotate: 360 }} 
                   transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                   className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-500/20" 
                 />
                 <div className="absolute inset-2 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.3)]">
                    <BadgeCheck size={48} className="text-white" />
                 </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-black text-white tracking-tight">Order Locked</h2>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Invoice #{result.invoiceNumber || 'MASTER'}</p>
              </div>

              <div className="pt-8 space-y-4">
                {result.billPath && (
                  <motion.a 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    href={`${getCustomerAppUrl()}${result.billPath}`} 
                    target="_blank" 
                    className="flex items-center justify-center gap-3 w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[1.25rem] font-black text-[13px] uppercase tracking-widest shadow-xl shadow-emerald-900/20 transition-all"
                  >
                    <UtensilsCrossed size={18} /> Print Receipt
                  </motion.a>
                )}
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setResult(null)}
                  className="w-full py-5 bg-slate-800 text-slate-400 hover:text-white rounded-[1.25rem] font-black text-[11px] uppercase tracking-widest transition-all"
                >
                  Return to POS
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatINR(val: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
}
