import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  PhoneCall,
  QrCode,
  ReceiptText,
  Sparkles,
  Store,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { api } from '../lib/api';

type OnboardingProps = {
  nextPath: string;
};

type SetupStep = 'identity' | 'type' | 'details' | 'success';
type RecommendedPlan = 'MINI' | 'CAFE' | 'BHOJPRO' | 'PREMIUM';
type RestaurantTypeId =
  | 'FINE_DINING'
  | 'CASUAL_DINING'
  | 'FAST_FOOD'
  | 'QSR'
  | 'CAFE'
  | 'BAKERY'
  | 'CLOUD_KITCHEN'
  | 'FOOD_TRUCK'
  | 'BAR_LOUNGE'
  | 'BUFFET'
  | 'FAMILY_RESTAURANT'
  | 'STREET_FOOD'
  | 'SWEET_SHOP'
  | 'MULTI_BRAND_KITCHEN'
  | 'OTHER';

type SetupFormState = {
  businessName: string;
  slug: string;
  restaurantType: RestaurantTypeId;
  phone: string;
  tableCount: number;
  hasWaiterService: boolean;
  deliveryEnabled: boolean;
  multiBranch: boolean;
  gstin: string;
};

type BusinessResponse = {
  id: string;
  businessName?: string;
  slug?: string;
  phone?: string | null;
  gstin?: string | null;
  hasWaiterService?: boolean;
  tableCount?: number;
  deliveryEnabled?: boolean;
  multiBranch?: boolean;
  restaurantType?: RestaurantTypeId | null;
  onboardingStatus?: string | null;
  onboardingCompletedAt?: string | null;
  plan?: RecommendedPlan;
  trialEndsAt?: string | null;
};

const PHONE_PATTERN = /^[0-9+\-\s()]{7,20}$/;

