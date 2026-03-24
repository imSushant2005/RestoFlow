import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '../lib/api';
import { ShoppingBag, UtensilsCrossed, Star, ChevronRight } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export function RestaurantHome() {
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
  const statusUrl = `/order/${tenantSlug}/status`;
  const restaurantName = menuData?.name || 'Welcome';
  const logoUrl = menuData?.logoUrl || '';
  const coverImageUrl = menuData?.coverImageUrl || '';
  const brandColor = menuData?.primaryColor || '#f97316';

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center gap-5 p-6">
        <div className="w-20 h-20 rounded-3xl bg-gray-100 shimmer"></div>
        <div className="w-48 h-8 bg-gray-100 rounded-xl shimmer"></div>
        <div className="w-32 h-5 bg-gray-50 rounded-lg shimmer"></div>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] bg-white flex flex-col fade-in"
      style={
        {
          '--brand': brandColor,
          '--brand-soft': `${brandColor}22`,
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
            <img src={coverImageUrl} alt={`${restaurantName} cover`} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-black/45" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--brand)] via-[color:var(--brand)] to-red-600" />
        )}

        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

        <div className="relative z-10 w-20 h-20 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-5 shadow-xl border border-white/30 overflow-hidden">
          {logoUrl ? (
            <img src={logoUrl} alt={`${restaurantName} logo`} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <UtensilsCrossed size={36} className="text-white" />
          )}
        </div>

        <h1 className="relative z-10 text-3xl font-black tracking-tight leading-tight mb-2">{restaurantName}</h1>
        <p className="relative z-10 text-white/80 font-medium text-sm max-w-xs">{menuData?.description || 'Fresh food, great vibes. Order from your table.'}</p>

        {tableId && (
          <div className="relative z-10 mt-5 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-bold border border-white/30">
            <span className="w-2 h-2 rounded-full bg-green-400 shadow-sm shadow-green-400"></span>
            Table {tableId}
            {seatParam ? ` · Seat ${seatParam}` : ''}
          </div>
        )}

        <div className="relative z-10 mt-5 flex items-center gap-1.5 text-sm font-semibold text-white/90">
          <Star size={14} className="fill-yellow-300 text-yellow-300" />
          <span>4.5</span>
          <span className="text-white/50">·</span>
          <span className="text-white/70">200+ orders today</span>
        </div>
      </div>

      <div className="-mt-8 bg-white rounded-t-[32px] flex-1 px-6 pt-8 pb-10 flex flex-col gap-4">
        <p className="text-center text-sm font-medium text-gray-400 mb-2">What would you like to do?</p>

        <button
          onClick={() => navigate(menuUrl)}
          className="w-full flex items-center justify-between bg-brand hover:bg-brand-dark active:scale-[0.98] text-white px-6 py-5 rounded-2xl shadow-lg transition-all font-bold text-base"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <UtensilsCrossed size={20} />
            </div>
            Browse Menu
          </div>
          <ChevronRight size={20} />
        </button>

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
            Powered by <span className="font-bold text-gray-400">RestoFlow</span>
          </p>
        </div>
      </div>
    </div>
  );
}
