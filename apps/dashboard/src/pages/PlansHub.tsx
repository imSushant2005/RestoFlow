import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronRight,
  HelpCircle,
  MessagesSquare,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import { normalizePlanTier, type PlanTier } from '../hooks/usePlanFeatures';

interface PricingPlan {
  id: PlanTier;
  name: string;
  price: string;
  headline: string;
  positioning: string;
  idealFor: string;
  serviceStyle: string;
  description: string;
  gradient: string;
  icon: ReactNode;
  popular?: boolean;
  contactOnly?: boolean;
  outcomes: string[];
  features: string[];
  upgradeHint: string;
  cta: string;
}

const PLANS: PricingPlan[] = [
  {
    id: 'MINI',
    name: 'Mini',
    price: '₹799',
    headline: 'Fastest path for lean counter-led service',
    positioning: 'For outlets where speed matters more than table choreography.',
    idealFor: 'Counters, kiosks, dessert bars, takeaway-heavy setups',
    serviceStyle: 'Token + self-pickup',
    description:
      'Mini is built for simple, fast operations: guests scan, order, track, and pay the restaurant directly without a heavy staff workflow sitting in the middle.',
    gradient: 'from-sky-500 to-cyan-500',
    icon: <Zap className="text-[var(--text-1)]" size={24} />,
    outcomes: [
      'Reduce counter friction during rush hours',
      'Give guests live token and order visibility',
      'Keep billing clean without adding waiter complexity',
    ],
    features: [
      'QR ordering for self-service and pickup-ready flows',
      'Live order and token status for guests',
      'GST-ready billing and invoice output',
      'Best for compact setups up to 4 tables',
    ],
    upgradeHint: 'Move to Café when staff, table sessions, or waiter requests become part of daily service.',
    cta: 'Start Mini trial',
  },
  {
    id: 'CAFE',
    name: 'Cafe',
    price: '₹1,599',
    headline: 'The right starting point for most single-outlet restaurants',
    positioning: 'Where QR ordering and staff-assisted service finally work together.',
    idealFor: 'Cafés, QSR+, compact dine-in, one-floor restaurants',
    serviceStyle: 'QR + assisted dine-in',
    description:
      'Cafe is where RestoFlow starts feeling like an operating system, not just a QR menu. It brings table sessions, waiter requests, and staff coordination into one calmer service flow.',
    gradient: 'from-fuchsia-600 to-violet-600',
    icon: <Target className="text-[var(--text-1)]" size={24} />,
    popular: true,
    outcomes: [
      'Keep counter, table, and cashier actions in the same flow',
      'Reduce missed waiter requests and table confusion',
      'Give owners better control without jumping to an oversized plan',
    ],
    features: [
      'Everything in Mini, plus table and session management',
      'Waiter request workflow and waiter-facing login support',
      'Shared QR + staff ordering for smoother dine-in handoff',
      'Best for up to 9 live tables and 5 staff accounts',
    ],
    upgradeHint: 'Move to Dine Pro when multiple devices, larger floors, or full-service coordination become the bottleneck.',
    cta: 'Start Cafe trial',
  },
  {
    id: 'DINEPRO',
    name: 'Dine Pro',
    price: '₹3,499',
    headline: 'Built for busy dine-in service, not just ordering',
    positioning: 'For restaurants where floor coordination directly affects revenue.',
    idealFor: 'Busy dine-in venues, larger floors, multi-device service teams',
    serviceStyle: 'Full waiter-service control',
    description:
      'Dine Pro is for serious service operations. Managers, kitchen, cashiers, and service staff stay aligned on the same live picture so rush hours feel more controlled and less reactive.',
    gradient: 'from-orange-500 to-rose-600',
    icon: <Rocket className="text-[var(--text-1)]" size={24} />,
    outcomes: [
      'Improve coordination between floor, kitchen, and billing',
      'Handle rush hours with better service visibility',
      'Support larger dine-in operations without losing control',
    ],
    features: [
      'Everything in Cafe, plus multi-floor and multi-zone support',
      'Expanded table capacity for up to 18 active tables',
      'Dedicated waiter workflow for high-pressure service teams',
      'Stronger live ops visibility across larger teams',
    ],
    upgradeHint: 'Move to Hotel / Enterprise when one outlet turns into multi-outlet operations and central oversight becomes the real problem.',
    cta: 'Move to Dine Pro',
  },
  {
    id: 'PREMIUM',
    name: 'Hotel / Enterprise',
    price: 'Starts at ₹6,499',
    headline: 'Central control for chains, hotels, and complex properties',
    positioning: 'For operators scaling beyond one floor plan or one outlet.',
    idealFor: 'Hotels, food courts, growing chains, multi-outlet operators',
    serviceStyle: 'Multi-outlet oversight',
    description:
      'This is the rollout tier for businesses that need outlet-level discipline, central visibility, and founder-led support across more complex operations.',
    gradient: 'from-amber-400 to-orange-600',
    icon: <Sparkles className="text-[var(--text-1)]" size={24} />,
    contactOnly: true,
    outcomes: [
      'Bring multiple outlets under one calmer operating model',
      'Get rollout support for complex, higher-stakes operations',
      'Create clearer visibility across branches and supervisors',
    ],
    features: [
      'Everything in Dine Pro, plus central rollout context',
      'Designed for multi-outlet and hotel-style operations',
      'Higher-touch implementation and support lane',
      'Commercial scope depends on outlets, devices, and workflow depth',
    ],
    upgradeHint: 'This tier is usually finalized with the founder after understanding your outlets, devices, and service model.',
    cta: 'Talk to founder',
  },
];

