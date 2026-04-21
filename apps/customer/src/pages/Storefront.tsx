import { useEffect, useMemo, useState, useDeferredValue, startTransition } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  Menu as MenuIcon,
  Search,
  ShieldCheck,
  Store,
  Utensils,
  UtensilsCrossed,
  WifiOff,
  X,
} from 'lucide-react';
import { publicApi } from '../lib/api';
import { formatINR } from '../lib/currency';
import { buildCustomerThemeVars } from '../lib/customerTheme';
import { readMenuSnapshot, writeMenuSnapshot } from '../lib/menuSnapshot';
import { getCustomerServiceCopy } from '../lib/serviceMode';
import {
  getActiveSessionForTenant,
  getTenantStorageItem,
  setCustomerAuthForTenant,
  setTenantStorageItem,
} from '../lib/tenantStorage';
import { BrandLogo } from '../components/BrandLogo';
import { CartDrawer } from '../components/CartDrawer';
import { MenuSection } from '../components/MenuSection';
import { ModifierModal } from '../components/ModifierModal';
import { useCartStore } from '../store/cartStore';
import { useLanguage } from '../contexts/LanguageContext';

type FoodFilter = 'ALL' | 'VEG' | 'NON_VEG' | 'EGG';

const FILTER_OPTIONS: Array<{ key: FoodFilter; labelKey: string }> = [
  { key: 'ALL', labelKey: 'filter.all' },
  { key: 'VEG', labelKey: 'filter.veg' },
  { key: 'NON_VEG', labelKey: 'filter.nonveg' },
  { key: 'EGG', labelKey: 'filter.egg' },
];

function matchesFoodFilter(filter: FoodFilter, item: any) {
  if (filter === 'ALL') return true;
  if (filter === 'VEG') return Boolean(item?.isVeg);
  if (filter === 'EGG') return Boolean(item?.isEgg);
  return !item?.isVeg && !item?.isEgg;
}

function getTodayHours(businessHours: any) {
  if (!businessHours || typeof businessHours !== 'object') return null;
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()).toLowerCase();
  const today = businessHours?.[weekday];
  if (!today || typeof today !== 'object') return null;

  if (today.isOpen === false) {
    return { label: 'Closed today', tone: 'muted' as const };
  }

  if (today.open && today.close) {
    return { label: `Open today | ${today.open} - ${today.close}`, tone: 'live' as const };
  }

  return { label: 'Hours available', tone: 'muted' as const };
}