const restaurantTypeOptions: Array<{
  id: RestaurantTypeId;
  title: string;
  why: string;
  bestFor: string;
  features: string[];
}> = [
  {
    id: 'FINE_DINING',
    title: 'Fine Dining',
    why: 'Best for premium dine-in service, reservations, and higher-value guest experiences.',
    bestFor: 'Upscale restaurants with waitstaff, longer table sessions, and premium billing needs.',
    features: ['Waiter mode', 'Reservation-ready setup', 'Premium billing defaults'],
  },
  {
    id: 'CASUAL_DINING',
    title: 'Casual Dining',
    why: 'Best for balanced dine-in service with tables, staff coordination, and steady order flow.',
    bestFor: 'Neighborhood restaurants and modern dine-in brands.',
    features: ['QR ordering', 'Table flows', 'Hybrid waiter support'],
  },
  {
    id: 'FAST_FOOD',
    title: 'Fast Food',
    why: 'Best for quick turnover, combos, and fast kitchen operations.',
    bestFor: 'Counter-heavy service with short prep cycles.',
    features: ['Fast KDS', 'Counter billing', 'Takeaway defaults'],
  },
  {
    id: 'QSR',
    title: 'QSR',
    why: 'Best for repeatable quick-service operations with predictable speed.',
    bestFor: 'Chains and compact service brands focused on volume.',
    features: ['Quick billing', 'Pickup flow', 'Counter-first setup'],
  },
  {
    id: 'CAFE',
    title: 'Cafe',
    why: 'Best for coffee, beverages, desserts, and repeat visits.',
    bestFor: 'Cafe owners who want QR ordering, takeaway, and a lighter floor setup.',
    features: ['QR ordering', 'Takeaway enabled', 'Compact kitchen flow'],
  },
  {
    id: 'BAKERY',
    title: 'Bakery',
    why: 'Best for display-led sales, packaged products, and quick pickup orders.',
    bestFor: 'Bakeries with pre-made items and fast checkout.',
    features: ['Takeaway enabled', 'Simple counter flow', 'Compact setup'],
  },
  {
    id: 'CLOUD_KITCHEN',
    title: 'Cloud Kitchen',
    why: 'Best for delivery-only brands with no dine-in dependency.',
    bestFor: 'Swiggy/Zomato-focused operators and central kitchens.',
    features: ['Kitchen-first workflow', 'Delivery mode', 'Tables disabled'],
  },
  {
    id: 'FOOD_TRUCK',
    title: 'Food Truck',
    why: 'Best for mobile service and compact operations.',
    bestFor: 'On-the-go operators with minimal floor or seating needs.',
    features: ['Counter mode', 'Quick ordering', 'Lean setup'],
  },
  {
    id: 'BAR_LOUNGE',
    title: 'Bar / Lounge',
    why: 'Best for longer guest sessions, premium tabs, and table service.',
    bestFor: 'Bars and lounges with seated service and higher-ticket orders.',
    features: ['Table sessions', 'Premium billing', 'Waiter-friendly setup'],
  },
  {
    id: 'BUFFET',
    title: 'Buffet',
    why: 'Best for session billing and high table turnover.',
    bestFor: 'Buffets and all-you-can-eat formats.',
    features: ['Session billing', 'Table turnover mode', 'Waiter support'],
  },
  {
    id: 'FAMILY_RESTAURANT',
    title: 'Family Restaurant',
    why: 'Best for mixed dine-in groups and broad menus.',
    bestFor: 'Full-service venues serving families or mixed-age groups.',
    features: ['Tables enabled', 'Waiter-ready', 'Balanced dashboard setup'],
  },
  {
    id: 'STREET_FOOD',
    title: 'Street Food',
    why: 'Best for fast service, small menus, and minimal setup time.',
    bestFor: 'Kiosks, stalls, and quick local brands.',
    features: ['Fast checkout', 'Counter mode', 'Low-friction setup'],
  },
  {
    id: 'SWEET_SHOP',
    title: 'Sweet Shop',
    why: 'Best for packaged products, gifting, and quick retail-style billing.',
    bestFor: 'Mithai, dessert, and confectionery stores.',
    features: ['Takeaway enabled', 'Fast billing', 'Simple staff flow'],
  },
  {
    id: 'MULTI_BRAND_KITCHEN',
    title: 'Multi Brand Kitchen',
    why: 'Best for multiple brands running from one kitchen.',
    bestFor: 'Shared kitchens managing several virtual or physical brands.',
    features: ['Brand segmentation', 'Kitchen-first workflow', 'Delivery mode'],
  },
  {
    id: 'OTHER',
    title: 'Other',
    why: 'Best if your setup is unique and you want flexible defaults.',
    bestFor: 'New concepts or unusual service models.',
    features: ['Flexible defaults', 'Editable setup', 'Balanced configuration'],
  },
];

const restaurantNameSuggestions = [
  'The Ember Table',
  'Bean Bloom Cafe',
  'Coastal Spice House',
  'Midnight Oven',
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function inferStepFromBusiness(business?: BusinessResponse | null): SetupStep {
  const status = String(business?.onboardingStatus || '').toUpperCase();
  if (status === 'COMPLETED') return 'success';
  if (status === 'RESTAURANT_TYPE') return 'details';
  if (status === 'RESTAURANT_PROFILE') return 'type';
  return 'identity';
}

function recommendPlan(form: SetupFormState): { plan: RecommendedPlan; reason: string } {
  if (form.multiBranch || form.restaurantType === 'MULTI_BRAND_KITCHEN' || form.restaurantType === 'FINE_DINING') {
    return {
      plan: 'PREMIUM',
      reason: 'Best for multi-location, premium service, or multi-brand operations.',
    };
  }

  if (form.hasWaiterService || form.tableCount >= 12 || form.restaurantType === 'BUFFET') {
    return {
      plan: 'BHOJPRO',
      reason: 'Best for staffed dine-in operations with heavier floor coordination.',
    };
  }

  if (
    form.restaurantType === 'CAFE' ||
    form.restaurantType === 'CLOUD_KITCHEN' ||
    form.deliveryEnabled ||
    form.tableCount >= 4
  ) {
    return {
      plan: 'CAFE',
      reason: 'Best for cafes, delivery-first teams, and lean growth-stage setups.',
    };
  }

  return {
    plan: 'MINI',
    reason: 'Best for getting started fast with a smaller team and lighter setup.',
  };
}

function trackOnboardingStep(step: SetupStep) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('rf:onboarding-step', { detail: { step } }));
  const dataLayer = (window as any).dataLayer;
  if (Array.isArray(dataLayer)) {
    dataLayer.push({ event: 'rf_onboarding_step', step });
  }
}