export function PlansHub() {
  const queryClient = useQueryClient();
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [answers, setAnswers] = useState({
    tables: 0,
    qr: false,
    multi: false,
  });

  const { data: business } = useQuery({
    queryKey: ['settings-business'],
    queryFn: async () => (await api.get('/settings/business')).data,
  });

  const planMutation = useMutation({
    mutationFn: async (plan: string) => api.patch('/settings/business', { plan }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-business'] });
    },
  });

  const userEmail = localStorage.getItem('userEmail');
  const isSuperuser = userEmail === 'sushantrana2005@gmail.com';
  const activePlan = normalizePlanTier(business?.plan);
  const trialEndsAt = business?.trialEndsAt;

  const daysLeft = useMemo(() => {
    if (!trialEndsAt) return 0;
    const end = new Date(trialEndsAt);
    const now = new Date();
    return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }, [trialEndsAt]);

  const recommendedPlan = useMemo<PlanTier>(() => {
    if (answers.multi || answers.tables > 18) return 'PREMIUM';
    if (answers.tables > 9) return 'DINEPRO';
    if (answers.tables > 4 || answers.qr) return 'CAFE';
    return 'MINI';
  }, [answers]);

  return (
    <div className="flex-1 w-full overflow-y-auto bg-transparent p-8 custom-scrollbar">
      {activePlan && trialEndsAt && daysLeft > 0 && (
        <div className="mb-10 flex items-center justify-between gap-4 rounded-2xl border border-indigo-500/20 bg-indigo-600/10 p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-900/40">
              <Zap size={20} />
            </div>
            <div>
              <p className="text-sm font-black text-[var(--text-1)]">Active {activePlan} trial</p>
              <p className="text-xs text-indigo-300">
                Use the system live, note the friction points, and we will help fix them before you pay. {daysLeft} day
                {daysLeft === 1 ? '' : 's'} left.
              </p>
            </div>
          </div>
          <Link
            to="/onboarding"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-500"
          >
            Revisit setup
          </Link>
        </div>
      )}

      <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-blue-400">
              <Sparkles size={10} /> Plans built around service models
            </span>
          </div>
          <h2 className="text-4xl font-black tracking-tight text-[var(--text-1)]">
            Pick the operating model your restaurant actually runs today
          </h2>
          <p className="mt-3 max-w-3xl font-medium text-[var(--text-2)]">
            These plans are meant to match how your service runs on the floor: counter-led, QR + staff, full dine-in,
            or multi-outlet operations. Upgrade only when the next operational bottleneck becomes real.
          </p>
        </div>

        <div className="max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">Important</p>
          <p className="mt-2 text-sm font-medium leading-6 text-[var(--text-2)]">
            RestoFlow generates the bill and tracks service status. Guests still pay your restaurant directly using cash,
            UPI, card, or your existing collection method.
          </p>
        </div>
      </div>

      <div className="mb-12 grid grid-cols-1 gap-4 lg:grid-cols-4">
        <MetricBox
          label="Trial model"
          value="30 Days"
          icon={<Zap size={16} />}
          description="founder-led pilot before you commit"
        />
        <MetricBox
          label="Support style"
          value="Hands-on"
          icon={<MessagesSquare size={16} />}
          description="we help fix workflow gaps during trial"
        />
        <MetricBox
          label="Payment collection"
          value="Stays with you"
          icon={<TrendingUp size={16} />}
          description="cash, UPI, card, or your current method"
        />
        <button
          onClick={() => setShowRecommendation(true)}
          className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white shadow-xl shadow-blue-900/20 transition-all hover:scale-[1.02]"
        >
          <HelpCircle size={24} className="transition-transform group-hover:rotate-12" />
          <span className="text-center text-sm font-black">Find my best fit</span>
        </button>
      </div>

      {showRecommendation && (
        <div className="group relative mb-12 overflow-hidden rounded-3xl border border-blue-500/30 bg-[var(--surface-opaque)] p-8 backdrop-blur-2xl">
          <div className="pointer-events-none absolute right-0 top-0 rotate-[-12deg] p-8 opacity-10">
            <Rocket size={120} className="text-blue-400" />
          </div>

          <div className="relative z-10 flex flex-col items-center gap-8 md:flex-row">
            <div className="flex-1">
              <h3 className="mb-2 flex items-center gap-3 text-2xl font-black text-[var(--text-1)]">
                <Target className="text-blue-400" /> What does your floor actually need?
              </h3>
              <p className="mb-6 font-medium text-[var(--text-2)]">
                Answer a few practical questions and we will point you to the plan that fits your current operations, not
                the most expensive one.
              </p>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <QuestionItem
                  label="Number of tables"
                  value={
                    <input
                      type="number"
                      value={answers.tables}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, tables: Number(e.target.value) }))}
                      className="w-20 rounded-lg border-[var(--border-strong)] bg-[var(--input-bg)] px-2 py-1 font-bold text-[var(--text-1)]"
                    />
                  }
                />
                <QuestionToggle
                  label="Do QR orders matter daily?"
                  checked={answers.qr}
                  onChange={(value) => setAnswers((prev) => ({ ...prev, qr: value }))}
                />
                <QuestionToggle
                  label="Managing multiple outlets?"
                  checked={answers.multi}
                  onChange={(value) => setAnswers((prev) => ({ ...prev, multi: value }))}
                />
              </div>
            </div>

            <div className="flex w-full flex-col items-center rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-3)] p-6 text-center shadow-2xl md:w-80">
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-[var(--text-3)]">Best current fit</p>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Sparkles size={24} />
              </div>
              <p className="text-xl font-black text-[var(--text-1)]">{PLANS.find((plan) => plan.id === recommendedPlan)?.name}</p>
              <p className="mt-2 text-xs font-medium text-[var(--text-3)]">
                Start here now. Upgrade later only when service complexity genuinely outgrows it.
              </p>
              <button
                onClick={() => {
                  const el = document.getElementById(`plan-${recommendedPlan}`);
                  el?.scrollIntoView({ behavior: 'smooth' });
                  setShowRecommendation(false);
                }}
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-blue-500"
              >
                Review this plan
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const isActive = plan.id === activePlan;

          const buttonLabel = isActive
            ? isSuperuser
              ? 'Active (change anyway)'
              : 'Active plan'
            : plan.contactOnly && !isSuperuser
              ? plan.cta
              : planMutation.isPending
                ? 'Updating...'
                : !trialEndsAt
                  ? plan.cta
                  : `Switch to ${plan.name}`;

          return (
            <div
              key={plan.id}
              id={`plan-${plan.id}`}
              className={`relative flex h-full flex-col rounded-3xl border p-6 transition-all hover:scale-[1.01] ${
                plan.popular
                  ? 'border-blue-500/30 bg-[var(--surface)] ring-1 ring-blue-500/10'
                  : 'border-[var(--border)] bg-[var(--surface-2)]'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-blue-900/20">
                  Most popular
                </div>
              )}

              <div className="mb-5 flex items-center justify-between">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${plan.gradient} shadow-xl`}>
                  {plan.icon}
                </div>
                {isActive && (
                  <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-emerald-400">
                    <Check size={10} strokeWidth={4} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Active</span>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <h3 className="text-xl font-black text-[var(--text-1)]">{plan.name}</h3>
                <p className="mt-1 text-[11px] font-black uppercase tracking-widest text-blue-400">{plan.headline}</p>
              </div>

              <div className="mb-4 flex items-baseline gap-1">
                <span className="text-3xl font-black text-[var(--text-1)]">{plan.price}</span>
                <span className="text-xs font-bold text-[var(--text-3)]">/ outlet / month</span>
              </div>

              <div className="mb-4 grid gap-3">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2">
                  <p className="mb-0.5 text-[9px] font-black uppercase tracking-widest text-[var(--text-3)]">Service model</p>
                  <p className="text-sm font-bold text-[var(--text-1)]">{plan.serviceStyle}</p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2">
                  <p className="mb-0.5 text-[9px] font-black uppercase tracking-widest text-[var(--text-3)]">Ideal for</p>
                  <p className="text-sm font-bold text-[var(--text-1)]">{plan.idealFor}</p>
                </div>
              </div>

              <p className="mb-2 text-xs font-black uppercase tracking-widest text-[var(--text-3)]">{plan.positioning}</p>
              <p className="mb-4 text-sm font-medium leading-relaxed text-[var(--text-2)]">{plan.description}</p>

              <div className="mb-5 rounded-2xl border border-blue-500/10 bg-blue-500/5 p-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-blue-400">What this solves</p>
                <div className="space-y-2">
                  {plan.outcomes.map((outcome) => (
                    <div key={outcome} className="flex items-start gap-2">
                      <div className="mt-1 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--success-soft)]">
                        <Check size={9} className="text-emerald-400" />
                      </div>
                      <span className="text-xs font-semibold leading-tight text-[var(--text-2)]">{outcome}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2">
                    <div className="mt-1 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--success-soft)]">
                      <Check size={9} className="text-emerald-400" />
                    </div>
                    <span className="text-xs font-semibold leading-tight text-[var(--text-2)]">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-3)] p-4">
                <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">Upgrade logic</p>
                <p className="text-xs font-medium leading-6 text-[var(--text-2)]">{plan.upgradeHint}</p>
              </div>

              <button
                onClick={() => {
                  if (plan.id === activePlan && !isSuperuser) {
                    return;
                  }

                  if (plan.contactOnly && !isSuperuser) {
                    window.location.assign('/contact');
                    return;
                  }

                  const canChange = isSuperuser || (plan.id !== activePlan && !planMutation.isPending);
                  if (!canChange) return;
                  planMutation.mutate(plan.id);
                }}
                disabled={(!isSuperuser && plan.id === activePlan) || planMutation.isPending}
                className={`w-full rounded-xl py-3.5 text-xs font-black uppercase tracking-widest transition-all ${
                  isActive && !isSuperuser
                    ? 'cursor-default border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                    : plan.popular
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-xl shadow-blue-900/20 hover:opacity-90'
                      : 'border border-[var(--border-strong)] bg-[var(--input-bg)] text-[var(--text-2)] hover:bg-[var(--border)]'
                }`}
              >
                {buttonLabel}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mb-20">
        <h4 className="mb-8 text-center text-sm font-black uppercase tracking-[0.2em] text-[var(--text-3)]">
          Choose by service model
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <ServiceStyleCard plan="Mini" style="Token + self-pickup" focus="Counter-led and compact service" />
          <ServiceStyleCard plan="Cafe" style="QR + staff together" focus="Hybrid service on one floor" />
          <ServiceStyleCard plan="Dine Pro" style="Full waiter coordination" focus="Busy dine-in operations" />
          <ServiceStyleCard plan="Hotel / Enterprise" style="Central outlet control" focus="Hotels and multi-outlet groups" />
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-8 border-t border-[var(--border)] pt-16 md:grid-cols-2">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-2)] p-8">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <Zap className="text-blue-400" size={20} />
            </div>
            <h4 className="font-black text-[var(--text-1)]">How the 30-day trial works</h4>
          </div>
          <p className="mb-4 text-sm font-medium text-[var(--text-2)]">
            Start with the plan that matches your service model. Use it live. If something feels off, we help fix it. If
            it does not fit after 30 days, you can stop without pressure.
          </p>
          <p className="text-sm font-black uppercase tracking-widest text-blue-400">Founder-led, practical, and low-risk</p>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-2)] p-8">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <TrendingUp className="text-emerald-400" size={20} />
            </div>
            <h4 className="font-black text-[var(--text-1)]">How payment collection works</h4>
          </div>
          <p className="mb-4 text-sm font-medium text-[var(--text-2)]">
            RestoFlow handles the order, session, and bill workflow. The guest still pays your restaurant directly using
            cash, UPI, card, or your existing setup. We do not sit in the middle of your collection.
          </p>
          <p className="text-sm font-black uppercase tracking-widest text-emerald-400">No platform commission. No payment lock-in.</p>
        </div>
      </div>

      <div className="mt-20 space-y-4 text-center">
        <div className="mb-4 flex flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-opaque)] px-4 py-2">
            <Check className="text-emerald-400" size={16} />
            <span className="text-xs font-black uppercase tracking-wider text-[var(--text-1)]">No platform commission</span>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-opaque)] px-4 py-2">
            <MessagesSquare className="text-blue-400" size={16} />
            <span className="text-xs font-black uppercase tracking-wider text-[var(--text-1)]">Founder-led rollout</span>
          </div>
        </div>
        <p className="text-sm font-medium text-[var(--text-3)]">
          Choose for the workload you have now. Upgrade when the next service bottleneck becomes expensive to ignore.
        </p>
      </div>
    </div>
  );
}