export function Storefront() {
  const { tenantSlug, tableId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const seatParam = searchParams.get('seat');

  const [intakeError, setIntakeError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [foodFilter, setFoodFilter] = useState<FoodFilter>('ALL');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [intakeSubmitting, setIntakeSubmitting] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeMenuItem, setActiveMenuItem] = useState<any | null>(null);

  const deferredSearch = useDeferredValue(searchText.trim().toLowerCase());
  const {
    items: cartItems,
    addItem,
    customerName,
    orderType,
    setCustomerInfo,
    setOrderType,
    setTenantScope,
    setTenantPlan,
    setTenantBusinessType,
    activeSheet,
    setActiveSheet,
    isAnyModalOpen,
  } = useCartStore();
  const isMenuModalOpen = activeSheet === 'MENU';
  const { lang, setLang, t } = useLanguage();
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + item.totalPrice * item.quantity, 0);

  const rfName = getTenantStorageItem(tenantSlug, 'customer_name');
  const rfPhone = getTenantStorageItem(tenantSlug, 'customer_phone');
  const customerId = getTenantStorageItem(tenantSlug, 'customer_id');
  const activeSessionId = getActiveSessionForTenant(tenantSlug);
  const hasTableRoute = Boolean(tableId && tableId !== 'undefined');
  const isTakeawayEntry = !hasTableRoute;
  const menuSnapshot = useMemo(() => readMenuSnapshot(tenantSlug), [tenantSlug]);

  const {
    data: menuData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['menu', tenantSlug],
    queryFn: async () => {
      const response = await publicApi.get(`/${tenantSlug}/menu`);
      writeMenuSnapshot(tenantSlug, response.data);
      return response.data;
    },
    enabled: Boolean(tenantSlug),
    initialData: menuSnapshot?.data || undefined,
    initialDataUpdatedAt: 0,
    retry: 1,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    setTenantScope(tenantSlug || undefined);
    if (menuData?.plan) {
      setTenantPlan(menuData.plan);
    }
    if (menuData?.businessType) {
      setTenantBusinessType(menuData.businessType);
    }
  }, [menuData?.businessType, menuData?.plan, setTenantBusinessType, setTenantPlan, setTenantScope, tenantSlug]);

  useEffect(() => {
    if (hasTableRoute) {
      setOrderType('DINE_IN');
      return;
    }

    if (!activeSessionId) {
      setOrderType(undefined);
    }
  }, [activeSessionId, hasTableRoute, setOrderType]);

  useEffect(() => {
    if (!customerName && rfName && rfPhone) {
      setCustomerInfo({
        name: rfName,
        phone: rfPhone,
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

  useEffect(() => {
    if (activeSheet !== 'MODIFIER' && activeMenuItem) {
      setActiveMenuItem(null);
    }
  }, [activeMenuItem, activeSheet]);

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
          const tagMatch = Array.isArray(item?.tags)
            ? item.tags.some((tag: string) => String(tag || '').toLowerCase().includes(deferredSearch))
            : false;
          return nameMatch || descriptionMatch || tagMatch;
        }),
      }))
      .filter((category: any) => category.menuItems.length > 0);
  }, [categories, deferredSearch, foodFilter]);

  useEffect(() => {
    if (filteredCategories.length === 0) {
      setActiveCategoryId(null);
      return;
    }

    setActiveCategoryId((current) =>
      current && filteredCategories.some((category: any) => category.id === current)
        ? current
        : filteredCategories[0]?.id || null,
    );

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio || a.boundingClientRect.top - b.boundingClientRect.top);

        const nextEntry = visibleEntries[0];
        if (nextEntry?.target?.id) {
          setActiveCategoryId(nextEntry.target.id.replace('category-', ''));
        }
      },
      {
        rootMargin: '-20% 0px -55% 0px',
        threshold: [0.2, 0.45, 0.75],
      },
    );

    filteredCategories.forEach((category: any) => {
      const element = document.getElementById(`category-${category.id}`);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [filteredCategories]);

  const restaurantName = menuData?.name || 'Restaurant';
  const logoUrl = menuData?.logoUrl || menuData?.logo || menuData?.businessLogo || menuData?.restaurantLogo || '';
  const customerThemeVars = useMemo(() => buildCustomerThemeVars(menuData), [menuData]);
  const todayHours = getTodayHours(menuData?.businessHours);
  const activeServiceCopy = orderType ? getCustomerServiceCopy(orderType) : null;
  const activeCategory = filteredCategories.find((category: any) => category.id === activeCategoryId) || filteredCategories[0] || null;
  const storefrontBottomPadding =
    totalItems > 0 || filteredCategories.length > 1
      ? 'calc(var(--customer-nav-space) + var(--customer-page-action-height) + 4.5rem)'
      : 'calc(var(--customer-nav-space) + var(--customer-page-action-height) + 2rem)';

  const scrollToCategory = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    document.getElementById(`category-${categoryId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const handleOpenMenuItem = (menuItem: any) => {
    setActiveMenuItem(menuItem);
    setActiveSheet('MODIFIER');
  };

  const handleQuickAddMenuItem = (menuItem: any, hasModifierGroups: boolean) => {
    if (hasModifierGroups) {
      handleOpenMenuItem(menuItem);
      return;
    }

    addItem({
      id: `menu-${menuItem?.id || menuItem?.name || 'item'}-${Date.now()}`,
      menuItem,
      quantity: 1,
      modifiers: [],
      notes: '',
      totalPrice: Number(menuItem?.price || 0),
    });
  };

  const closeModifierSheet = () => {
    setActiveMenuItem(null);
    setActiveSheet('NONE');
  };

  if (isLoading && !menuData) {
    return (
      <div className="flex min-h-screen flex-col" style={{ background: 'var(--bg)' }}>
        <div
          className="flex h-16 items-center gap-3 px-6 py-4 animate-pulse"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="h-8 w-8 rounded-full" style={{ background: 'var(--surface-3)' }} />
          <div className="h-5 w-32 rounded-full" style={{ background: 'var(--surface-3)' }} />
        </div>
        <div className="mx-auto mt-5 grid w-full max-w-[1480px] gap-4 px-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="h-56 rounded-[30px] shimmer" />
          <div className="h-56 rounded-[30px] shimmer" />
        </div>
        <div className="mx-auto grid w-full max-w-[1480px] gap-5 px-5 py-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="hidden h-72 rounded-[28px] shimmer lg:block" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((placeholder) => (
              <div key={placeholder} className="overflow-hidden rounded-[28px] shimmer" style={{ minHeight: 210 }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !menuData) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-6 text-center" style={{ background: 'var(--bg)' }}>
        <div className="max-w-md rounded-[32px] border p-8" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--error)' }}
          >
            <WifiOff size={28} />
          </div>
          <h2 className="text-2xl font-black" style={{ color: 'var(--text-1)' }}>
            Menu unavailable right now
          </h2>
          <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-3)' }}>
            We couldn&apos;t load this restaurant menu. Check the connection and try again.
          </p>
          <button
            onClick={() => void refetch()}
            className="mt-6 rounded-2xl px-5 py-3 text-sm font-black text-white"
            style={{ background: 'var(--brand)' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (hasTableRoute && !activeSessionId) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div
          className="flex h-12 w-12 animate-spin rounded-full border-4"
          style={{ borderColor: 'var(--brand-soft)', borderTopColor: 'var(--brand)' }}
        />
      </div>
    );
  }

  if (isTakeawayEntry && !activeSessionId && !customerName && !rfName) {
    return (
      <div
        className="relative flex min-h-[100dvh] flex-col overflow-hidden fade-in"
        style={{ background: 'var(--bg)', ...customerThemeVars } as any}
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
              <BrandLogo
                src={logoUrl}
                name={restaurantName}
                alt={`${restaurantName} logo`}
                className="h-full w-full rounded-3xl"
                imageClassName="h-full w-full rounded-3xl bg-white/70 p-2 object-contain"
                fallbackClassName="rounded-3xl bg-white/15 text-[var(--brand)]"
                iconSize={40}
              />
            ) : (
              <UtensilsCrossed size={40} style={{ color: 'var(--brand)' }} />
            )}
          </div>

          <div className="mb-8 flex flex-wrap gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]"
              style={{ background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              <Store size={12} />
              Direct ordering
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]"
              style={{ background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              <ShieldCheck size={12} />
              Secure session
            </span>
          </div>

          <h1 className="mb-2 text-4xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
            {t('entry.orderFrom')} {restaurantName}
          </h1>
          <p className="mb-10 text-lg font-medium leading-relaxed" style={{ color: 'var(--text-3)' }}>
            {t('entry.startWith')}
          </p>

          <div className="space-y-6">
            <div className="relative">
              <label
                className="absolute left-4 top-[-10px] z-10 px-1 text-[10px] font-black uppercase tracking-widest"
                style={{ color: 'var(--brand)', background: 'var(--bg)' }}
              >
                {t('entry.displayName')}
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
                {t('entry.phone')}
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

            {intakeError ? (
              <div
                className="rounded-2xl border px-4 py-3 text-sm font-semibold"
                style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}
              >
                {intakeError}
              </div>
            ) : null}

            <button
              onClick={async () => {
                const normalizedName = name.trim();
                const normalizedPhone = phone.replace(/\D/g, '').slice(0, 10);

                if (!normalizedName || normalizedPhone.length < 10) {
                  setIntakeError('Enter a valid customer name and 10-digit mobile number.');
                  return;
                }

                setIntakeSubmitting(true);
                setIntakeError('');

                try {
                  const response = await publicApi.post('/customer/login', {
                    phone: normalizedPhone,
                    name: normalizedName,
                    tenantSlug: tenantSlug || undefined,
                  });

                  setCustomerAuthForTenant(tenantSlug, {
                    token: response.data.token,
                    customerId: response.data.customer.id,
                    customerName: response.data.customer.name || normalizedName,
                    customerPhone: response.data.customer.phone || normalizedPhone,
                  });

                  localStorage.setItem('rf_customer_name', response.data.customer.name || normalizedName);
                  localStorage.setItem('rf_customer_phone', response.data.customer.phone || normalizedPhone);
                  setTenantStorageItem(tenantSlug, 'customer_name', response.data.customer.name || normalizedName);
                  setTenantStorageItem(tenantSlug, 'customer_phone', response.data.customer.phone || normalizedPhone);
                  setCustomerInfo({
                    name: response.data.customer.name || normalizedName,
                    phone: response.data.customer.phone || normalizedPhone,
                    seat: seatParam || undefined,
                  });
                } catch (requestError: any) {
                  setIntakeError(requestError?.response?.data?.error || 'Unable to start ordering right now.');
                } finally {
                  setIntakeSubmitting(false);
                }
              }}
              disabled={intakeSubmitting}
              className="mt-4 flex w-full items-center justify-center gap-3 rounded-3xl bg-[#1a1c23] py-4 font-black text-white shadow-2xl transition-all hover:bg-black disabled:opacity-60"
            >
              {intakeSubmitting ? t('entry.signingIn') : t('entry.continue')} <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden transition-colors duration-400"
      style={{
        background: 'var(--bg)',
        ...customerThemeVars,
        paddingBottom: storefrontBottomPadding,
      } as any}
    >
      <Helmet>
        <title>{restaurantName} | Order Online</title>
        <meta
          name="description"
          content={`Order from ${restaurantName} with live kitchen updates, clear billing, and a simple customer-friendly tracker.`}
        />
      </Helmet>

      <div className="pointer-events-none absolute inset-x-0 top-[-6rem] h-72 bg-gradient-to-b from-white/8 to-transparent dark:from-white/[0.03]" />
      <div
        className="menu-ambient-orb pointer-events-none absolute left-[-8rem] top-20 h-56 w-56 rounded-full opacity-15 blur-[110px]"
        style={{ background: 'var(--brand)' }}
      />
      <div
        className="menu-ambient-orb pointer-events-none absolute bottom-20 right-[-6rem] h-72 w-72 rounded-full opacity-10 blur-[130px]"
        style={{ background: 'var(--accent)' }}
      />

      <header
        className="sticky top-0 z-[110] border-b backdrop-blur-xl transition-all duration-300"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="mx-auto max-w-[1480px] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-11 w-11 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
                {logoUrl ? (
                  <BrandLogo
                    src={logoUrl}
                    name={restaurantName}
                    alt={restaurantName}
                    className="h-full w-full"
                    imageClassName="h-full w-full bg-white/80 p-1.5 object-contain"
                    fallbackClassName="rounded-2xl bg-slate-50 text-[var(--brand)] dark:bg-slate-800"
                    iconSize={20}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <UtensilsCrossed size={18} style={{ color: 'var(--brand)' }} />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-lg font-black tracking-tight sm:text-xl" style={{ color: 'var(--text-1)' }}>
                    {restaurantName}
                  </h1>
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    {activeSessionId && activeServiceCopy ? `${activeServiceCopy.compactLabel} live order` : hasTableRoute ? 'Table ordering' : 'Direct ordering'}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {tableId ? (
                    <span className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                      Table {tableId}
                      {seatParam ? ` | Seat ${seatParam}` : ''}
                    </span>
                  ) : null}
                  {todayHours ? (
                    <span
                      className="text-[11px] font-bold"
                      style={{ color: todayHours.tone === 'live' ? '#10b981' : 'var(--text-3)' }}
                    >
                      {todayHours.label}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <button
              onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
              className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all"
              style={{
                color: 'var(--text-2)',
                background: lang === 'hi' ? 'rgba(249,115,22,0.12)' : 'var(--surface-3)',
                border: lang === 'hi' ? '1px solid rgba(249,115,22,0.24)' : '1px solid var(--border)',
              }}
              title={lang === 'en' ? 'Switch to Hinglish' : 'Switch to English'}
            >
              {lang === 'en' ? 'HI' : 'EN'}
            </button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div
              className="relative flex items-center gap-3 rounded-[22px] border px-4 py-3.5 shadow-sm transition-all"
              style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
            >
              <Search size={18} className="text-blue-500" />
              <input
                value={searchText}
                onChange={(event) => startTransition(() => setSearchText(event.target.value))}
                className="w-full bg-transparent text-sm font-bold outline-none placeholder:font-semibold placeholder:text-slate-400"
                style={{ color: 'var(--text-1)' }}
                placeholder={t('search.placeholder')}
              />
              {searchText ? (
                <button onClick={() => setSearchText('')} className="rounded-full p-1 text-slate-400 transition-all hover:bg-black/5 hover:text-slate-600">
                  <X size={14} />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {FILTER_OPTIONS.map((option) => {
                const selected = foodFilter === option.key;
                return (
                  <button
                    key={option.key}
                    onClick={() => setFoodFilter(option.key)}
                    className={`rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] transition-all ${
                      selected ? 'scale-[1.02] shadow-[0_8px_18px_rgba(37,99,235,0.18)]' : 'hover:-translate-y-0.5'
                    }`}
                    style={{
                      borderColor: selected ? '#2563eb' : 'var(--border)',
                      color: selected ? 'white' : 'var(--text-2)',
                      background: selected ? '#2563eb' : 'var(--surface-raised)',
                    }}
                  >
                    {t(option.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredCategories.length > 0 ? (
            <div className="custom-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {filteredCategories.map((category: any) => {
                const isActive = category.id === activeCategoryId;
                return (
                  <button
                    key={category.id}
                    onClick={() => scrollToCategory(category.id)}
                    className="whitespace-nowrap rounded-full border px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-all"
                    style={{
                      background: isActive ? 'var(--brand)' : 'var(--surface)',
                      borderColor: isActive ? 'var(--brand)' : 'var(--border)',
                      color: isActive ? 'white' : 'var(--text-2)',
                    }}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-[154px]">
              <div
                className="overflow-hidden rounded-[28px] border shadow-sm"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div
                  className="flex items-center gap-2 border-b px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em]"
                  style={{ color: 'var(--text-3)', borderColor: 'var(--border)', background: 'var(--surface-3)' }}
                >
                  <MenuIcon size={15} />
                  Browse sections
                </div>

                <div className="custom-scrollbar max-h-[62vh] space-y-1 overflow-y-auto p-3">
                  {filteredCategories.map((category: any) => {
                    const isActive = category.id === activeCategoryId;
                    return (
                      <button
                        key={category.id}
                        onClick={() => scrollToCategory(category.id)}
                        className="flex w-full items-center justify-between rounded-[20px] px-4 py-3 text-left transition-all"
                        style={{
                          background: isActive ? 'rgba(249,115,22,0.12)' : 'transparent',
                          color: isActive ? 'var(--brand)' : 'var(--text-2)',
                        }}
                      >
                        <span className="text-sm font-black">{category.name}</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em]"
                          style={{
                            background: isActive ? 'rgba(249,115,22,0.16)' : 'var(--surface-3)',
                            color: isActive ? 'var(--brand)' : 'var(--text-3)',
                          }}
                        >
                          {category.menuItems.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            {filteredCategories.length === 0 ? (
              <div
                className="rounded-[32px] border px-6 py-16 text-center"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div className="mb-4 flex justify-center">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-full"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
                  >
                    <Search size={28} />
                  </div>
                </div>
                <p className="text-lg font-black" style={{ color: 'var(--text-2)' }}>
                  {t('search.noResults')}
                </p>
                <p className="mt-1 text-sm font-medium" style={{ color: 'var(--text-3)' }}>
                  {t('search.tryDiff')}
                </p>
              </div>
            ) : (
              filteredCategories.map((category: any, index: number) => (
                <div key={category.id} id={`category-${category.id}`} className="scroll-mt-[150px]">
                  <MenuSection
                    category={category}
                    index={index}
                    onOpenItem={handleOpenMenuItem}
                    onQuickAddItem={handleQuickAddMenuItem}
                  />
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <div
        className={`fixed left-0 right-0 z-[60] transition-all duration-300 ${
          isMenuModalOpen || isAnyModalOpen ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100'
        }`}
        style={{ bottom: 'var(--customer-action-bottom)' }}
      >
        <div className="mx-auto flex max-w-screen-md flex-col gap-3 px-4">
          {filteredCategories.length > 1 ? (
            <button
              onClick={() => setActiveSheet('MENU')}
              className="pointer-events-auto flex items-center justify-between rounded-[24px] border px-4 py-3 text-left shadow-lg transition-all active:scale-[0.99] lg:hidden"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-2xl"
                  style={{ background: 'var(--surface-3)', color: 'var(--brand)' }}
                >
                  <MenuIcon size={16} />
                </div>
                <div>
                  <span className="block text-sm font-black">Browse sections</span>
                  <span className="block text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
                    {activeCategory?.name || `${filteredCategories.length} categories`}
                  </span>
                </div>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--text-3)' }} />
            </button>
          ) : null}

          {totalItems > 0 ? (
            <button
              onClick={() => setActiveSheet('CART')}
              className="pointer-events-auto flex w-full items-center justify-between rounded-[28px] border px-5 py-4 font-black text-white shadow-2xl transition-all active:scale-[0.98]"
              style={{ background: 'var(--brand)' }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-white/10 backdrop-blur-sm">
                  {logoUrl ? (
                    <BrandLogo
                      src={logoUrl}
                      name={restaurantName}
                      alt={`${restaurantName} logo`}
                      className="h-full w-full rounded-2xl"
                      imageClassName="h-full w-full bg-white/80 p-1.5 object-contain"
                      fallbackClassName="rounded-2xl bg-white/10 text-white"
                      iconSize={20}
                    />
                  ) : (
                    <Utensils size={22} className="text-white/80" />
                  )}
                </div>

                <div className="text-left">
                  <span className="block text-base tracking-tight">{t('cart.reviewOrder')}</span>
                  <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-white/70">
                    {totalItems} item{totalItems === 1 ? '' : 's'} | {activeServiceCopy?.compactLabel || (hasTableRoute ? 'Dine In' : 'Checkout ready')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-lg font-black">{formatINR(cartTotal)}</span>
                <ChevronRight size={20} className="opacity-60" />
              </div>
            </button>
          ) : null}
        </div>
      </div>

      {isMenuModalOpen ? (
        <div className="fixed inset-0 z-[150] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setActiveSheet('NONE')} />
          <div
            className="relative z-10 flex h-auto max-h-[82vh] flex-col overflow-hidden rounded-t-[34px] shadow-2xl slide-up"
            style={{
              background: 'var(--surface)',
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
            }}
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b px-5 py-5" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="text-xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
                  Browse categories
                </h3>
                <p className="mt-1 text-sm font-medium" style={{ color: 'var(--text-3)' }}>
                  Jump straight to the section you want.
                </p>
              </div>
              <button
                onClick={() => setActiveSheet('NONE')}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-black/5"
                style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-4 pb-20">
              {filteredCategories.map((category: any) => {
                const isActive = category.id === activeCategoryId;
                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      scrollToCategory(category.id);
                      setActiveSheet('NONE');
                    }}
                    className="flex w-full items-center justify-between rounded-[22px] border px-4 py-4 text-left transition-all active:scale-[0.99]"
                    style={{
                      borderColor: isActive ? 'rgba(249,115,22,0.24)' : 'var(--border)',
                      background: isActive ? 'rgba(249,115,22,0.08)' : 'var(--surface)',
                    }}
                  >
                    <div>
                      <p className="text-sm font-black" style={{ color: isActive ? 'var(--brand)' : 'var(--text-1)' }}>
                        {category.name}
                      </p>
                      <p className="mt-1 text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
                        {category.menuItems.length} dishes
                      </p>
                    </div>
                    <ChevronRight size={16} style={{ color: isActive ? 'var(--brand)' : 'var(--text-3)' }} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {activeMenuItem ? <ModifierModal item={activeMenuItem} onClose={closeModifierSheet} /> : null}

      <CartDrawer isOpen={activeSheet === 'CART'} onClose={() => setActiveSheet('NONE')} tenantSlug={tenantSlug!} tableId={tableId} />
    </div>
  );
}
