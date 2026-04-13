import { useEffect, useMemo, useState, useDeferredValue, startTransition } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  LayoutDashboard,
  Menu as MenuIcon,
  Package,
  Search,
  Sparkles,
  Utensils,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { publicApi } from '../lib/api';
import { MenuSection } from '../components/MenuSection';
import { CartDrawer } from '../components/CartDrawer';
import { LoyaltyBanner } from '../components/LoyaltyBanner';
import { formatINR } from '../lib/currency';
import { useCartStore } from '../store/cartStore';
import { getActiveSessionForTenant, getTenantStorageItem, setTenantStorageItem } from '../lib/tenantStorage';

type FoodFilter = 'ALL' | 'VEG' | 'NON_VEG' | 'EGG';

const FILTER_OPTIONS: Array<{ key: FoodFilter; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'VEG', label: 'Veg' },
  { key: 'NON_VEG', label: 'Non-Veg' },
  { key: 'EGG', label: 'Egg' },
];

function matchesFoodFilter(filter: FoodFilter, item: any) {
  if (filter === 'ALL') return true;
  if (filter === 'VEG') return Boolean(item?.isVeg);
  if (filter === 'EGG') return Boolean(item?.isEgg);
  return !item?.isVeg && !item?.isEgg;
}

export function Storefront() {
  const { tenantSlug, tableId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const seatParam = searchParams.get('seat');

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN');
  const [searchText, setSearchText] = useState('');
  const [foodFilter, setFoodFilter] = useState<FoodFilter>('ALL');

  const deferredSearch = useDeferredValue(searchText.trim().toLowerCase());
  const { items: cartItems, customerName, setCustomerInfo, setTenantScope } = useCartStore();
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + item.totalPrice * item.quantity, 0);

  const rfName = getTenantStorageItem(tenantSlug, 'customer_name');
  const rfPhone = getTenantStorageItem(tenantSlug, 'customer_phone');
  const customerId = getTenantStorageItem(tenantSlug, 'customer_id');
  const activeSessionId = getActiveSessionForTenant(tenantSlug);
  const hasTableRoute = Boolean(tableId && tableId !== 'undefined');
  const isTakeawayEntry = !hasTableRoute;

  const { data: menuData, isLoading, error } = useQuery({
    queryKey: ['menu', tenantSlug],
    queryFn: async () => {
      const response = await publicApi.get(`/${tenantSlug}/menu`);
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    setTenantScope(tenantSlug || undefined);
  }, [setTenantScope, tenantSlug]);

  useEffect(() => {
    if (!customerName && rfName && rfPhone) {
      setCustomerInfo({
        name: rfName,
        phone: rfPhone,
        type: 'DINE_IN',
        seat: seatParam || undefined,
      });
    }
  }, [customerName, rfName, rfPhone, seatParam, setCustomerInfo]);

  useEffect(() => {
    if (!tenantSlug || !hasTableRoute || activeSessionId) return;

    if (!customerId) {
      navigate(`/order/${tenantSlug}/${tableId}`, { replace: true });
      return;
    }

    navigate(`/order/${tenantSlug}/${tableId}/party`, { replace: true });
  }, [activeSessionId, customerId, hasTableRoute, navigate, tableId, tenantSlug]);

  const categories = useMemo(() => (Array.isArray(menuData?.categories) ? menuData.categories : []), [menuData]);

  const filteredCategories = useMemo(() => {
    if (!deferredSearch && foodFilter === 'ALL') return categories;

    return categories
      .map((category: any) => ({
        ...category,
        menuItems: (Array.isArray(category?.menuItems) ? category.menuItems : []).filter((item: any) => {
          if (!matchesFoodFilter(foodFilter, item)) return false;
          if (!deferredSearch) return true;

          const nameMatch = String(item?.name || '').toLowerCase().includes(deferredSearch);
          const descriptionMatch = String(item?.description || '').toLowerCase().includes(deferredSearch);
          return nameMatch || descriptionMatch;
        }),
      }))
      .filter((category: any) => category.menuItems.length > 0);
  }, [categories, deferredSearch, foodFilter]);

  const recommendedItems = useMemo(
    () =>
      categories
        .flatMap((category: any) =>
          (Array.isArray(category?.menuItems) ? category.menuItems : []).map((item: any) => ({
            ...item,
            _categoryId: category.id,
          })),
        )
        .filter(
          (item: any) =>
            (item?.isPopular || item?.isBestSeller || item?.isChefSpecial) && matchesFoodFilter(foodFilter, item),
        )
        .slice(0, 8),
    [categories, foodFilter],
  );

  const restaurantName = menuData?.name || 'Restaurant';
  const logoUrl = menuData?.logoUrl || '';
  const brandColor = menuData?.primaryColor || '#f97316';

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col" style={{ background: 'var(--bg)' }}>
        <div
          className="flex h-16 items-center gap-3 px-6 py-4 animate-pulse"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="h-8 w-8 rounded-full" style={{ background: 'var(--surface-3)' }} />
          <div className="h-5 w-32 rounded-full" style={{ background: 'var(--surface-3)' }} />
        </div>
        <div className="flex gap-3 overflow-x-hidden px-5 py-4">
          <div className="h-9 w-24 flex-shrink-0 rounded-full" style={{ background: 'var(--surface-3)' }} />
          <div className="h-9 w-28 flex-shrink-0 rounded-full" style={{ background: 'var(--surface-3)' }} />
        </div>
        <div className="grid grid-cols-2 gap-4 px-5">
          {[1, 2, 3, 4].map((placeholder) => (
            <div
              key={placeholder}
              className="overflow-hidden rounded-2xl animate-pulse"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="shimmer h-40 w-full" />
              <div className="space-y-2 p-3">
                <div className="shimmer h-4 w-3/4 rounded" />
                <div className="shimmer h-4 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !menuData) {
    return (
      <div className="mt-20 p-8 text-center font-semibold" style={{ color: 'var(--error)' }}>
        Restaurant menu not found.
      </div>
    );
  }

  if (hasTableRoute && !activeSessionId) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div
          className="h-10 w-10 animate-spin rounded-full border-4"
          style={{ borderColor: 'var(--brand-soft)', borderTopColor: 'var(--brand)' }}
        />
      </div>
    );
  }

  if (isTakeawayEntry && !customerName && !rfName) {
    return (
      <div
        className="relative flex min-h-[100dvh] flex-col overflow-hidden fade-in"
        style={{ background: 'var(--bg)', '--brand': brandColor } as any}
      >
        <div
          className="absolute right-[-10%] top-[-10%] h-[30%] w-[50%] rounded-full opacity-20 blur-[120px]"
          style={{ background: 'var(--brand)' }}
        />
        <div
          className="absolute bottom-[-10%] left-[-10%] h-[30%] w-[50%] rounded-full opacity-10 blur-[120px]"
          style={{ background: 'var(--brand)' }}
        />

        <header className="relative z-10 flex items-center justify-between p-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold transition-all hover:bg-black/5"
            style={{ color: 'var(--text-3)' }}
          >
            <ArrowLeft size={18} /> Back
          </button>
        </header>

        <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-8 pb-10">
          <div
            className="mb-8 flex h-20 w-20 rotate-3 items-center justify-center rounded-3xl border shadow-xl transition-transform hover:rotate-0"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt={`${restaurantName} logo`} className="h-full w-full rounded-3xl object-cover" />
            ) : (
              <UtensilsCrossed size={40} style={{ color: 'var(--brand)' }} />
            )}
          </div>

          <h1 className="mb-2 text-4xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
            {restaurantName}
          </h1>
          <p className="mb-10 text-lg font-medium" style={{ color: 'var(--text-3)' }}>
            Welcome to our digital menu. Enter your details to get started.
          </p>

          <div className="space-y-6">
            <div className="relative">
              <label
                className="absolute left-4 top-[-10px] z-10 px-1 text-[10px] font-black uppercase tracking-widest"
                style={{ color: 'var(--brand)', background: 'var(--bg)' }}
              >
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-2xl px-5 py-4 font-bold outline-none transition-all placeholder:text-gray-400"
                style={{ background: 'var(--surface)', border: '2px solid var(--border)', color: 'var(--text-1)' }}
                placeholder="e.g. Arjun Singh"
              />
            </div>

            <div className="relative">
              <label
                className="absolute left-4 top-[-10px] z-10 px-1 text-[10px] font-black uppercase tracking-widest"
                style={{ color: 'var(--brand)', background: 'var(--bg)' }}
              >
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full rounded-2xl px-5 py-4 font-bold outline-none transition-all placeholder:text-gray-400"
                style={{ background: 'var(--surface)', border: '2px solid var(--border)', color: 'var(--text-1)' }}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setType('DINE_IN')}
                className={`flex flex-col items-center justify-center rounded-3xl border-2 py-5 text-sm font-black transition-all ${
                  type === 'DINE_IN' ? 'scale-[1.02] shadow-lg' : 'opacity-60 grayscale-[0.5]'
                }`}
                style={{
                  borderColor: type === 'DINE_IN' ? 'var(--brand)' : 'var(--border)',
                  background: type === 'DINE_IN' ? 'var(--brand-soft)' : 'var(--surface)',
                  color: type === 'DINE_IN' ? 'var(--brand)' : 'var(--text-3)',
                }}
              >
                <Utensils size={24} className="mb-2" /> Dine In
              </button>
              <button
                onClick={() => setType('TAKEAWAY')}
                className={`flex flex-col items-center justify-center rounded-3xl border-2 py-5 text-sm font-black transition-all ${
                  type === 'TAKEAWAY' ? 'scale-[1.02] shadow-lg' : 'opacity-60 grayscale-[0.5]'
                }`}
                style={{
                  borderColor: type === 'TAKEAWAY' ? 'var(--brand)' : 'var(--border)',
                  background: type === 'TAKEAWAY' ? 'var(--brand-soft)' : 'var(--surface)',
                  color: type === 'TAKEAWAY' ? 'var(--brand)' : 'var(--text-3)',
                }}
              >
                <Package size={24} className="mb-2" /> Takeaway
              </button>
            </div>

            <button
              onClick={() => {
                if (!name.trim() || !phone.trim()) {
                  alert('Please enter your name and phone number.');
                  return;
                }

                localStorage.setItem('rf_customer_name', name.trim());
                localStorage.setItem('rf_customer_phone', phone.trim());
                setTenantStorageItem(tenantSlug, 'customer_name', name.trim());
                setTenantStorageItem(tenantSlug, 'customer_phone', phone.trim());
                setCustomerInfo({ name: name.trim(), phone: phone.trim(), type, seat: seatParam || undefined });
              }}
              className="mt-4 flex w-full items-center justify-center gap-3 rounded-3xl bg-[#1a1c23] py-4 font-black text-white shadow-2xl transition-all hover:bg-black"
            >
              Explore Menu <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col transition-colors duration-400"
      style={{
        background: 'var(--bg)',
        '--brand': brandColor,
        paddingBottom: 'calc(var(--customer-nav-space) + var(--customer-page-action-height) + 2rem)',
      } as any}
    >
      <Helmet>
        <title>{restaurantName} | Order Online</title>
        <meta name="description" content={`Order delicious food from ${restaurantName}.`} />
      </Helmet>

      {activeSessionId && (
        <div
          onClick={() => navigate(`/order/${tenantSlug}/session/${activeSessionId}`)}
          className="relative z-30 flex cursor-pointer items-center justify-between bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-3 shadow-lg"
        >
          <span className="flex items-center gap-2 text-xs font-black text-white">
            <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_8px_white] animate-pulse" />
            ACTIVE SESSION | Add more items anytime
          </span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
            Open tracker
          </span>
        </div>
      )}

      <header
        className="sticky top-0 z-20 shadow-sm transition-all duration-300"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-md transition-transform active:scale-90"
              style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt={restaurantName} className="h-full w-full object-cover" />
              ) : (
                <UtensilsCrossed size={20} style={{ color: 'var(--brand)' }} />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-black leading-tight" style={{ color: 'var(--text-1)' }}>
                {restaurantName}
              </h1>
              {tableId && (
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--brand)' }}>
                  Table {tableId}{seatParam ? ` | Seat ${seatParam}` : ''}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate(activeSessionId ? `/order/${tenantSlug}/session/${activeSessionId}` : `/order/${tenantSlug}/history`)}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.14em] hover:bg-black/5"
            style={{ color: 'var(--text-3)', background: 'var(--surface-3)' }}
          >
            <LayoutDashboard size={16} />
            {activeSessionId ? 'Tracker' : 'History'}
          </button>
        </div>

        <div className="px-5 pb-4">
          <div
            className="relative flex items-center gap-2 rounded-2xl border px-3.5 py-3 transition-all focus-within:shadow-lg"
            style={{ background: 'var(--surface-3)', borderColor: 'var(--border)' }}
          >
            <Search size={18} style={{ color: 'var(--text-3)' }} />
            <input
              value={searchText}
              onChange={(event) => startTransition(() => setSearchText(event.target.value))}
              className="w-full bg-transparent text-sm font-bold outline-none placeholder:font-medium"
              style={{ color: 'var(--text-1)' }}
              placeholder="Search dishes, burgers..."
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {FILTER_OPTIONS.map((option) => {
              const selected = foodFilter === option.key;
              return (
                <button
                  key={option.key}
                  onClick={() => setFoodFilter(option.key)}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition-all ${
                    selected ? 'shadow-md' : ''
                  }`}
                  style={{
                    borderColor: selected ? 'var(--brand)' : 'var(--border)',
                    color: selected ? 'white' : 'var(--text-3)',
                    background: selected ? 'var(--brand)' : 'var(--surface)',
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em]"
              style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
            >
              {hasTableRoute ? `Table ${tableId}${seatParam ? ` | Seat ${seatParam}` : ''}` : 'Takeaway / pickup'}
            </span>
            {activeSessionId ? (
              <span
                className="rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em]"
                style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
              >
                Session open
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto mt-6 flex w-full max-w-[1400px] lg:px-8">
        <aside className="relative hidden w-72 flex-shrink-0 lg:block">
          <div
            className="sticky top-[110px] overflow-hidden rounded-3xl shadow-xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="flex items-center gap-2 px-6 py-5 text-xs font-black uppercase tracking-widest"
              style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
            >
              <MenuIcon size={16} /> Categories
            </div>
            <div className="custom-scrollbar flex max-h-[60vh] flex-col overflow-y-auto py-3">
              {filteredCategories.map((category: any) => (
                <a
                  key={category.id}
                  href={`#category-${category.id}`}
                  className="border-l-[4px] border-transparent px-6 py-4 text-sm font-black transition-all hover:px-8"
                  style={{ color: 'var(--text-2)' }}
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById(`category-${category.id}`)?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }}
                >
                  {category.name}
                </a>
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div
            className="group relative mx-4 mb-8 overflow-hidden rounded-[32px] p-6 shadow-2xl lg:mx-0"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #8b5cf6)' }}
          >
            <div className="absolute right-0 top-0 h-32 w-32 scale-150 rounded-full bg-white/10 blur-2xl transition-transform group-hover:scale-[2]" />
            <div className="relative z-10">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                <Sparkles size={12} /> AI TasteMatch
              </div>
              <h3 className="mb-2 text-2xl font-black leading-tight text-white">Can&apos;t decide yet?</h3>
              <p className="max-w-sm font-medium text-white/80">
                Try our chef-special AI recommended items based on local trends.
              </p>
            </div>
          </div>

          <div className="px-4 lg:px-0">
            <LoyaltyBanner tenantSlug={tenantSlug || ''} />
          </div>

          <div className="space-y-12 px-0 py-4 sm:px-4">
            {recommendedItems.length > 0 && !deferredSearch && (
              <section className="px-4 sm:px-0">
                <h2 className="mb-4 px-1 text-xl font-black" style={{ color: 'var(--text-1)' }}>
                  Bestsellers
                </h2>
                <div className="custom-scrollbar flex snap-x gap-4 overflow-x-auto pb-4">
                  {recommendedItems.map((item: any) => (
                    <div
                      key={item.id}
                      className="min-w-[210px] snap-start overflow-hidden rounded-[28px] shadow-xl transition-transform active:scale-95"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                    >
                      <div className="relative h-28 overflow-hidden">
                        <img
                          src={item?.imageUrl || item?.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'}
                          alt={item.name}
                          className="h-full w-full object-cover transition-transform hover:scale-110"
                        />
                        <div className="absolute right-2 top-2 rounded-full bg-white px-2 py-1 text-[9px] font-black text-black shadow-lg">
                          ★ 4.9
                        </div>
                      </div>
                      <div className="p-4">
                        <div
                          className="mb-1 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                          style={{
                            borderColor: item?.isVeg ? '#86efac' : item?.isEgg ? '#fdba74' : '#fca5a5',
                            color: item?.isVeg ? '#15803d' : item?.isEgg ? '#c2410c' : '#b91c1c',
                            background: item?.isVeg ? '#f0fdf4' : item?.isEgg ? '#fff7ed' : '#fef2f2',
                          }}
                        >
                          {item?.isVeg ? 'Veg' : item?.isEgg ? 'Egg' : 'Non-Veg'}
                        </div>
                        <p className="mb-1 truncate text-sm font-black" style={{ color: 'var(--text-1)' }}>
                          {item.name}
                        </p>
                        <p className="mb-3 text-xs font-black text-brand">{formatINR(item.price)}</p>
                        <button
                          onClick={() =>
                            document.getElementById(`category-${item._categoryId}`)?.scrollIntoView({ behavior: 'smooth' })
                          }
                          className="w-full rounded-xl py-2 text-center text-[10px] font-black uppercase tracking-widest"
                          style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
                        >
                          Find in menu
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="space-y-12">
              {filteredCategories.map((category: any) => (
                <div key={category.id} id={`category-${category.id}`} className="scroll-mt-40 lg:scroll-mt-24">
                  <MenuSection category={category} />
                </div>
              ))}

              {filteredCategories.length === 0 && (
                <div className="py-20 text-center">
                  <div className="mb-4 flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}>
                      <Search size={28} />
                    </div>
                  </div>
                  <p className="text-lg font-black" style={{ color: 'var(--text-2)' }}>
                    No matching dishes found
                  </p>
                  <p className="font-medium" style={{ color: 'var(--text-3)' }}>
                    Try searching for ingredients or categories.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed left-0 right-0 z-[60]" style={{ bottom: 'var(--customer-action-bottom)' }}>
        <div className="mx-auto flex max-w-screen-sm flex-col items-center gap-3 p-4">
          <button
            onClick={() => setIsMenuModalOpen(true)}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-[#1a1c23] px-6 py-3 text-xs font-black text-white shadow-2xl transition-all active:scale-95 hover:bg-black lg:hidden"
          >
            <MenuIcon size={14} /> Menu
          </button>

          {totalItems > 0 && (
            <button
              onClick={() => setIsCartOpen(true)}
              className="pointer-events-auto flex w-full items-center justify-between rounded-3xl border border-white/10 px-6 py-[1.125rem] font-black text-white shadow-2xl transition-all active:scale-[0.98]"
              style={{ background: 'var(--brand)' }}
            >
              <div className="flex items-center gap-3">
                <div className="cart-badge rounded-lg bg-white/20 px-2 py-0.5 text-sm font-black">{totalItems}</div>
                <span className="text-base tracking-tight">View Order</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black">{formatINR(cartTotal)}</span>
                <ChevronRight size={20} className="opacity-50" />
              </div>
            </button>
          )}
        </div>
      </div>

      {isMenuModalOpen && (
        <div className="fixed inset-0 z-[80] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMenuModalOpen(false)} />
          <div
            className="relative z-10 flex max-h-[75vh] flex-col overflow-hidden rounded-t-[40px] shadow-2xl slide-up"
            style={{
              background: 'var(--surface)',
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
            }}
          >
            <div className="flex items-center justify-between border-b p-6" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-xl font-black" style={{ color: 'var(--text-1)' }}>
                Our Menu
              </h3>
              <button
                onClick={() => setIsMenuModalOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-black/5"
                style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="custom-scrollbar overflow-y-auto px-4 py-4 pb-10">
              {categories.map((category: any) => (
                <a
                  key={category.id}
                  href={`#category-${category.id}`}
                  onClick={() => setIsMenuModalOpen(false)}
                  className="flex items-center justify-between border-b px-4 py-[1.125rem] font-bold transition-all active:translate-x-2"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
                >
                  {category.name}
                  <ChevronRight size={16} className="opacity-30" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} tenantSlug={tenantSlug!} tableId={tableId} />
    </div>
  );
}
