import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2, PhoneCall, ReceiptText, Store } from 'lucide-react';
import { api } from '../lib/api';
import { FormField } from '../components/forms/FormField';

type OnboardingProps = {
  nextPath: string;
};

type SetupFormState = {
  businessName: string;
  slug: string;
  gstin: string;
  phone: string;
};

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PHONE_PATTERN = /^[0-9+\-\s()]{7,20}$/;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isWorkspaceReady(business: any) {
  return Boolean(business?.businessName?.trim() && business?.gstin?.trim() && business?.phone?.trim());
}

const onboardingReasons = [
  {
    icon: <Store size={16} />,
    title: 'Restaurant name',
    copy: 'Appears on workspace records, customer-facing surfaces, and invoices.',
  },
  {
    icon: <ReceiptText size={16} />,
    title: 'GSTIN',
    copy: 'Needed for GST-compliant billing and consistent invoice identity.',
  },
  {
    icon: <PhoneCall size={16} />,
    title: 'Business phone',
    copy: 'Used for contact clarity and trust on invoice details.',
  },
];

export function Onboarding({ nextPath }: OnboardingProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'welcome' | 'identity' | 'survey' | 'done'>('identity');
  
  // Questionnaire state
  const [businessType, setBusinessType] = useState<'kiosk' | 'cafe' | 'resto' | 'chain'>('cafe');
  const [tableCount, setTableCount] = useState(5);
  const [hasWaiterService, setHasWaiterService] = useState(false);
  
  const recommendedPlan = useMemo(() => {
    if (businessType === 'chain' || tableCount > 18) return 'PREMIUM';
    if (businessType === 'resto' || tableCount > 9) return 'BHOJPRO';
    if (businessType === 'cafe' || tableCount > 4) return 'CAFE';
    return 'MINI';
  }, [businessType, tableCount]);

  const [errorMessage, setErrorMessage] = useState('');

  const { data: business, isLoading } = useQuery({
    queryKey: ['settings-business'],
    queryFn: async () => (await api.get('/settings/business')).data,
    retry: false,
    staleTime: 1000 * 30,
  });

  const draftKey = useMemo(() => {
    const scope = business?.id || business?.slug || 'workspace';
    return `rf_workspace_setup_draft_${scope}`;
  }, [business?.id, business?.slug]);

  const [form, setForm] = useState<SetupFormState>({
    businessName: '',
    slug: '',
    gstin: '',
    phone: '',
  });

  useEffect(() => {
    if (!business) return;

    const storedDraft = localStorage.getItem(draftKey);
    if (storedDraft) {
      try {
        const parsed = JSON.parse(storedDraft) as SetupFormState;
        setForm({
          businessName: parsed.businessName || '',
          slug: parsed.slug || '',
          gstin: parsed.gstin || '',
          phone: parsed.phone || '',
        });
        return;
      } catch {
        localStorage.removeItem(draftKey);
      }
    }

    const initialName =
      business.businessName === 'New Workspace' || business.businessName?.endsWith("'s Workspace") ? '' : business.businessName || '';

    setForm({
      businessName: initialName,
      slug: business?.slug?.startsWith('workspace') ? '' : business?.slug || '',
      gstin: business?.gstin || '',
      phone: business?.phone || '',
    });
    setHasWaiterService(Boolean(business?.hasWaiterService));
  }, [business, draftKey]);

  useEffect(() => {
    if (!form.businessName.trim()) return;
    setForm((prev) => {
      if (prev.slug.trim()) return prev;
      return { ...prev, slug: slugify(prev.businessName) };
    });
  }, [form.businessName]);

  useEffect(() => {
    const hasMeaningfulDraft = form.businessName || form.slug || form.gstin || form.phone;
    if (!hasMeaningfulDraft) return;
    localStorage.setItem(draftKey, JSON.stringify(form));
  }, [draftKey, form]);

  useEffect(() => {
    if (!isLoading && business && isWorkspaceReady(business)) {
      navigate(nextPath, { replace: true });
    }
  }, [business, isLoading, navigate, nextPath]);

  const setupMutation = useMutation({
    mutationFn: async () => {
      const normalizedName = form.businessName.trim();
      const normalizedSlug = slugify(form.slug || form.businessName);
      const normalizedGstin = form.gstin.trim().toUpperCase();
      const normalizedPhone = form.phone.trim();

      if (!normalizedName) throw new Error('Restaurant name is required.');
      if (!normalizedSlug) throw new Error('Workspace URL is required.');
      if (!GSTIN_PATTERN.test(normalizedGstin)) throw new Error('GSTIN format looks incorrect. Please check it once.');
      if (!PHONE_PATTERN.test(normalizedPhone)) throw new Error('Business phone format looks incorrect.');

      return api.patch('/settings/business', {
        businessName: normalizedName,
        slug: normalizedSlug,
        gstin: normalizedGstin,
        phone: normalizedPhone,
      });
    },
    onSuccess: async () => {
      setErrorMessage('');
      localStorage.removeItem(draftKey);
      await queryClient.invalidateQueries({ queryKey: ['settings-business'] });
      setStep('survey');
    },
    onError: (err: any) => {
      const apiError = typeof err?.response?.data?.error === 'string' ? err.response.data.error : err?.message || 'Unable to save workspace setup.';
      setErrorMessage(apiError);
    },
  });

  const planMutation = useMutation({
    mutationFn: async ({
      plan,
      trialEndsAt,
      hasWaiterService,
    }: {
      plan: string;
      trialEndsAt: string;
      hasWaiterService: boolean;
    }) => {
      return api.patch('/settings/business', { plan, trialEndsAt, hasWaiterService });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings-business'] });
      setStep('done');
    },
    onError: () => {
      setErrorMessage('Unable to activate trial. Please try again.');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setupMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07101d]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={30} className="animate-spin text-blue-400" />
          <p className="text-sm font-medium text-slate-400">Preparing workspace setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07101d] text-slate-100">
      <div className="bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_28%),linear-gradient(180deg,#07101d_0%,#081220_46%,#07101d_100%)]">
        <div className="mx-auto max-w-[1180px] px-6 py-10">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-[660px]">
              <p className="text-sm font-semibold text-blue-300">Workspace setup</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
                Finish the business identity behind your restaurant workspace.
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-400">
                This step happens after account creation on purpose. It keeps signup light, then collects the restaurant details needed for billing, invoices, and a trustworthy workspace identity.
              </p>
            </div>

            <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300">
              <span className={step === 'welcome' ? 'text-white' : 'text-slate-500'}>Welcome</span>
              <span className="mx-2 text-slate-600">/</span>
              <span className={step === 'identity' ? 'text-white' : 'text-slate-500'}>Identity</span>
              <span className="mx-2 text-slate-600">/</span>
              <span className={step === 'survey' ? 'text-white' : 'text-slate-500'}>Personalize</span>
              <span className="mx-2 text-slate-600">/</span>
              <span className={step === 'done' ? 'text-white' : 'text-slate-500'}>Launch</span>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[32px] border border-white/10 bg-[#0b1524] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.28)] sm:p-8">
              {step === 'welcome' && (
                <div className="space-y-6">
                  <div className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-100">
                    Step 1 of 4
                  </div>

                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-white" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
                      Your account is ready. The setup from here is short and specific.
                    </h2>
                    <p className="mt-4 text-base leading-7 text-slate-400">
                      We only ask for the business details that are genuinely required to run billing and identify the workspace correctly.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {onboardingReasons.map((item) => (
                      <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">{item.icon}</div>
                        <div>
                          <p className="text-base font-semibold text-white">{item.title}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-400">{item.copy}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setErrorMessage('');
                      setStep('identity');
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
                  >
                    Continue to workspace setup
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}

              {step === 'identity' && (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-100">
                    Step 2 of 4
                  </div>

                  {errorMessage ? (
                    <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
                      {errorMessage}
                    </div>
                  ) : null}

                  <FormField
                    label="Restaurant name"
                    value={form.businessName}
                    onChange={(e) => setForm((prev) => ({ ...prev, businessName: e.target.value }))}
                    required
                    placeholder="Aura Cafe"
                    hint="This appears on workspace records and invoices."
                  />

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-200">
                      Workspace URL<span className="ml-1 text-blue-300">*</span>
                    </label>
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f1728] focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                      <div className="flex items-center">
                        <span className="border-r border-white/10 px-4 py-3 text-sm text-slate-500">bhojflow.com/order/</span>
                        <input
                          value={form.slug}
                          onChange={(e) => setForm((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
                          required
                          placeholder="aura-cafe"
                          className="flex-1 bg-transparent px-4 py-3 text-sm font-medium text-slate-100 placeholder:text-slate-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-500">We prefill this from your restaurant name so setup feels faster.</p>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField
                      label="GSTIN"
                      value={form.gstin}
                      onChange={(e) => setForm((prev) => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                      required
                      placeholder="22AAAAA0000A1Z5"
                      hint="Required for GST-compliant billing."
                      className="uppercase"
                    />
                    <FormField
                      label="Business phone"
                      value={form.phone}
                      onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                      required
                      placeholder="+91 9876543210"
                      hint="Used for contact and invoice details."
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={setupMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                    >
                      {setupMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      {setupMutation.isPending ? 'Saving workspace...' : 'Save workspace details'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('welcome')}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[0.06]"
                    >
                      Back
                    </button>
                  </div>
                </form>
              )}

              {step === 'survey' && (
                <div className="space-y-6">
                  <div className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-100">
                    Step 3 of 4
                  </div>

                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-white" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
                      Tell us about your service style.
                    </h2>
                    <p className="mt-2 text-base text-slate-400">
                      We'll tailor your dashboard and recommendation based on how you serve guests.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { id: 'kiosk', title: 'Street Food / Kiosk', sub: 'Orders are self-pickup' },
                      { id: 'cafe', title: 'Cafe / Quick Service', sub: 'Counter or scan-to-order' },
                      { id: 'resto', title: 'Full Restaurant', sub: 'Full waiter service' },
                      { id: 'chain', title: 'Hotel / Multi-outlet', sub: 'Multiple outlets or complex properties' },
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setBusinessType(type.id as any)}
                        className={`text-left p-4 rounded-2xl border transition-all ${
                          businessType === type.id 
                            ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-900/40 text-white' 
                            : 'bg-white/[0.03] border-white/10 text-slate-300 hover:border-white/20'
                        }`}
                      >
                        <p className="font-black text-sm">{type.title}</p>
                        <p className={`text-[10px] mt-1 ${businessType === type.id ? 'text-blue-100' : 'text-slate-500'}`}>{type.sub}</p>
                      </button>
                    ))}
                  </div>

                  <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-white">Number of Tables</p>
                        <p className="text-xs text-slate-400 mt-1">Include outdoor and indoor seating</p>
                      </div>
                      <input 
                        type="number" 
                        value={tableCount}
                        onChange={(e) => setTableCount(Number(e.target.value))}
                        className="w-16 h-10 bg-slate-800 border-slate-700 rounded-xl px-3 text-white font-black text-center"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <p className="text-sm font-bold text-white">Bill delivery style</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Choose how guests usually receive the final bill in your outlet.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setHasWaiterService(false)}
                        className={`rounded-2xl border p-4 text-left transition-all ${
                          !hasWaiterService
                            ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                            : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20'
                        }`}
                      >
                        <p className="text-sm font-black">Counter payment</p>
                        <p className={`mt-1 text-[11px] ${!hasWaiterService ? 'text-blue-100' : 'text-slate-500'}`}>
                          Guests go to the billing counter for cash settlement.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasWaiterService(true)}
                        className={`rounded-2xl border p-4 text-left transition-all ${
                          hasWaiterService
                            ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                            : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20'
                        }`}
                      >
                        <p className="text-sm font-black">Waiter brings bill</p>
                        <p className={`mt-1 text-[11px] ${hasWaiterService ? 'text-blue-100' : 'text-slate-500'}`}>
                          Guests stay seated and see a waiter-coming message during checkout.
                        </p>
                      </button>
                    </div>
                  </div>

                  <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/20 shadow-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">Our Recommendation</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-2xl font-black text-white">{recommendedPlan} Plan</h4>
                        <p className="text-xs text-slate-400 mt-1">
                          Start this plan free for 30 days. If anything feels off during live use, we help fix it before you decide.
                        </p>
                      </div>
                      <button
                        disabled={planMutation.isPending}
                        onClick={() => {
                          const trialEndsAt = new Date();
                          trialEndsAt.setDate(trialEndsAt.getDate() + 30);
                          
                          planMutation.mutate({
                            plan: recommendedPlan,
                            trialEndsAt: trialEndsAt.toISOString(),
                            hasWaiterService,
                          });
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-full font-black text-sm shadow-xl shadow-blue-900/40 transition-all disabled:opacity-50"
                      >
                        {planMutation.isPending ? 'Activating...' : 'Start 30-Day Free Trial'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {step === 'done' && (
                <div className="space-y-6">
                  <div className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200">
                    Step 4 of 4
                  </div>

                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-white" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
                      Workspace identity is ready.
                    </h2>
                    <p className="mt-4 text-base leading-7 text-slate-400">
                      Restaurant name, GSTIN, and business phone are now connected to the workspace and available in billing surfaces.
                    </p>
                  </div>

                  <button
                    onClick={() => navigate(nextPath, { replace: true })}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
                  >
                    Enter dashboard
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </section>

            <aside className="rounded-[32px] border border-white/10 bg-[#0b1524] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.28)] sm:p-8">
              <p className="text-sm font-semibold text-blue-300">Invoice identity preview</p>
              <h3 className="mt-3 text-3xl font-black tracking-tight text-white" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
                The same setup details power billing trust.
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                This is why business setup happens here: the data should clearly connect to invoice output, not feel like bureaucratic form filling.
              </p>

              <div className="mt-8 rounded-[30px] border border-white/10 bg-white p-5 text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
                <div className="border-b border-slate-100 pb-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Business identity</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">{form.businessName || 'Your restaurant name'}</p>
                </div>

                <div className="mt-5 grid gap-3">
                  <div className="rounded-2xl border border-slate-200 px-4 py-3">
                    <p className="text-xs font-medium text-slate-400">Workspace URL</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">bhojflow.com/order/{form.slug || 'your-workspace'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 px-4 py-3">
                    <p className="text-xs font-medium text-slate-400">GSTIN</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{form.gstin || '22AAAAA0000A1Z5'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 px-4 py-3">
                    <p className="text-xs font-medium text-slate-400">Business phone</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{form.phone || '+91 9876543210'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-slate-400">
                Keep it fast, but explicit: owners should understand why these details matter and where they will appear next.
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
