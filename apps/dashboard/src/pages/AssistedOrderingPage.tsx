import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BadgeCheck,
  Clock,
  CreditCard,
  Phone,
  Search,
  ShoppingCart,
  Ticket,
  UserRound,
  X,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatINR } from '../lib/currency';
import { MenuGrid } from '../components/pos/MenuGrid';
import { CartPanel } from '../components/pos/CartPanel';
import { BottomNav } from '../components/pos/BottomNav';
import { ModifierSheet } from '../components/pos/ModifierSheet';
import { AssistedLineItem, AssistedResult, calculateLineTotal, readPrice } from '../components/pos/POSCore';

type CounterSessionCard = {
  key: string;
  sessionId: string | null;
  tokenLabel: string;
  guestName: string;
  guestPhone: string;
  itemCount: number;
  totalAmount: number;
  status: string;
  updatedAt: string;
};

type GuestContext = {
  customerName: string;
  customerPhone: string;
  tableId: string;
  note: string;
  seat: string;
  guestCount: number;
  orderType: 'TAKEAWAY';
  fulfillmentMode: 'SEND_TO_KITCHEN';
  paymentPreset: 'UNPAID';
};

const DEFAULT_GUEST_CONTEXT: GuestContext = {
  customerName: '',
  customerPhone: '',
  tableId: '',
  note: '',
  seat: '',
  guestCount: 1,
  orderType: 'TAKEAWAY',
  fulfillmentMode: 'SEND_TO_KITCHEN',
  paymentPreset: 'UNPAID',
};

function normalizeDigits(value: string) {
  return value.replace(/\D/g, '');
}

function formatPhonePreview(value: string) {
  const digits = normalizeDigits(value);
  if (digits.length < 4) return value || 'No phone';
  return `....${digits.slice(-4)}`;
}