function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs font-medium text-slate-500">{children}</p>;
}

function ToggleCard(props: {
  label: string;
  value: boolean;
  onClick: () => void;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        props.value
          ? 'border-blue-500 bg-blue-600/10 text-white shadow-lg shadow-blue-900/20'
          : 'border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/20'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-black">{props.label}</span>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
            props.value ? 'bg-blue-500/20 text-blue-100' : 'bg-slate-900/80 text-slate-500'
          }`}
        >
          {props.value ? 'Yes' : 'No'}
        </span>
      </div>
      <p className={`mt-2 text-xs leading-5 ${props.value ? 'text-blue-100' : 'text-slate-500'}`}>{props.hint}</p>
    </button>
  );
}

export function Onboarding({ nextPath }: OnboardingProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<SetupStep>('identity');
  const [errorMessage, setErrorMessage] = useState('');
  const [slugInput, setSlugInput] = useState('');
  const [debouncedSlug, setDebouncedSlug] = useState('');
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({
    addMenuItem: false,
    generateQr: false,
    createTestOrder: false,
    addStaffMember: false,
    openDashboard: false,
  });

  const { data: business, isLoading } = useQuery<BusinessResponse>({
    queryKey: ['settings-business'],
    queryFn: async () => (await api.get('/settings/business')).data,
    retry: false,
    staleTime: 1000 * 30,
  });

  const draftKey = useMemo(() => {
    const scope = business?.id || business?.slug || 'workspace';
    return `rf_onboarding_draft_${scope}`;
  }, [business?.id, business?.slug]);

  const [form, setForm] = useState<SetupFormState>({
    businessName: '',
    slug: '',
    restaurantType: 'CAFE',
    phone: '',
    tableCount: 6,
    hasWaiterService: false,
    deliveryEnabled: false,
    multiBranch: false,
    gstin: '',
  });

  const planRecommendation = useMemo(() => recommendPlan(form), [form]);
  const selectedType = useMemo(
    () => restaurantTypeOptions.find((option) => option.id === form.restaurantType) || restaurantTypeOptions[0],
    [form.restaurantType],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSlug(slugify(slugInput));
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [slugInput]);

  useEffect(() => {
    if (!business) return;

    if (String(business.onboardingStatus || '').toUpperCase() === 'COMPLETED' && step !== 'success') {
      navigate(nextPath, { replace: true });
      return;
    }

    const draft = localStorage.getItem(draftKey);
    const initialBusinessName =
      business.businessName === 'New Workspace' || business.businessName?.endsWith("'s Workspace")
        ? ''
        : business.businessName || '';
    if (draft) {
      try {
        const parsed = JSON.parse(draft) as Partial<SetupFormState>;
        setForm((current) => ({
          ...current,
          businessName: parsed.businessName || initialBusinessName,
          slug: parsed.slug || business.slug || '',
          restaurantType: (parsed.restaurantType as RestaurantTypeId) || business.restaurantType || 'CAFE',
          phone: parsed.phone || business.phone || '',
          tableCount: Number(parsed.tableCount ?? business.tableCount ?? 6),
          hasWaiterService: Boolean(parsed.hasWaiterService ?? business.hasWaiterService),
          deliveryEnabled: Boolean(parsed.deliveryEnabled ?? business.deliveryEnabled),
          multiBranch: Boolean(parsed.multiBranch ?? business.multiBranch),
          gstin: parsed.gstin || business.gstin || '',
        }));
        setSlugInput(parsed.slug || business.slug || '');
      } catch {
        localStorage.removeItem(draftKey);
      }
    } else {
      setForm({
        businessName: initialBusinessName,
        slug: business.slug || '',
        restaurantType: business.restaurantType || 'CAFE',
        phone: business.phone || '',
        tableCount: Number(business.tableCount ?? 6),
        hasWaiterService: Boolean(business.hasWaiterService),
        deliveryEnabled: Boolean(business.deliveryEnabled),
        multiBranch: Boolean(business.multiBranch),
        gstin: business.gstin || '',
      });
      setSlugInput(business.slug || '');
    }

    setStep(inferStepFromBusiness(business));
  }, [business, draftKey, navigate, nextPath, step]);

  useEffect(() => {
    if (!form.businessName.trim() || form.slug.trim()) return;
    const nextSlug = slugify(form.businessName);
    setForm((current) => ({ ...current, slug: nextSlug }));
    setSlugInput(nextSlug);
  }, [form.businessName, form.slug]);

  useEffect(() => {
    if (form.restaurantType === 'CLOUD_KITCHEN' || form.restaurantType === 'MULTI_BRAND_KITCHEN') {
      setForm((current) => ({
        ...current,
        tableCount: 0,
        hasWaiterService: false,
        deliveryEnabled: true,
      }));
    }
  }, [form.restaurantType]);

  useEffect(() => {
    const hasMeaningfulDraft = Object.values(form).some((value) =>
      typeof value === 'boolean' ? value : String(value ?? '').trim().length > 0,
    );
    if (!hasMeaningfulDraft) return;
    localStorage.setItem(draftKey, JSON.stringify(form));
  }, [draftKey, form]);

  useEffect(() => {
    trackOnboardingStep(step);
  }, [step]);

  const slugAvailability = useQuery({
    queryKey: ['settings-business-slug', debouncedSlug],
    queryFn: async () =>
      (
        await api.get('/settings/business/slug-availability', {
          params: { slug: debouncedSlug },
        })
      ).data as { slug: string; available: boolean; suggestion: string },
    enabled: Boolean(debouncedSlug && debouncedSlug.length >= 2),
    staleTime: 1000 * 20,
  });

  const saveIdentityMutation = useMutation({
    mutationFn: async () => {
      const normalizedName = form.businessName.trim();
      const normalizedSlug = slugify(form.slug || form.businessName);

      if (!normalizedName) throw new Error('Restaurant name is required.');
      if (!normalizedSlug) throw new Error('Workspace URL is required.');

      return api.patch('/settings/business', {
        businessName: normalizedName,
        slug: normalizedSlug,
        onboardingStatus: 'RESTAURANT_PROFILE',
      });
    },
    onSuccess: async () => {
      setErrorMessage('');
      await queryClient.invalidateQueries({ queryKey: ['settings-business'] });
      setStep('type');
    },
    onError: (err: any) => {
      setErrorMessage(typeof err?.response?.data?.error === 'string' ? err.response.data.error : err?.message || 'Unable to save restaurant identity.');
    },
  });

  const saveRestaurantTypeMutation = useMutation({
    mutationFn: async () =>
      api.patch('/settings/business', {
        restaurantType: form.restaurantType,
        businessType: form.restaurantType.toLowerCase(),
        onboardingStatus: 'RESTAURANT_TYPE',
      }),
    onSuccess: async () => {
      setErrorMessage('');
      await queryClient.invalidateQueries({ queryKey: ['settings-business'] });
      setStep('details');
    },
    onError: (err: any) => {
      setErrorMessage(typeof err?.response?.data?.error === 'string' ? err.response.data.error : 'Unable to save restaurant type.');
    },
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        businessName: form.businessName.trim(),
        slug: slugify(form.slug || form.businessName),
        restaurantType: form.restaurantType,
        phone: form.phone.trim(),
        tableCount: Number(form.tableCount || 0),
        hasWaiterService: form.hasWaiterService,
        deliveryEnabled: form.deliveryEnabled,
        multiBranch: form.multiBranch,
        gstin: form.gstin.trim().toUpperCase(),
        planId: planRecommendation.plan,
      };

      if (!PHONE_PATTERN.test(payload.phone)) {
        throw new Error('Phone format looks incorrect.');
      }

      return (await api.post('/settings/business/onboarding', payload)).data;
    },
    onSuccess: async () => {
      setErrorMessage('');
      localStorage.removeItem(draftKey);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['settings-business'] }),
        queryClient.invalidateQueries({ queryKey: ['billing-details'] }),
      ]);
      setStep('success');
    },
    onError: (err: any) => {
      const suggestion = typeof err?.response?.data?.suggestion === 'string' ? err.response.data.suggestion : '';
      if (suggestion) {
        setForm((current) => ({ ...current, slug: suggestion }));
        setSlugInput(suggestion);
      }
      setErrorMessage(typeof err?.response?.data?.error === 'string' ? err.response.data.error : err?.message || 'Unable to finish setup.');
    },
  });

  const handleIdentitySubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    saveIdentityMutation.mutate();
  };

  const handleDetailsSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    completeOnboardingMutation.mutate();
  };

  const slugStatus =
    debouncedSlug && slugAvailability.data
      ? slugAvailability.data.available
        ? `Available: /order/${slugAvailability.data.slug}`
        : `Taken. Suggested: /order/${slugAvailability.data.suggestion}`
      : 'Your ordering link updates instantly as you type.';

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07101d]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={30} className="animate-spin text-blue-400" />
          <p className="text-sm font-medium text-slate-400">Preparing onboarding...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07101d] text-slate-100">
      <div className="bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.16),transparent_28%),linear-gradient(180deg,#07101d_0%,#081220_46%,#07101d_100%)]">
        <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-[720px]">
              <p className="text-sm font-semibold text-blue-300">Restaurant setup</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
                Reach your dashboard in under two minutes.
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-400">
                We only ask three short things after signup: your restaurant identity, your service style, and the key business details we need to configure the workspace for you.
              </p>
            </div>

            <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300">
              <span className={step === 'identity' ? 'text-white' : 'text-slate-500'}>1. Name</span>
              <span className="mx-2 text-slate-600">/</span>
              <span className={step === 'type' ? 'text-white' : 'text-slate-500'}>2. Type</span>
              <span className="mx-2 text-slate-600">/</span>
              <span className={step === 'details' ? 'text-white' : 'text-slate-500'}>3. Setup</span>
              <span className="mx-2 text-slate-600">/</span>
              <span className={step === 'success' ? 'text-white' : 'text-slate-500'}>4. Launch</span>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
            <section className="rounded-[32px] border border-white/10 bg-[#0b1524] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.28)] sm:p-8">
              {errorMessage ? (
                <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
                  {errorMessage}
                </div>
              ) : null}

              {step === 'identity' && (
                <form onSubmit={handleIdentitySubmit} className="space-y-5">
                  <div className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-100">
                    Step 1 of 4
                  </div>

                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-white" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
                      What should we call your restaurant?
                    </h2>
                    <p className="mt-2 text-base text-slate-400">
                      This name shows up across your workspace, invoices, and guest-facing ordering links.
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-200">Restaurant Name</label>
                    <input
                      value={form.businessName}
                      onChange={(e) => setForm((current) => ({ ...current, businessName: e.target.value }))}
                      placeholder="Aura Cafe"
                      className="w-full rounded-2xl border border-white/10 bg-[#0f1728] px-4 py-3 text-sm font-medium text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <FieldHint>Examples if you want a starting point:</FieldHint>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {restaurantNameSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            setForm((current) => ({ ...current, businessName: suggestion, slug: slugify(suggestion) }));
                            setSlugInput(slugify(suggestion));
                          }}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.06]"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-200">Workspace URL</label>
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f1728] focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                      <div className="flex items-center">
                        <span className="border-r border-white/10 px-4 py-3 text-sm text-slate-500">bhojflow.com/order/</span>
                        <input
                          value={form.slug}
                          onChange={(e) => {
                            const nextSlug = slugify(e.target.value);
                            setForm((current) => ({ ...current, slug: nextSlug }));
                            setSlugInput(nextSlug);
                          }}
                          placeholder="aura-cafe"
                          className="flex-1 bg-transparent px-4 py-3 text-sm font-medium text-slate-100 placeholder:text-slate-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <p className={`mt-2 text-xs font-medium ${slugAvailability.data?.available ? 'text-emerald-300' : 'text-slate-500'}`}>
                      {slugAvailability.isLoading ? 'Checking availability...' : slugStatus}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={saveIdentityMutation.isPending || (slugAvailability.data?.available === false && slugAvailability.data?.slug === debouncedSlug)}
                      className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                    >
                      {saveIdentityMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      {saveIdentityMutation.isPending ? 'Saving...' : 'Continue'}
                    </button>
                  </div>
                </form>
              )}

              {step === 'type' && (
                <div className="space-y-6">
                  <div className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-100">
                    Step 2 of 4
                  </div>

                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-white" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
                      What kind of restaurant are you running?
                    </h2>
                    <p className="mt-2 text-base text-slate-400">
                      Pick the closest fit and we will auto-configure the workspace around your service model.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {restaurantTypeOptions.map((option) => {
                      const active = form.restaurantType === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, restaurantType: option.id }))}
                          className={`rounded-[1.6rem] border p-4 text-left transition-all ${
                            active
                              ? 'border-blue-500 bg-blue-600/10 text-white shadow-lg shadow-blue-900/20'
                              : 'border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/20'
                          }`}
                        >
                          <p className="text-base font-black">{option.title}</p>
                          <p className={`mt-2 text-xs leading-5 ${active ? 'text-blue-100' : 'text-slate-400'}`}>{option.why}</p>
                          <p className={`mt-3 text-[11px] font-semibold leading-5 ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                            Best for: {option.bestFor}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {option.features.map((feature) => (
                              <span
                                key={feature}
                                className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                                  active ? 'bg-blue-500/20 text-blue-100' : 'bg-slate-900/80 text-slate-400'
                                }`}
                              >
                                {feature}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage('');
                        setStep('identity');
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[0.06]"
                    >
                      <ChevronLeft size={16} />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage('');
                        saveRestaurantTypeMutation.mutate();
                      }}
                      disabled={saveRestaurantTypeMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                    >
                      {saveRestaurantTypeMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      {saveRestaurantTypeMutation.isPending ? 'Saving...' : 'Continue'}
                    </button>
                  </div>
                </div>
              )}

              {step === 'details' && (
                <form onSubmit={handleDetailsSubmit} className="space-y-6">
                  <div className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-100">
                    Step 3 of 4
                  </div>

                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-white" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
                      Finish the quick setup.
                    </h2>
                    <p className="mt-2 text-base text-slate-400">
                      These answers help us configure tables, waiter tools, delivery mode, and your free trial instantly.
                    </p>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-200">Phone Number</label>
                      <input
                        value={form.phone}
                        onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                        placeholder="+91 98765 43210"
                        className="w-full rounded-2xl border border-white/10 bg-[#0f1728] px-4 py-3 text-sm font-medium text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-200">Number of Tables</label>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={form.tableCount}
                        onChange={(e) => setForm((current) => ({ ...current, tableCount: Number(e.target.value || 0) }))}
                        className="w-full rounded-2xl border border-white/10 bg-[#0f1728] px-4 py-3 text-sm font-medium text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <ToggleCard
                      label="Waiter Service?"
                      value={form.hasWaiterService}
                      onClick={() => setForm((current) => ({ ...current, hasWaiterService: !current.hasWaiterService }))}
                      hint="Turn this on if staff take or manage table orders."
                    />
                    <ToggleCard
                      label="Delivery?"
                      value={form.deliveryEnabled}
                      onClick={() => setForm((current) => ({ ...current, deliveryEnabled: !current.deliveryEnabled }))}
                      hint="Turn this on if you manage delivery or pickup orders."
                    />
                    <ToggleCard
                      label="Multiple Branches?"
                      value={form.multiBranch}
                      onClick={() => setForm((current) => ({ ...current, multiBranch: !current.multiBranch }))}
                      hint="Turn this on if you operate more than one location."
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-200">GSTIN (optional)</label>
                    <input
                      value={form.gstin}
                      onChange={(e) => setForm((current) => ({ ...current, gstin: e.target.value.toUpperCase() }))}
                      placeholder="22AAAAA0000A1Z5"
                      className="w-full rounded-2xl border border-white/10 bg-[#0f1728] px-4 py-3 text-sm font-medium uppercase tracking-wide text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <FieldHint>Skip it for now. You can add it later without blocking dashboard access.</FieldHint>
                  </div>

                  <div className="rounded-[1.8rem] border border-blue-500/20 bg-blue-500/10 p-5">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-200">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-200">AI Smart Setup</p>
                        <h3 className="mt-2 text-xl font-black text-white">{selectedType.title} preset ready</h3>
                        <p className="mt-2 text-sm leading-6 text-blue-100/90">
                          {selectedType.why}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {selectedType.features.map((feature) => (
                            <span key={feature} className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-blue-100">
                              {feature}
                            </span>
                          ))}
                        </div>
                        <div className="mt-4 rounded-2xl bg-slate-950/35 px-4 py-3">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Recommended free trial plan</p>
                          <p className="mt-1 text-lg font-black text-white">{planRecommendation.plan}</p>
                          <p className="mt-1 text-sm text-slate-300">{planRecommendation.reason}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage('');
                        setStep('type');
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[0.06]"
                    >
                      <ChevronLeft size={16} />
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={completeOnboardingMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                    >
                      {completeOnboardingMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                      {completeOnboardingMutation.isPending ? 'Starting free trial...' : 'Start free trial and open dashboard'}
                    </button>
                  </div>
                </form>
              )}

              {step === 'success' && (
                <div className="space-y-6">
                  <div className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100">
                    Step 4 of 4
                  </div>

                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-white" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
                      Your workspace is live.
                    </h2>
                    <p className="mt-2 text-base text-slate-400">
                      Your free trial is active and the fastest way to feel the product is to complete one small action from the checklist below.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { key: 'addMenuItem', label: 'Add first menu item', href: '/app/menu', icon: <UtensilsCrossed size={16} /> },
                      { key: 'generateQr', label: 'Generate QR code', href: '/app/tables', icon: <QrCode size={16} /> },
                      { key: 'createTestOrder', label: 'Create test order', href: '/app/orders', icon: <ReceiptText size={16} /> },
                      { key: 'addStaffMember', label: 'Add first staff member', href: '/app/settings', icon: <Users size={16} /> },
                      { key: 'openDashboard', label: 'Open dashboard', href: nextPath, icon: <Store size={16} /> },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setChecklistState((current) => ({ ...current, [item.key]: true }));
                          navigate(item.href);
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
                      >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${checklistState[item.key] ? 'bg-emerald-500/15 text-emerald-300' : 'bg-blue-500/10 text-blue-300'}`}>
                          {checklistState[item.key] ? <CheckCircle2 size={18} /> : item.icon}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-black text-white">{item.label}</p>
                          <p className="mt-1 text-xs text-slate-500">{checklistState[item.key] ? 'Completed' : 'Recommended first success moment'}</p>
                        </div>
                        <ArrowRight size={16} className="text-slate-500" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <aside className="space-y-6">
              <div className="rounded-[32px] border border-white/10 bg-white p-6 text-slate-900 shadow-[0_24px_70px_rgba(255,255,255,0.08)]">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Setup Preview</p>
                <h3 className="mt-3 text-2xl font-black tracking-tight">{form.businessName || 'Your Restaurant'}</h3>
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl bg-slate-100 p-4">
                    <p className="text-xs font-medium text-slate-500">Ordering link</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">bhojflow.com/order/{form.slug || 'your-restaurant'}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-100 p-4">
                      <p className="text-xs font-medium text-slate-500">Restaurant type</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{selectedType.title}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 p-4">
                      <p className="text-xs font-medium text-slate-500">Recommended plan</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{planRecommendation.plan}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 p-4">
                      <p className="text-xs font-medium text-slate-500">Tables</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{form.tableCount}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 p-4">
                      <p className="text-xs font-medium text-slate-500">Delivery</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{form.deliveryEnabled ? 'Enabled' : 'Off'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-white/10 bg-[#0b1524] p-6">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Questions We Ask</p>
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
                        <Store size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white">Page 1: Restaurant Identity</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">Restaurant name and workspace URL.</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
                        <UtensilsCrossed size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white">Page 2: Restaurant Type</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">Why this business model fits and which features we turn on automatically.</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
                        <PhoneCall size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white">Page 3: Quick Business Setup</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">Phone number, table count, waiter service, delivery, multiple branches, and optional GSTIN.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
