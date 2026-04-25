import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { UtensilsCrossed, Moon, Sun, ChevronRight, ShoppingBag, Star, LogIn, QrCode, UserRound } from 'lucide-react';
import { publicApi } from '../lib/api';
import { buildCustomerThemeVars } from '../lib/customerTheme';
import { useTheme } from '../context/ThemeContext';
import { getDirectImageUrl } from '../lib/images';
import { BrandLogo } from '../components/BrandLogo';
import { getCustomerNameForTenant, getCustomerTokenForTenant } from '../lib/tenantStorage';

export function RestaurantHome() {
  const { theme, toggleTheme } = useTheme();
  const { tenantSlug, tableId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const seatParam = searchParams.get('seat');

  const { data: menuData, isLoading } = useQuery({
    queryKey: ['menu', tenantSlug],
    queryFn: async () => {
      const res = await publicApi.get(`/${tenantSlug}/menu`);
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const menuUrl = seatParam ? `/order/${tenantSlug}/${tableId}/menu?seat=${seatParam}` : `/order/${tenantSlug}/${tableId}/menu`;
  const directMenuUrl = `/order/${tenantSlug}/menu`;
  const statusUrl = `/order/${tenantSlug}/status`;
  const historyUrl = `/order/${tenantSlug}/history`;
  const profileUrl = `/order/${tenantSlug}/profile`;
  const restaurantName = menuData?.businessName || menuData?.name || 'Welcome';
  const logoUrl = menuData?.logoUrl || menuData?.logo || menuData?.businessLogo || menuData?.restaurantLogo || '';
  const coverImageUrl = menuData?.coverImageUrl || menuData?.cover || '';
  const customerThemeVars = buildCustomerThemeVars(menuData);
  const customerToken = getCustomerTokenForTenant(tenantSlug);
  const customerName = getCustomerNameForTenant(tenantSlug);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 flex flex-col items-center justify-center gap-6 p-6 text-center text-white">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl">
          <div className="absolute inset-0 rounded-[2rem] bg-blue-500/10 blur-xl" />
          <UtensilsCrossed size={36} className="relative text-blue-400 animate-pulse" />
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-400/80">Welcome Screen</p>
          <h1 className="text-3xl font-black tracking-tight">{restaurantName}</h1>
          <p className="text-sm font-medium text-slate-400">Order what you like. We’re preparing your restaurant experience.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] bg-white flex flex-col fade-in"
      style={
        {
          ...customerThemeVars,
        } as React.CSSProperties
      }
    >
      <style>{`
        .bg-brand { background-color: var(--brand); }
        .text-brand { color: var(--brand); }
        .hover\\:bg-brand-dark:hover { filter: brightness(0.9); background-color: var(--brand); }
      `}</style>

      <Helmet>
        <title>{restaurantName} | Welcome</title>
        <meta name="description" content={menuData?.description || 'Scan the QR and order instantly!'} />
        <meta property="og:title" content={`${restaurantName} | Digital Menu`} />
      </Helmet>

      <div className="relative text-white px-6 pt-16 pb-20 flex flex-col items-center text-center overflow-hidden">
        {coverImageUrl ? (
          <>
            <img src={getDirectImageUrl(coverImageUrl)} alt={`${restaurantName} cover`} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-black/45" />
          </>
        ) : (
          <div className="absolute inset-0" style={{ backgroundImage: 'var(--brand-gradient)' }} />
        )}

        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute top-6 right-6 z-20">
          <button 
            onClick={toggleTheme}
            className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 text-white active:scale-95 transition-all"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

        <div className="relative z-10 w-20 h-20 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-5 shadow-xl border border-white/30 overflow-hidden">
          {logoUrl ? (
            <BrandLogo
              src={logoUrl}
              name={restaurantName}
              alt={`${restaurantName} logo`}
              className="h-full w-full rounded-3xl"
              imageClassName="h-full w-full bg-white/80 p-2 object-contain"
              fallbackClassName="rounded-3xl bg-white/20 text-white"
              iconSize={36}
            />
          ) : (
            <UtensilsCrossed size={36} className="text-white" />
          )}
        </div>

        <h1 className="relative z-10 text-3xl font-black tracking-tight leading-tight mb-2">{restaurantName}</h1>
        <p className="relative z-10 text-white/80 font-medium text-sm max-w-xs">{menuData?.description || 'Fresh food, great vibes. Order from your table.'}</p>
        {customerToken && (
          <div className="relative z-10 mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white">
            <UserRound size={14} />
            {customerName || 'Signed In'}
          </div>
        )}

        {tableId && (
          <div className="relative z-10 mt-5 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-bold border border-white/30">
            <span className="w-2 h-2 rounded-full bg-green-400 shadow-sm shadow-green-400"></span>
            Table {tableId}
            {seatParam ? ` | Seat ${seatParam}` : ''}
          </div>
        )}

        <div className="relative z-10 mt-5 flex items-center gap-1.5 text-sm font-semibold text-white/90">
          <Star size={14} className="fill-yellow-300 text-yellow-300" />
          <span>4.5</span>
          <span className="text-white/50">|</span>
          <span className="text-white/70">200+ orders today</span>
        </div>
      </div>

      <div className="-mt-8 bg-white rounded-t-[32px] flex-1 px-6 pt-8 pb-10 flex flex-col gap-4">
        <p className="text-center text-sm font-medium text-gray-400 mb-2">What would you like to do?</p>

        <button
          onClick={() => navigate('/scan')}
          className="w-full flex items-center justify-between active:scale-[0.98] text-gray-900 px-6 py-5 rounded-2xl border border-gray-100 bg-gray-50 transition-all font-bold text-base"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-xl flex items-center justify-center">
              <QrCode size={20} className="text-gray-700" />
            </div>
            Scan Table QR
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

        <button
          onClick={() => navigate(tableId ? menuUrl : directMenuUrl)}
          className="w-full flex items-center justify-between active:scale-[0.98] text-white px-6 py-5 rounded-2xl shadow-lg transition-all font-bold text-base"
          style={{ backgroundImage: 'var(--brand-gradient)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <UtensilsCrossed size={20} />
            </div>
            Enter Menu
          </div>
          <ChevronRight size={20} />
        </button>

        {!customerToken && (
          <button
            onClick={() => navigate(`/?tenant=${tenantSlug}`)}
            className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 active:scale-[0.98] text-gray-800 px-6 py-5 rounded-2xl border border-gray-100 transition-all font-bold text-base"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-xl flex items-center justify-center">
                <LogIn size={20} className="text-gray-600" />
              </div>
              Login / Signup
            </div>
            <ChevronRight size={20} className="text-gray-400" />
          </button>
        )}

        <button
          onClick={() => navigate(statusUrl)}
          className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 active:scale-[0.98] text-gray-800 px-6 py-5 rounded-2xl border border-gray-100 transition-all font-bold text-base"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-xl flex items-center justify-center">
              <ShoppingBag size={20} className="text-gray-600" />
            </div>
            View My Order
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

        {customerToken && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => navigate(historyUrl)}
              className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4 text-left font-bold text-gray-800 transition-all hover:bg-gray-100"
            >
              Order History
            </button>
            <button
              onClick={() => navigate(profileUrl)}
              className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4 text-left font-bold text-gray-800 transition-all hover:bg-gray-100"
            >
              My Profile
            </button>
          </div>
        )}

        {menuData?.categories?.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">On the menu today</p>
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {menuData.categories.map((cat: any) => (
                <button
                  key={cat.id}
                  onClick={() => navigate(menuUrl + `#category-${cat.id}`)}
                  className="whitespace-nowrap bg-gray-50 border border-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold hover:text-brand transition-colors flex-shrink-0"
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto pt-6 text-center">
          <p className="text-xs text-gray-300 font-medium">
            Powered by <span className="font-bold text-gray-400">BHOJFLOW</span>
          </p>
        </div>
      </div>
    </div>
  );
}
