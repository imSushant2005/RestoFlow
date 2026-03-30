import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { publicApi } from '../lib/api';
import { MenuSection } from '../components/MenuSection';
import { CartDrawer } from '../components/CartDrawer';
import { formatINR } from '../lib/currency';
import { Utensils, UtensilsCrossed, Package, ArrowLeft, Search } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useState, useRef, useDeferredValue, startTransition } from 'react';
import { Helmet } from 'react-helmet-async';

export function Storefront() {
  const { tenantSlug, tableId } = useParams();
  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { items: cartItems, customerName, setCustomerInfo } = useCartStore();
  const [searchParams] = useSearchParams();
  const seatParam = searchParams.get('seat');
  const headerRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN');
  const [searchText, setSearchText] = useState('');
  const deferredSearch = useDeferredValue(searchText.trim().toLowerCase());

  const { data: menuData, isLoading, error } = useQuery({
    queryKey: ['menu', tenantSlug],
    queryFn: async () => {
      const res = await publicApi.get(`/${tenantSlug}/menu`);
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const createSessionMutation = useMutation({
    mutationFn: (data: { sessionId: string; seat?: string }) => publicApi.post(`/tables/${tableId}/session`, data),
    onError: (err: any) => console.error('Failed to create session:', err),
  });

  const totalItems = cartItems.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = useCartStore.getState().getCartTotal();
  const categories = Array.isArray(menuData?.categories) ? menuData.categories : [];
  const filteredCategories = deferredSearch
    ? categories
        .map((category: any) => ({
          ...category,
          menuItems: (Array.isArray(category?.menuItems) ? category.menuItems : []).filter((item: any) => {
            const nameMatch = String(item?.name || '').toLowerCase().includes(deferredSearch);
            const descMatch = String(item?.description || '').toLowerCase().includes(deferredSearch);
            return nameMatch || descMatch;
          }),
        }))
        .filter((category: any) => category.menuItems.length > 0)
    : categories;
  const restaurantName = menuData?.name || 'Restaurant';
  const logoUrl = menuData?.logoUrl || '';
  const brandColor = menuData?.primaryColor || '#f97316';
  const accentColor = menuData?.accentColor || '#111827';

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-white">
        <div className="h-16 px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-100 rounded-full shimmer"></div>
          <div className="w-32 h-5 bg-gray-200 rounded-full shimmer"></div>
        </div>
        <div className="flex gap-3 overflow-x-hidden px-5 py-4">
          <div className="w-24 h-9 bg-gray-100 rounded-full shimmer flex-shrink-0"></div>
          <div className="w-28 h-9 bg-gray-100 rounded-full shimmer flex-shrink-0"></div>
          <div className="w-20 h-9 bg-gray-100 rounded-full shimmer flex-shrink-0"></div>
        </div>
        <div className="px-5 grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="w-full h-40 shimmer"></div>
              <div className="p-3 space-y-2">
                <div className="w-3/4 h-4 bg-gray-100 rounded shimmer"></div>
                <div className="w-1/2 h-4 bg-gray-50 rounded shimmer"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !menuData) {
    return (
      <div className="p-8 text-center text-red-500 mt-20 font-semibold">
        Restaurant menu not found.
      </div>
    );
  }

  if (!customerName) {
    return (
      <div
        className="min-h-[100dvh] bg-white flex flex-col fade-in"
        style={
          {
            '--brand': brandColor,
            '--accent': accentColor,
            '--brand-soft': `${brandColor}22`,
          } as React.CSSProperties
        }
      >
        <style>{`
          .bg-brand { background-color: var(--brand); }
          .text-brand { color: var(--brand); }
          .border-brand { border-color: var(--brand); }
          .focus\\:border-brand:focus { border-color: var(--brand); }
          .hover\\:bg-brand-dark:hover { filter: brightness(0.9); background-color: var(--brand); }
        `}</style>

        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 font-semibold px-5 pt-5 text-sm w-fit">
          <ArrowLeft size={18} /> Back
        </button>

        <div className="flex-1 flex flex-col justify-center items-center px-6 pb-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border border-white/50 bg-[color:var(--brand-soft)] overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt={`${restaurantName} logo`} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <UtensilsCrossed size={32} className="text-brand" />
            )}
          </div>
          <h1 className="text-2xl font-black text-gray-900 text-center mb-1">{restaurantName}</h1>
          <p className="text-gray-400 text-sm text-center mb-8">Tell us who you are before we start</p>

          <div className="w-full max-w-sm space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3.5 font-medium focus:border-brand outline-none transition-colors text-gray-900"
                placeholder="e.g. Arjun Singh"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3.5 font-medium focus:border-brand outline-none transition-colors text-gray-900"
                placeholder="+91 98765 43210"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Order Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setType('DINE_IN')}
                  className={`flex flex-col items-center justify-center py-4 border-2 rounded-2xl font-bold text-sm transition-all ${
                    type === 'DINE_IN' ? 'border-brand bg-[color:var(--brand-soft)] text-brand' : 'border-gray-100 text-gray-500 hover:border-gray-200'
                  }`}
                >
                  <Utensils size={22} className="mb-1.5" /> Dine In
                </button>
                <button
                  onClick={() => setType('TAKEAWAY')}
                  className={`flex flex-col items-center justify-center py-4 border-2 rounded-2xl font-bold text-sm transition-all ${
                    type === 'TAKEAWAY' ? 'border-brand bg-[color:var(--brand-soft)] text-brand' : 'border-gray-100 text-gray-500 hover:border-gray-200'
                  }`}
                >
                  <Package size={22} className="mb-1.5" /> Takeaway
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                if (name.trim() && phone.trim()) {
                  setCustomerInfo({ name, phone, type, seat: seatParam || undefined });
                  if (tableId) {
                    createSessionMutation.mutate({
                      sessionId: localStorage.getItem('restoflow_session') || localStorage.getItem('dineflow_session') || name,
                      seat: seatParam || undefined,
                    });
                  }
                } else {
                  alert('Please enter your name and phone number.');
                }
              }}
              disabled={createSessionMutation.isPending}
              className="w-full bg-brand hover:bg-brand-dark active:scale-[0.98] text-white font-black py-4 rounded-2xl shadow-lg transition-all mt-2"
            >
              {createSessionMutation.isPending ? 'Starting...' : 'See the Menu ->'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-h-screen bg-[color:var(--bg-primary)] text-[color:var(--text-primary)] transition-colors duration-300"
      style={
        {
          '--brand': brandColor,
          '--accent': accentColor,
          '--brand-soft': `${brandColor}22`,
        } as React.CSSProperties
      }
    >
      <style>{`
        .bg-brand { background-color: var(--brand); }
        .text-brand { color: var(--brand); }
        .border-brand { border-color: var(--brand); }
        .focus\\:border-brand:focus { border-color: var(--brand); }
        .hover\\:bg-brand-dark:hover { filter: brightness(0.9); background-color: var(--brand); }
      `}</style>

      <Helmet>
        <title>{restaurantName} | Order Online</title>
        <meta name="description" content={`Order delicious food from ${restaurantName}. Browse our digital menu and order ahead.`} />
        <meta property="og:title" content={`${restaurantName} | RestoFlow`} />
      </Helmet>

      <header ref={headerRef} className="bg-[color:var(--bg-secondary)] sticky top-0 z-30 border-b border-[color:var(--border-primary)] shadow-sm transition-colors duration-300">
        <div className="flex items-center justify-between px-5 py-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[color:var(--brand-soft)] border border-[color:var(--border-primary)] overflow-hidden flex items-center justify-center flex-shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt={`${restaurantName} logo`} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <UtensilsCrossed size={20} className="text-brand" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-black text-gray-900 text-base leading-tight truncate">{restaurantName}</h1>
              {tableId && (
                <span className="text-xs font-semibold text-brand">
                  Table {tableId}
                  {seatParam ? ` · Seat ${seatParam}` : ''}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => navigate(`/order/${tenantSlug}/status`)} className="text-xs font-bold text-gray-400 hover:text-gray-700 transition-colors">
            My Orders
          </button>
        </div>

        <div className="px-5 pb-3">
          <label className="flex items-center gap-2 rounded-xl border border-[color:var(--border-primary)] bg-[color:var(--bg-primary)] px-3 py-2.5">
            <Search size={16} className="text-[color:var(--text-secondary)]" />
            <input
              value={searchText}
              onChange={(e) => startTransition(() => setSearchText(e.target.value))}
              className="w-full bg-transparent outline-none text-sm font-medium text-[color:var(--text-primary)] placeholder:text-[color:var(--text-secondary)]"
              placeholder="Search dishes..."
            />
          </label>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3 px-5 custom-scrollbar">
          {filteredCategories.map((c: any) => (
            <a
              key={c?.id || c?.name}
              href={`#category-${c?.id}`}
              className="whitespace-nowrap text-xs font-bold px-4 py-2 rounded-full border border-gray-100 bg-white text-gray-600 hover:border-brand hover:text-brand transition-colors flex-shrink-0 shadow-sm"
            >
              {c?.name || 'Category'}
            </a>
          ))}
        </div>
      </header>

      <div className="flex-1 pb-32">
        <div className="px-4 py-5 space-y-10">
          {filteredCategories.map((category: any, index: number) => (
            <div key={category?.id || `category-${index}`} id={`category-${category?.id}`} className="scroll-mt-28">
              <MenuSection category={category} />
            </div>
          ))}
          {filteredCategories.length === 0 && (
            <div className="text-center py-12">
              <p className="font-bold text-gray-700">No dishes found</p>
              <p className="text-sm text-gray-400 mt-1">Try a different keyword.</p>
            </div>
          )}
        </div>

        <div className="text-center py-6">
          <p className="text-xs text-gray-300 font-medium">
            Powered by <span className="font-bold text-gray-400">RestoFlow</span>
          </p>
        </div>
      </div>

      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-20" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-brand hover:bg-brand-dark active:scale-[0.98] text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-between px-5 transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="bg-white/20 text-white text-sm font-black px-2.5 py-0.5 rounded-full cart-badge">{totalItems}</span>
              <span>View Cart</span>
            </div>
            <span className="font-black text-base">{formatINR(cartTotal)}</span>
          </button>
        </div>
      )}

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} tenantSlug={tenantSlug!} tableId={tableId} />
    </div>
  );
}
