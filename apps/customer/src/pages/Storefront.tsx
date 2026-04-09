import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { publicApi } from '../lib/api';
import { MenuSection } from '../components/MenuSection';
import { CartDrawer } from '../components/CartDrawer';
import { WaiterCall } from '../components/WaiterCall';
import { CustomerNav } from '../components/CustomerNav';
import { LoyaltyBanner } from '../components/LoyaltyBanner';
import { formatINR } from '../lib/currency';
import { Utensils, UtensilsCrossed, Package, ArrowLeft, Search, Menu as MenuIcon, X, Sparkles, Star, ChevronRight } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useState, useRef, useDeferredValue, startTransition, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  getActiveSessionForTenant,
  getTenantStorageItem,
  setActiveSessionForTenant,
  setTenantStorageItem,
} from '../lib/tenantStorage';

export function Storefront() {
  const { tenantSlug, tableId } = useParams();
  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const { items: cartItems, customerName, setCustomerInfo, setTenantScope } = useCartStore();
  const [searchParams] = useSearchParams();
  const seatParam = searchParams.get('seat');
  const headerRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN');
  const [searchText, setSearchText] = useState('');
  const [foodFilter, setFoodFilter] = useState<'ALL' | 'VEG' | 'NON_VEG' | 'EGG'>('ALL');
  const deferredSearch = useDeferredValue(searchText.trim().toLowerCase());
  const filterOptions: Array<{ key: 'ALL' | 'VEG' | 'NON_VEG' | 'EGG'; label: string }> = [
    { key: 'ALL', label: 'All' },
    { key: 'VEG', label: 'Veg' },
    { key: 'NON_VEG', label: 'Non-Veg' },
    { key: 'EGG', label: 'Egg' },
  ];

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
    onSuccess: (res: any) => {
      const createdSessionId = res?.data?.sessionId;
      if (createdSessionId) {
        setActiveSessionForTenant(tenantSlug, createdSessionId);
      }
    },
    onError: (err: any) => console.error('Failed to create session:', err),
  });

  const totalItems = cartItems.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cartItems.reduce((total, item) => total + (item.totalPrice * item.quantity), 0);
  
  const categories = useMemo(() => Array.isArray(menuData?.categories) ? menuData.categories : [], [menuData]);
  
  const filteredCategories = useMemo(() => {
    const matchesFoodFilter = (item: any) => {
      if (foodFilter === 'ALL') return true;
      if (foodFilter === 'VEG') return Boolean(item?.isVeg);
      if (foodFilter === 'EGG') return Boolean(item?.isEgg);
      return !item?.isVeg && !item?.isEgg;
    };

    if (!deferredSearch && foodFilter === 'ALL') return categories;
    return categories
      .map((category: any) => ({
        ...category,
        menuItems: (Array.isArray(category?.menuItems) ? category.menuItems : []).filter((item: any) => {
          if (!matchesFoodFilter(item)) return false;
          if (!deferredSearch) return true;
          const nameMatch = String(item?.name || '').toLowerCase().includes(deferredSearch);
          const descMatch = String(item?.description || '').toLowerCase().includes(deferredSearch);
          return nameMatch || descMatch;
        }),
      }))
      .filter((category: any) => category.menuItems.length > 0);
  }, [categories, deferredSearch, foodFilter]);

  const restaurantName = menuData?.name || 'Restaurant';
  const logoUrl = menuData?.logoUrl || '';
  const brandColor = menuData?.primaryColor || '#f97316';
  
  const recommendedItems = useMemo(() => {
    const matchesFoodFilter = (item: any) => {
      if (foodFilter === 'ALL') return true;
      if (foodFilter === 'VEG') return Boolean(item?.isVeg);
      if (foodFilter === 'EGG') return Boolean(item?.isEgg);
      return !item?.isVeg && !item?.isEgg;
    };

    return categories
      .flatMap((category: any) =>
        (Array.isArray(category?.menuItems) ? category.menuItems : []).map((item: any) => ({
          ...item,
          _categoryId: category.id,
        }))
      )
      .filter((item: any) => (item?.isPopular || item?.isBestSeller || item?.isChefSpecial) && matchesFoodFilter(item))
      .slice(0, 8);
  }, [categories, foodFilter]);

  const rfName = getTenantStorageItem(tenantSlug, 'customer_name');
  const rfPhone = getTenantStorageItem(tenantSlug, 'customer_phone');
  const activeSessionId = getActiveSessionForTenant(tenantSlug);

  useEffect(() => {
    setTenantScope(tenantSlug || undefined);
  }, [setTenantScope, tenantSlug]);

  useEffect(() => {
    if (!customerName && rfName && rfPhone) {
      setCustomerInfo({ name: rfName, phone: rfPhone, type: 'DINE_IN', seat: seatParam || undefined });
    }
  }, [customerName, rfName, rfPhone, seatParam, setCustomerInfo]);

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: 'var(--bg)' }}>
        <div className="h-16 px-6 py-4 flex items-center gap-3 animate-pulse" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <div className="w-8 h-8 rounded-full" style={{ background: 'var(--surface-3)' }}></div>
          <div className="w-32 h-5 rounded-full" style={{ background: 'var(--surface-3)' }}></div>
        </div>
        <div className="flex gap-3 overflow-x-hidden px-5 py-4">
          <div className="w-24 h-9 rounded-full flex-shrink-0" style={{ background: 'var(--surface-3)' }}></div>
          <div className="w-28 h-9 rounded-full flex-shrink-0" style={{ background: 'var(--surface-3)' }}></div>
        </div>
        <div className="px-5 grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl overflow-hidden animate-pulse" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="w-full h-40 shimmer"></div>
              <div className="p-3 space-y-2">
                <div className="w-3/4 h-4 rounded shimmer"></div>
                <div className="w-1/2 h-4 rounded shimmer"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !menuData) {
    return (
      <div className="p-8 text-center mt-20 font-semibold" style={{ color: 'var(--error)' }}>
        Restaurant menu not found.
      </div>
    );
  }

  // Auth / Login Screen
  if (!customerName && !rfName) {
    return (
      <div className="min-h-[100dvh] flex flex-col fade-in relative overflow-hidden" style={{ background: 'var(--bg)', '--brand': brandColor } as any}>
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[30%] blur-[120px] rounded-full opacity-20" style={{ background: 'var(--brand)' }} />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[30%] blur-[120px] rounded-full opacity-10" style={{ background: 'var(--brand)' }} />
        
        <header className="p-6 flex items-center justify-between relative z-10">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-bold px-3 py-1.5 rounded-full text-sm transition-all hover:bg-black/5" style={{ color: 'var(--text-3)' }}>
            <ArrowLeft size={18} /> Back
          </button>
        </header>

        <div className="flex-1 flex flex-col justify-center px-8 pb-10 relative z-10 max-w-lg mx-auto w-full">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8 border shadow-xl rotate-3 transition-transform hover:rotate-0" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            {logoUrl ? (
              <img src={logoUrl} alt={`${restaurantName} logo`} className="w-full h-full object-cover rounded-3xl" />
            ) : (
              <UtensilsCrossed size={40} style={{ color: 'var(--brand)' }} />
            )}
          </div>
          
          <h1 className="text-4xl font-black tracking-tight mb-2" style={{ color: 'var(--text-1)' }}>
            {restaurantName}
          </h1>
          <p className="text-lg font-medium mb-10" style={{ color: 'var(--text-3)' }}>Welcome to our digital menu. Enter your details to get started.</p>

          <div className="space-y-6">
            <div className="relative group">
              <label className="absolute -top-2.5 left-4 px-1 text-[10px] font-black uppercase tracking-widest z-10" style={{ color: 'var(--brand)', background: 'var(--bg)' }}>Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl px-5 py-4 font-bold outline-none transition-all placeholder:text-gray-400"
                style={{ background: 'var(--surface)', border: '2px solid var(--border)', color: 'var(--text-1)' }}
                placeholder="e.g. Arjun Singh"
              />
            </div>
            
            <div className="relative group">
              <label className="absolute -top-2.5 left-4 px-1 text-[10px] font-black uppercase tracking-widest z-10" style={{ color: 'var(--brand)', background: 'var(--bg)' }}>Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-2xl px-5 py-4 font-bold outline-none transition-all placeholder:text-gray-400"
                style={{ background: 'var(--surface)', border: '2px solid var(--border)', color: 'var(--text-1)' }}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setType('DINE_IN')}
                className={`flex flex-col items-center justify-center py-5 border-2 rounded-3xl font-black text-sm transition-all ${
                  type === 'DINE_IN' ? 'shadow-lg scale-[1.02]' : 'opacity-60 grayscale-[0.5]'
                }`}
                style={{ 
                  borderColor: type === 'DINE_IN' ? 'var(--brand)' : 'var(--border)',
                  background: type === 'DINE_IN' ? 'var(--brand-soft)' : 'var(--surface)',
                  color: type === 'DINE_IN' ? 'var(--brand)' : 'var(--text-3)'
                }}
              >
                <Utensils size={24} className="mb-2" /> Dine In
              </button>
              <button
                onClick={() => setType('TAKEAWAY')}
                className={`flex flex-col items-center justify-center py-5 border-2 rounded-3xl font-black text-sm transition-all ${
                  type === 'TAKEAWAY' ? 'shadow-lg scale-[1.02]' : 'opacity-60 grayscale-[0.5]'
                }`}
                style={{ 
                  borderColor: type === 'TAKEAWAY' ? 'var(--brand)' : 'var(--border)',
                  background: type === 'TAKEAWAY' ? 'var(--brand-soft)' : 'var(--surface)',
                  color: type === 'TAKEAWAY' ? 'var(--brand)' : 'var(--text-3)'
                }}
              >
                <Package size={24} className="mb-2" /> Takeaway
              </button>
            </div>

            <button
              onClick={() => {
                if (name.trim() && phone.trim()) {
                  localStorage.setItem('rf_customer_name', name.trim());
                  localStorage.setItem('rf_customer_phone', phone.trim());
                  setTenantStorageItem(tenantSlug, 'customer_name', name.trim());
                  setTenantStorageItem(tenantSlug, 'customer_phone', phone.trim());
                  setCustomerInfo({ name: name.trim(), phone: phone.trim(), type, seat: seatParam || undefined });
                  if (tableId && tableId !== 'undefined') {
                    createSessionMutation.mutate({
                      sessionId: `guest_${Date.now()}`,
                      seat: seatParam || undefined,
                    });
                  }
                } else {
                  alert('Please enter your name and phone number.');
                }
              }}
              disabled={createSessionMutation.isPending}
              className="w-full bg-[#1a1c23] hover:bg-black text-white font-black py-4 rounded-3xl shadow-2xl transition-all mt-4 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {createSessionMutation.isPending ? 'Verifying...' : (
                <>Explore Menu <ChevronRight size={20} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen transition-colors duration-400" style={{ background: 'var(--bg)', '--brand': brandColor } as any}>
      <Helmet>
        <title>{restaurantName} | Order Online</title>
        <meta name="description" content={`Order delicious food from ${restaurantName}.`} />
      </Helmet>

      {/* Session Banner */}
      {activeSessionId && (
        <div
          onClick={() => navigate(`/order/${tenantSlug}/session/${activeSessionId}`)}
          className="bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-3 flex justify-between items-center cursor-pointer shadow-lg relative z-40"
        >
          <span className="text-white text-xs font-black flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse shadow-[0_0_8px_white]" />
            ACTIVE SESSION • Add more items anytime
          </span>
          <span className="text-white bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase">View Tab →</span>
        </div>
      )}

      <header ref={headerRef} className="sticky top-0 z-30 transition-all duration-300 shadow-sm" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-5 py-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 shadow-md transition-transform active:scale-90" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
              {logoUrl ? (
                <img src={logoUrl} alt={restaurantName} className="w-full h-full object-cover" />
              ) : (
                <UtensilsCrossed size={20} style={{ color: 'var(--brand)' }} />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-black text-base leading-tight truncate" style={{ color: 'var(--text-1)' }}>{restaurantName}</h1>
              {tableId && (
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--brand)' }}>
                   Table {tableId} {seatParam ? `· S${seatParam}` : ''}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate(`/order/${tenantSlug}/status`)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5"
            style={{ color: 'var(--text-3)' }}
          >
            <Star size={22} />
          </button>
        </div>

        <div className="px-5 pb-4">
          <div className="relative flex items-center gap-2 rounded-2xl border px-3.5 py-3 transition-all focus-within:shadow-lg focus-within:border-brand" style={{ background: 'var(--surface-3)', borderColor: 'var(--border)' }}>
            <Search size={18} style={{ color: 'var(--text-3)' }} />
            <input
              value={searchText}
              onChange={(e) => startTransition(() => setSearchText(e.target.value))}
              className="w-full bg-transparent outline-none text-sm font-bold placeholder:font-medium"
              style={{ color: 'var(--text-1)', '--placeholder': 'var(--text-3)' } as any}
              placeholder="Search dishes, burgers..."
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {filterOptions.map((option) => {
              const selected = foodFilter === option.key;
              return (
                <button
                  key={option.key}
                  onClick={() => setFoodFilter(option.key)}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition-all ${selected ? 'shadow-md' : ''}`}
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
        </div>
      </header>

      {/* Main Content Areas */}
      <div className="max-w-[1400px] mx-auto w-full flex lg:px-8 mt-6">
        
        {/* Zomato-inspired Desktop Sidebar */}
        <aside className="hidden lg:block w-72 flex-shrink-0 relative">
          <div className="sticky top-[110px] rounded-3xl overflow-hidden shadow-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="px-6 py-5 font-black text-xs uppercase tracking-widest flex items-center gap-2" style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}>
              <MenuIcon size={16} /> Categories
            </div>
            <div className="flex flex-col py-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {filteredCategories.map((c: any) => (
                <a 
                  key={c.id} 
                  href={`#category-${c.id}`} 
                  className="px-6 py-4 text-sm font-black transition-all border-l-[4px] border-transparent hover:px-8"
                  style={{ color: 'var(--text-2)' }}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(`category-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {c.name}
                </a>
              ))}
            </div>
          </div>
        </aside>

        {/* Menu Items Feed */}
        <div className="flex-1 min-w-0 pb-32">
          
          {/* AI Banner */}
          <div className="mx-4 lg:mx-0 mb-8 rounded-[32px] p-6 relative overflow-hidden group shadow-2xl" style={{ background: 'linear-gradient(135deg, #4f46e5, #8b5cf6)' }}>
            <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 blur-2xl rounded-full scale-150 transition-transform group-hover:scale-[2]" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-widest mb-3 border border-white/20">
                <Sparkles size={12} /> AI TasteMatch
              </div>
              <h3 className="text-2xl font-black text-white leading-tight mb-2">Can't decide yet?</h3>
              <p className="text-white/80 font-medium max-w-sm">Try our chef-special AI recommended items based on local trends.</p>
            </div>
          </div>

          <div className="px-4 lg:px-0">
            <LoyaltyBanner tenantSlug={tenantSlug || ''} />
          </div>

          <div className="px-0 sm:px-4 py-4 space-y-12">
            {recommendedItems.length > 0 && !deferredSearch && (
              <section className="px-4 sm:px-0">
                <h2 className="text-xl font-black mb-4 px-1" style={{ color: 'var(--text-1)' }}>Bestsellers</h2>
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
                  {recommendedItems.map((item: any) => (
                    <div
                      key={item.id}
                      className="min-w-[210px] rounded-[28px] overflow-hidden snap-start shadow-xl active:scale-95 transition-transform"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                    >
                      <div className="h-28 relative overflow-hidden">
                        <img
                          src={item?.imageUrl || item?.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'}
                          alt={item.name}
                          className="w-full h-full object-cover transition-transform hover:scale-110"
                        />
                        <div className="absolute top-2 right-2 bg-white text-black text-[9px] font-black px-2 py-1 rounded-full shadow-lg">⭐ 4.9</div>
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
                        <p className="font-black text-sm truncate mb-1" style={{ color: 'var(--text-1)' }}>{item.name}</p>
                        <p className="text-xs font-black text-brand mb-3">{formatINR(item.price)}</p>
                        <button 
                          onClick={() => document.getElementById(`category-${item._categoryId}`)?.scrollIntoView({ behavior: 'smooth' })}
                          className="w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-center"
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

            {filteredCategories.map((category: any) => (
              <div key={category.id} id={`category-${category.id}`} className="scroll-mt-40 lg:scroll-mt-24">
                <MenuSection category={category} />
              </div>
            ))}
            
            {filteredCategories.length === 0 && (
              <div className="py-20 text-center">
                <div className="text-5xl mb-4">🔍</div>
                <p className="font-black text-lg" style={{ color: 'var(--text-2)' }}>No matching dishes found</p>
                <p className="font-medium" style={{ color: 'var(--text-3)' }}>Try searching for ingredients or categories.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Menu & Cart Nav (Zomato style) */}
      <div className="fixed bottom-20 left-0 right-0 z-50 pointer-events-none">
        <div className="max-w-screen-sm mx-auto p-4 flex flex-col items-center gap-3">
          
          {/* Menu Button */}
          <button 
            onClick={() => setIsMenuModalOpen(true)}
            className="pointer-events-auto bg-[#1a1c23] hover:bg-black text-white px-6 py-3 rounded-full font-black text-xs shadow-2xl flex items-center gap-2 border border-white/10 active:scale-95 transition-all lg:hidden"
          >
            <MenuIcon size={14} /> MENU
          </button>

          {/* Cart Bar */}
          {totalItems > 0 && (
            <button
              onClick={() => setIsCartOpen(true)}
              className="pointer-events-auto w-full bg-brand text-white font-black py-4.5 rounded-3xl shadow-2xl flex items-center justify-between px-6 transition-all active:scale-[0.98] border border-white/10"
              style={{ background: 'var(--brand)' }}
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/20 px-2 py-0.5 rounded-lg text-sm font-black cart-badge">{totalItems}</div>
                <span className="text-base tracking-tight">View Order</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg">{formatINR(cartTotal)}</span>
                <ChevronRight size={20} className="opacity-50" />
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Category Bottom Sheet */}
      {isMenuModalOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMenuModalOpen(false)} />
          <div className="rounded-t-[40px] relative z-10 max-h-[75vh] flex flex-col slide-up shadow-2xl overflow-hidden" style={{ background: 'var(--surface)' }}>
            <div className="p-6 flex justify-between items-center border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-black text-xl" style={{ color: 'var(--text-1)' }}>Our Menu</h3>
              <button onClick={() => setIsMenuModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full transition-colors active:bg-black/5" style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}>
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-4 custom-scrollbar pb-10">
              {categories.map((c: any) => (
                <a
                  key={c.id}
                  href={`#category-${c.id}`}
                  onClick={() => setIsMenuModalOpen(false)}
                  className="flex items-center justify-between px-4 py-4.5 font-bold border-b transition-all active:translate-x-2"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
                >
                  {c.name}
                  <ChevronRight size={16} className="opacity-30" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} tenantSlug={tenantSlug!} tableId={tableId} />
      <WaiterCall tenantSlug={tenantSlug || ''} tableId={tableId} />
      <CustomerNav />
    </div>
  );
}