function ServiceStyleCard({ plan, style, focus }: { plan: string; style: string; focus: string }) {
  return (
    <div className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 transition-all hover:border-blue-500/30">
      <div className="mb-4 flex items-center justify-between">
        <span className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-blue-400">
          {plan}
        </span>
        <ChevronRight size={14} className="text-[var(--text-3)] transition-colors group-hover:text-blue-400" />
      </div>
      <p className="mb-1 text-sm font-black text-[var(--text-1)]">{style}</p>
      <p className="text-[10px] font-bold uppercase tracking-tight text-[var(--text-3)]">{focus}</p>
    </div>
  );
}

function MetricBox({ label, value, icon, description }: { label: string; value: string; icon: ReactNode; description: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl backdrop-blur-md">
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-lg bg-blue-500/10 p-1.5 text-blue-400">{icon}</div>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">{label}</span>
      </div>
      <div className="text-2xl font-black text-[var(--text-1)]">{value}</div>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-tight text-[var(--text-3)]">{description}</p>
    </div>
  );
}

function QuestionItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--border-strong)] bg-[var(--surface-3)] p-4">
      <span className="text-sm font-bold text-[var(--text-2)]">{label}</span>
      {value}
    </div>
  );
}

function QuestionToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--border-strong)] bg-[var(--surface-3)] p-4">
      <span className="text-sm font-bold text-[var(--text-2)]">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-10 rounded-full transition-all ${checked ? 'bg-blue-600' : 'bg-[var(--border)]'}`}
      >
        <div className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-all ${checked ? 'right-1' : 'left-1'}`} />
      </button>
    </div>
  );
}