function buildCounterSessions(orders: any[]): CounterSessionCard[] {
  const grouped = new Map<string, CounterSessionCard>();

  orders
    .filter((order) => !order?.table?.name && order?.diningSessionId)
    .forEach((order) => {
      const key = String(order.diningSessionId);
      const current = grouped.get(key);
      const itemCount = Array.isArray(order?.items)
        ? order.items.reduce((sum: number, item: any) => sum + Number(item?.quantity || 0), 0)
        : 0;

      const candidate: CounterSessionCard = {
        key,
        sessionId: order.diningSessionId,
        tokenLabel: String(order?.orderNumber || `T-${String(order?.id || '').slice(-6).toUpperCase()}`),
        guestName: String(order?.customerName || order?.diningSession?.customer?.name || '').trim() || 'Walk-in guest',
        guestPhone: String(order?.customerPhone || order?.diningSession?.customer?.phone || '').trim(),
        itemCount,
        totalAmount: Number(order?.totalAmount || 0),
        status: String(order?.status || '').toUpperCase(),
        updatedAt: String(order?.createdAt || new Date().toISOString()),
      };

      if (!current) {
        grouped.set(key, candidate);
        return;
      }

      grouped.set(key, {
        ...current,
        itemCount: current.itemCount + candidate.itemCount,
        totalAmount: current.totalAmount + candidate.totalAmount,
        status: current.status === 'READY' ? current.status : candidate.status,
        updatedAt:
          new Date(candidate.updatedAt).getTime() > new Date(current.updatedAt).getTime()
            ? candidate.updatedAt
            : current.updatedAt,
      });
    });

  return Array.from(grouped.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function AssistedOrderingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'MENU' | 'SEARCH' | 'CART'>('MENU');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [activeModalItem, setActiveModalItem] = useState<any | null>(null);
  const [lineItems, setLineItems] = useState<AssistedLineItem[]>([]);
  const [, setResult] = useState<(AssistedResult & { order?: any }) | null>(null);
  const [guestContext, setGuestContext] = useState<GuestContext>(DEFAULT_GUEST_CONTEXT);
  const [isContextExpanded, setIsContextExpanded] = useState(true);
  const [linkedSession, setLinkedSession] = useState<CounterSessionCard | null>(null);
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupMessage, setLookupMessage] = useState('');
  const [lookupMessageType, setLookupMessageType] = useState<'info' | 'success' | 'error'>('info');

  const { data: business } = useQuery({
    queryKey: ['settings-business'],
    queryFn: async () => (await api.get('/settings/business')).data,
    staleTime: 60_000,
  });

  const { data: menuResponse, isLoading: menuLoading } = useQuery({
    queryKey: ['assist-order-menu', business?.slug],
    queryFn: async () => (await api.get(`/public/${business?.slug}/menu`)).data,
    enabled: Boolean(business?.slug),
    staleTime: 60_000,
  });

  const { data: liveOrders = [] } = useQuery({
    queryKey: ['counter-simple-live'],
    queryFn: async () => (await api.get('/orders/live')).data,
    refetchInterval: 6_000,
    staleTime: 3_000,
  });

  const lookupMutation = useMutation({
    mutationFn: async (phone: string) =>
      (await api.get(`/orders/assisted/customer-lookup?phone=${encodeURIComponent(phone)}`)).data,
    onSuccess: (data) => {
      const customer = data?.customer;
      if (!customer) {
        setLookupMessage('Fresh profile staged.');
        setLookupMessageType('info');
        setGuestContext((current) => ({ ...current, customerPhone: normalizeDigits(lookupPhone) }));
        setLinkedSession(null);
        return;
      }

      setGuestContext((current) => ({
        ...current,
        customerName: customer.name || current.customerName,
        customerPhone: customer.phone || normalizeDigits(lookupPhone),
      }));
      setLookupMessage(`${customer.name || 'Guest'} pre-filled.`);
      setLookupMessageType('success');
    },
    onError: (error: any) => {
      setLookupMessage(error?.response?.data?.error || 'Lookup error.');
      setLookupMessageType('error');
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/orders/assisted', {
          ...guestContext,
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
      queryClient.invalidateQueries({ queryKey: ['counter-simple-live'] });
      queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
      setLineItems([]);
      setLookupMessage(linkedSession ? `Order appended to ${linkedSession.tokenLabel}.` : 'New token activated successfully.');
      setLookupMessageType('success');
      setActiveTab('MENU');
      setIsContextExpanded(false);
    },
    onError: (error: any) => {
      setLookupMessage(error?.response?.data?.error || 'Submission failed.');
      setLookupMessageType('error');
    },
  });

  const finishSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const slug = String(business?.slug || '').trim();
      if (!slug) throw new Error('Slug missing.');
      return api.post(`/public/${slug}/sessions/${sessionId}/admin-finish`, { force: false });
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['counter-simple-live'] });
      queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
      if (linkedSession?.sessionId === sessionId) setLinkedSession(null);
      navigate('/app/billing');
    },
    onError: (error: any) => {
      setLookupMessage(error?.response?.data?.error || 'Billing transfer failed.');
      setLookupMessageType('error');
    },
  });

  const rawCategories = useMemo(
    () => (Array.isArray(menuResponse?.categories) ? menuResponse.categories : []),
    [menuResponse?.categories],
  );

  const filteredCatalog = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rawCategories
      .map((category: any) => ({
        ...category,
        menuItems: (Array.isArray(category?.menuItems) ? category.menuItems : []).filter((item: any) => {
          if (!term) return true;
          return (
            String(item?.name || '').toLowerCase().includes(term) ||
            String(item?.description || '').toLowerCase().includes(term)
          );
        }),
      }))
      .filter((category: any) => category.menuItems.length > 0);
  }, [rawCategories, search]);

  const displayedCatalog = useMemo(
    () => (selectedCategory === 'ALL' ? filteredCatalog : filteredCatalog.filter((category: any) => category.id === selectedCategory)),
    [filteredCatalog, selectedCategory],
  );

  const counterSessions = useMemo(
    () => buildCounterSessions(Array.isArray(liveOrders) ? liveOrders : []),
    [liveOrders],
  );

  const subtotal = useMemo(() => lineItems.reduce((sum, item) => sum + item.lineTotal, 0), [lineItems]);
  const taxRate = readPrice(menuResponse?.taxRate);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const submitBlockedReason =
    !guestContext.customerName.trim()
      ? 'Guest Identification Required'
      : normalizeDigits(guestContext.customerPhone).length < 10
        ? 'Invalid Mobile Protocol'
        : '';

  const handleAddSimpleItem = useCallback((item: any) => {
    const base = readPrice(item.price);
    setLineItems((current) => {
      const existingIndex = current.findIndex(
        (entry) => entry.menuItemId === String(item.id) && entry.selectedModifiers.length === 0 && !entry.notes,
      );

      if (existingIndex > -1) {
        const next = [...current];
        const updated = { ...next[existingIndex] };
        updated.quantity += 1;
        updated.lineTotal = calculateLineTotal(base, updated.quantity, []);
        next[existingIndex] = updated;
        return next;
      }

      return [
        ...current,
        {
          id: `counter_${item.id}_${Date.now()}`,
          menuItemId: String(item.id),
          name: String(item.name),
          basePrice: base,
          quantity: 1,
          notes: '',
          selectedModifierIds: [],
          selectedModifiers: [],
          lineTotal: base,
        },
      ];
    });
  }, []);

  const handleRemoveSimpleItem = useCallback((item: any) => {
    setLineItems((current) => {
      const existingIndex = current.findIndex(
        (entry) => entry.menuItemId === String(item.id) && entry.selectedModifiers.length === 0 && !entry.notes,
      );
      if (existingIndex === -1) return current;
      const next = [...current];
      const updated = { ...next[existingIndex] };
      if (updated.quantity <= 1) {
        next.splice(existingIndex, 1);
        return next;
      }
      updated.quantity -= 1;
      updated.lineTotal = calculateLineTotal(updated.basePrice, updated.quantity, []);
      next[existingIndex] = updated;
      return next;
    });
  }, []);

  const handleUpdateQuantity = useCallback((id: string, delta: number) => {
    setLineItems((current) =>
      current
        .map((item) => {
          if (item.id !== id) return item;
          const quantity = Math.max(0, item.quantity + delta);
          return quantity === 0
            ? { ...item, _remove: true }
            : {
                ...item,
                quantity,
                lineTotal: calculateLineTotal(item.basePrice, quantity, item.selectedModifiers),
              };
        })
        .filter((item: any) => !item._remove) as AssistedLineItem[],
    );
  }, []);

  const handleLookupGuest = useCallback(() => {
    const phone = normalizeDigits(lookupPhone);
    if (phone.length < 10) return;
    lookupMutation.mutate(phone);
  }, [lookupMutation, lookupPhone]);

  const handleSelectSession = useCallback((session: CounterSessionCard) => {
    setLinkedSession(session);
    setGuestContext((current) => ({
      ...current,
      customerName: session.guestName,
      customerPhone: normalizeDigits(session.guestPhone),
    }));
    setLookupMessage(`Staged for ${session.tokenLabel}`);
    setLookupMessageType('info');
    setIsContextExpanded(false);
  }, []);

  const handleNewSession = useCallback(() => {
    setLinkedSession(null);
    setGuestContext(DEFAULT_GUEST_CONTEXT);
    setLookupPhone('');
    setLookupMessage('');
    setLineItems([]);
  }, []);

  const activeSessionRevenue = counterSessions.reduce((sum, session) => sum + session.totalAmount, 0);

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[var(--app-bg)] pb-24 2xl:min-h-[calc(100dvh-5rem)] 2xl:pb-0">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-3 py-3 sm:px-4 lg:px-6 lg:py-5">
        <section className="rounded-[2rem] border border-white/6 bg-slate-900/95 p-4 shadow-2xl sm:p-5 lg:rounded-[2.25rem] lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-blue-600/15 text-blue-400">
                  <Zap size={16} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-400/80">
                  Counter Workspace
                </p>
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white lg:text-3xl">Assisted Ordering</h1>
                <p className="mt-1 text-sm font-medium text-slate-400">
                  Start a counter order, reopen an active token, and add items without losing the session.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard label="Active Tokens" value={counterSessions.length} icon={<Ticket size={15} />} />
              <MetricCard label="Live Revenue" value={formatINR(activeSessionRevenue)} icon={<CreditCard size={15} />} />
              <MetricCard label="Cart Value" value={formatINR(total)} icon={<ShoppingCart size={15} />} accent />
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-2">
              <label className="flex items-center gap-2 pl-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                <Phone size={12} className="text-blue-500/40" />
                Guest Lookup
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input
                    value={lookupPhone}
                    onChange={(event) => setLookupPhone(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && handleLookupGuest()}
                    placeholder="Enter mobile number to reuse or create guest"
                    className="h-12 w-full rounded-2xl border border-white/6 bg-slate-950/70 pl-11 pr-4 text-[14px] font-black text-white outline-none transition-all focus:border-blue-500/40 focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-700"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleLookupGuest}
                    disabled={lookupMutation.isPending}
                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-blue-600 px-5 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-blue-900/30 transition-all hover:bg-blue-500 disabled:opacity-50"
                  >
                    {lookupMutation.isPending ? <Clock size={16} className="animate-spin" /> : 'Lookup'}
                  </button>
                  <button
                    type="button"
                    onClick={handleNewSession}
                    className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/6 bg-white/5 px-5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300 transition-all hover:bg-white/10 hover:text-white"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="flex min-h-[76px] items-center rounded-[1.5rem] border border-blue-500/15 bg-blue-500/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-600/10 text-blue-400">
                  <UserRound size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black uppercase tracking-tight text-white">
                      {guestContext.customerName || 'Walk-in Guest'}
                    </p>
                    {linkedSession && (
                      <span className="rounded-lg bg-blue-500/10 px-2 py-0.5 text-[9px] font-black text-blue-400">
                        {linkedSession.tokenLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-bold text-slate-400">{formatPhonePreview(guestContext.customerPhone)}</p>
                </div>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {lookupMessage && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 overflow-hidden"
              >
                <div
                  className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                    lookupMessageType === 'error'
                      ? 'border-rose-500/20 bg-rose-500/10 text-rose-400'
                      : lookupMessageType === 'success'
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                        : 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {lookupMessageType === 'error' ? <AlertTriangle size={14} /> : <BadgeCheck size={14} />}
                    <span className="text-[10px] font-black uppercase tracking-[0.16em]">{lookupMessage}</span>
                  </div>
                  <button type="button" onClick={() => setLookupMessage('')} className="opacity-50 transition-opacity hover:opacity-100">
                    <X size={14} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className={`${activeTab === 'CART' ? 'hidden 2xl:block' : 'block'} min-w-0`}>
            <MenuGrid
              categories={displayedCatalog}
              search={search}
              onSearchChange={setSearch}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              lineItems={lineItems}
              onAddItem={handleAddSimpleItem}
              onRemoveItem={handleRemoveSimpleItem}
              onCustomizeItem={setActiveModalItem}
              isLoading={menuLoading}
            />
          </div>

          <div className={`${activeTab === 'CART' ? 'block' : 'hidden 2xl:block'} min-w-0`}>
            <CartPanel
              items={lineItems}
              onUpdateQuantity={handleUpdateQuantity}
              onRemove={(id) => handleUpdateQuantity(id, -Infinity)}
              subtotal={subtotal}
              tax={tax}
              total={total}
              isExpanded={isContextExpanded}
              onToggleExpand={() => setIsContextExpanded((value) => !value)}
              guestContext={guestContext}
              onUpdateContext={setGuestContext}
              linkedSessionSummary={
                linkedSession
                  ? {
                      label: linkedSession.tokenLabel,
                      guestName: linkedSession.guestName,
                      phone: formatPhonePreview(linkedSession.guestPhone),
                    }
                  : null
              }
              activeSessions={counterSessions}
              linkedSessionKey={linkedSession?.key || null}
              onSelectSession={handleSelectSession}
              onCollectBill={(sessionId) => finishSessionMutation.mutate(sessionId)}
              billingSessionId={finishSessionMutation.isPending ? finishSessionMutation.variables ?? null : null}
              onClearLinkedSession={() => {
                handleNewSession();
                setLookupMessage('Session decoupled.');
                setLookupMessageType('info');
              }}
              submitBlockedReason={submitBlockedReason}
              onSubmit={() => submitMutation.mutate()}
              isSubmitting={submitMutation.isPending}
            />
          </div>
        </div>

        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} cartItemCount={lineItems.length} />

        <AnimatePresence>
          {activeModalItem && (
            <ModifierSheet
              item={activeModalItem}
              onClose={() => setActiveModalItem(null)}
              onAdd={(lineItem) => {
                setLineItems((current) => [...current, lineItem]);
                setActiveModalItem(null);
              }}
            />
          )}
        </AnimatePresence>

        <MobileSearchLayer
          isOpen={activeTab === 'SEARCH'}
          onClose={() => setActiveTab('MENU')}
          search={search}
          onSearchChange={setSearch}
          displayedCatalog={displayedCatalog}
          menuLoading={menuLoading}
          lineItems={lineItems}
          handleAddSimpleItem={handleAddSimpleItem}
          handleRemoveSimpleItem={handleRemoveSimpleItem}
          setActiveModalItem={setActiveModalItem}
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-[1.5rem] border px-4 py-3 shadow-lg ${
        accent ? 'border-blue-400/20 bg-blue-600 text-white shadow-blue-900/20' : 'border-white/6 bg-slate-950/70 text-white'
      }`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${accent ? 'bg-white/15' : 'bg-white/5 text-blue-400'}`}>
        {icon}
      </div>
      <div className="space-y-0.5">
        <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${accent ? 'text-blue-100' : 'text-slate-500'}`}>
          {label}
        </p>
        <p className="text-[17px] font-black tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function MobileSearchLayer({
  isOpen,
  onClose,
  search,
  onSearchChange,
  displayedCatalog,
  menuLoading,
  lineItems,
  handleAddSimpleItem,
  handleRemoveSimpleItem,
  setActiveModalItem,
}: any) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          className="fixed inset-0 z-[140] flex flex-col bg-slate-950 px-4 pb-28 pt-6 2xl:hidden"
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                autoFocus
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search menu catalogue..."
                className="h-14 w-full rounded-2xl border border-white/6 bg-slate-900 pl-12 pr-4 text-sm font-black text-white outline-none transition-all focus:border-blue-500/50"
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-14 rounded-2xl border border-white/6 bg-white/5 px-5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300"
            >
              Exit
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-[2rem] border border-white/6">
            <MenuGrid
              categories={displayedCatalog}
              search={search}
              onSearchChange={onSearchChange}
              selectedCategory="ALL"
              onCategoryChange={() => {}}
              lineItems={lineItems}
              onAddItem={handleAddSimpleItem}
              onRemoveItem={handleRemoveSimpleItem}
              onCustomizeItem={setActiveModalItem}
              isLoading={menuLoading}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
