import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronRight,
  HelpCircle,
  LayoutDashboard,
  Rocket,
  Smartphone,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';

type PlanTier = 'MINI' | 'CAFE' | 'DINEPRO' | 'PREMIUM';

interface PricingPlan {
  id: PlanTier;
  name: string;
  price: string;
  annualPrice: string;
  tagline: string;
  serviceStyle: string;
  description: string;
  gradient: string;
  icon: ReactNode;
  popular?: boolean;
  isComingSoon?: boolean;
  features: string[];
}

const PLANS: PricingPlan[] = [
  {
    id: 'MINI',
    name: 'MINI',
    price: '₹599',
    annualPrice: '₹599',
    tagline: 'Start here when speed matters more than table complexity',
    serviceStyle: 'Token + self pickup',
    description: 'Built for counters, kiosks, and lean service teams that want faster billing and cleaner guest flow without waiter overhead.',
    gradient: 'from-blue-500 to-cyan-500',
    icon: <Zap className="text-[var(--text-1)]" size={24} />,
    features: [
      'Fast GST billing and receipts',
      'QR ordering for self-service',
      'Live token and order status view',
      'Pickup-ready customer flow',
      'Simple menu setup',
      'Daily sales reporting',
      'Works on Android phones and tablets',
      'Best for low table complexity',
    ],
  },
  {
    id: 'CAFE',
    name: 'CAFÉ',
    price: '₹1,299',
    annualPrice: '₹1,299',
    tagline: 'Best when staff and QR both need to work together',
    serviceStyle: 'Table + assisted service',
    description: 'Use this when table sessions, waiter calls, and smoother dine-in recovery start mattering more than staying on the smallest plan.',
    gradient: 'from-fuchsia-600 to-purple-600',
    icon: <Target className="text-[var(--text-1)]" size={24} />,
    features: [
      'Everything in MINI',
      'Table and session management',
      'Waiter request workflow',
      'Basic kitchen display support',
      'QR studio and table mapping',
      'Stronger dine-in handoff flow',
      'Detailed sales reporting',
      'Up to 5 staff accounts',
    ],
  },
  {
    id: 'DINEPRO',
    name: 'DINEPRO',
    price: '₹2,999',
    annualPrice: '₹2,999',
    tagline: 'For busy dine-in venues where coordination becomes the bottleneck',
    serviceStyle: 'Full waiter service control',
    description: 'Choose this once multiple staff devices, larger floors, and service visibility save more money than squeezing the lowest subscription cost.',
    gradient: 'from-orange-500 to-rose-600',
    icon: <Rocket className="text-[var(--text-1)]" size={24} />,
    popular: true,
    features: [
      'Everything in CAFÉ',
      'Higher table and device capacity',
      'Multi-zone / multi-floor support',
      'Full waiter ops workflow',
      'Advanced session tracking',
      'Rush-hour analytics views',
      'Unlimited staff accounts',
      'Built for serious dine-in service',
    ],
  },
  {
    id: 'PREMIUM',
    name: 'PREMIUM',
    price: '₹6,999',
    annualPrice: '₹5,599',
    tagline: 'Higher anchor for multi-outlet operators',
    serviceStyle: 'Multi-outlet intelligence',
    description: 'This is the expansion tier for brands that need central controls, outlet comparisons, and tighter consistency across locations.',
    gradient: 'from-amber-400 to-orange-600',
    icon: <Sparkles className="text-[var(--text-1)]" size={24} />,
    isComingSoon: true,
    features: [
      'Everything in DINEPRO',
      'Outlet-level controls',
      'Central reporting layer',
      'Inventory and feedback insights',
      'Multi-branch analytics',
      'Priority support lane',
      'Designed for growing chains',
    ],
  },
];

export function PlansHub() {
  const queryClient = useQueryClient();
  const [isAnnual, setIsAnnual] = useState(true);
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
  const activePlan = (business?.plan || 'MINI') as PlanTier;
  const trialEndsAt = business?.trialEndsAt;

  const daysLeft = useMemo(() => {
    if (!trialEndsAt) return 0;
    const end = new Date(trialEndsAt);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }, [trialEndsAt]);

  const recommendedPlan = useMemo<PlanTier>(() => {
    if (answers.multi || answers.tables > 18) return 'PREMIUM';
    if (answers.tables > 10) return 'DINEPRO';
    if (answers.tables > 4 || answers.qr) return 'CAFE';
    return 'MINI';
  }, [answers]);

  return (
    <div className="flex-1 p-8 overflow-y-auto w-full custom-scrollbar bg-transparent">
      {activePlan && trialEndsAt && daysLeft > 0 && (
        <div className="mb-10 p-4 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-900/40">
              <Zap size={20} />
            </div>
            <div>
              <p className="text-sm font-black text-[var(--text-1)]">Active {activePlan} trial</p>
              <p className="text-xs text-indigo-300">You still have {daysLeft} day{daysLeft === 1 ? '' : 's'} to pressure-test the workflow before paying.</p>
            </div>
          </div>
          <Link to="/onboarding" className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all">
            Revisit setup
          </Link>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20 flex items-center gap-1">
              <Sparkles size={10} /> Choose by service model
            </span>
          </div>
          <h2 className="text-4xl font-black text-[var(--text-1)] tracking-tight">Choose the next bottleneck you want gone</h2>
          <div className="flex items-center gap-3 mt-3">
            <p className="text-[var(--text-2)] font-medium max-w-2xl">
              {activePlan
                ? 'Upgrade only when table complexity, device count, or staff coordination starts slowing the team down.'
                : 'Start with the smallest plan that removes your next operational bottleneck. Move up only when service load justifies it.'}
            </p>
            {activePlan && (
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                Active plan: {activePlan}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-12">
        <MetricBox
          label="Trial window"
          value="30 Days"
          icon={<Zap size={16} />}
          description="launch and test before paying"
        />
        <MetricBox
          label="Commission"
          value="0%"
          icon={<TrendingUp size={16} />}
          description="customer payments stay with vendor"
        />
        <MetricBox
          label="Plan flexibility"
          value="Anytime"
          icon={<LayoutDashboard size={16} />}
          description="switch when service style changes"
        />
        <button
          onClick={() => setShowRecommendation(true)}
          className="p-5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex flex-col justify-center items-center gap-2 group hover:scale-[1.02] transition-all shadow-xl shadow-blue-900/20"
        >
          <HelpCircle size={24} className="group-hover:rotate-12 transition-transform" />
          <span className="font-black text-sm text-center">Find my best fit</span>
        </button>
      </div>

      {showRecommendation && (
        <div className="mb-12 p-8 rounded-3xl bg-[var(--surface-opaque)] border border-blue-500/30 backdrop-blur-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 -rotate-12 pointer-events-none">
            <Rocket size={120} className="text-blue-400" />
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            <div className="flex-1">
              <h3 className="text-2xl font-black text-[var(--text-1)] mb-2 flex items-center gap-3">
                <Target className="text-blue-400" /> What does your floor actually need?
              </h3>
              <p className="text-[var(--text-2)] font-medium mb-6">
                Answer a few practical questions and we will point you to the plan that fits your current operations, not the most expensive one.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <QuestionItem
                  label="Number of tables"
                  value={
                    <input
                      type="number"
                      value={answers.tables}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, tables: Number(e.target.value) }))}
                      className="w-20 bg-[var(--input-bg)] border-[var(--border-strong)] rounded-lg px-2 py-1 text-[var(--text-1)] font-bold"
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

            <div className="w-full md:w-72 p-6 rounded-2xl bg-[var(--surface-3)] border border-[var(--border-strong)] text-center flex flex-col items-center shadow-2xl">
              <p className="text-xs font-black text-[var(--text-3)] uppercase tracking-widest mb-2">Best current fit</p>
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-3 text-white">
                <Sparkles size={24} />
              </div>
              <p className="text-xl font-black text-[var(--text-1)]">{recommendedPlan}</p>
              <p className="mt-2 text-xs font-medium text-[var(--text-3)]">
                Start here now. Upgrade later only when service complexity outgrows it.
              </p>
              <button
                onClick={() => {
                  const el = document.getElementById(`plan-${recommendedPlan}`);
                  el?.scrollIntoView({ behavior: 'smooth' });
                  setShowRecommendation(false);
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-wider hover:bg-blue-500 transition-all"
              >
                Review this plan
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-4 mb-12">
        <span className={`text-sm font-bold transition-all ${!isAnnual ? 'text-[var(--text-1)]' : 'text-[var(--text-3)]'}`}>Monthly</span>
        <button
          onClick={() => setIsAnnual(!isAnnual)}
          className={`w-14 h-7 rounded-full transition-all relative ${isAnnual ? 'bg-blue-600' : 'bg-[var(--input-bg)]'}`}
        >
          <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${isAnnual ? 'right-1' : 'left-1'}`} />
        </button>
        <span className={`text-sm font-bold transition-all ${isAnnual ? 'text-[var(--text-1)]' : 'text-[var(--text-3)]'}`}>
          Annual billing <span className="text-emerald-400 ml-1 text-xs px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">Save 20%</span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            id={`plan-${plan.id}`}
            className={`rounded-3xl p-6 flex flex-col h-full relative border transition-all hover:scale-[1.01] ${
              plan.popular ? 'bg-[var(--surface)] border-orange-500/30 ring-1 ring-orange-500/10' : 'bg-[var(--surface-2)] border-[var(--border)]'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-600 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-orange-900/20">
                Best for growing dine-in teams
              </div>
            )}

            <div className="flex items-center justify-between mb-5">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center shadow-xl`}>
                {plan.icon}
              </div>
              {plan.id === activePlan && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Check size={10} strokeWidth={4} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Active</span>
                </div>
              )}
            </div>

            <h3 className="text-xl font-black text-[var(--text-1)]">{plan.name}</h3>
            <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-1">{plan.tagline}</p>

            <div className="flex items-baseline gap-1 mt-2 mb-3">
              <span className="text-3xl font-black text-[var(--text-1)]">{isAnnual ? plan.annualPrice : plan.price}</span>
              <span className="text-[var(--text-3)] font-bold text-xs">/outlet /mo</span>
            </div>

            <p className="text-sm font-medium text-[var(--text-2)] leading-relaxed mb-5">{plan.description}</p>

            <div className="px-3 py-2 rounded-xl bg-[var(--surface-3)] border border-[var(--border)] mb-6">
              <p className="text-[9px] font-black text-[var(--text-3)] uppercase tracking-widest mb-0.5">Service model</p>
              <p className="text-sm font-bold text-[var(--text-1)]">{plan.serviceStyle}</p>
            </div>

            <div className="flex-1 space-y-3 mb-8">
              {plan.features.map((feature, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="mt-1 w-3.5 h-3.5 rounded-full bg-[var(--success-soft)] flex items-center justify-center flex-shrink-0">
                    <Check size={9} className="text-emerald-400" />
                  </div>
                  <span className="text-xs font-semibold text-[var(--text-2)] leading-tight">{feature}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                const canChange = isSuperuser || (plan.id !== activePlan && !plan.isComingSoon && !planMutation.isPending);
                if (!canChange) return;
                planMutation.mutate(plan.id);
              }}
              disabled={(!isSuperuser && (plan.isComingSoon || plan.id === activePlan)) || planMutation.isPending}
              className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                plan.id === activePlan && !isSuperuser
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default'
                  : plan.isComingSoon && !isSuperuser
                    ? 'bg-[var(--input-bg)] text-[var(--text-3)] border border-[var(--border-strong)] cursor-not-allowed opacity-50'
                    : plan.popular
                      ? 'bg-gradient-to-r from-orange-500 to-rose-600 text-white shadow-xl shadow-orange-900/20 hover:opacity-90'
                      : 'bg-[var(--input-bg)] text-[var(--text-2)] hover:bg-[var(--border)] border border-[var(--border-strong)]'
              }`}
            >
              {plan.id === activePlan
                ? (isSuperuser ? 'Active (change anyway)' : 'Active plan')
                : plan.isComingSoon
                  ? (isSuperuser ? 'Coming soon (apply anyway)' : 'Coming soon')
                  : planMutation.isPending
                    ? 'Updating...'
                    : !trialEndsAt
                      ? 'Start trial here'
                      : 'Switch to this plan'}
            </button>
          </div>
        ))}
      </div>

      <div className="mb-20">
        <h4 className="text-center text-[var(--text-3)] font-black text-sm uppercase tracking-[0.2em] mb-8">Choose by operations style</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <ServiceStyleCard plan="MINI" style="Token + self pickup" focus="Street food / kiosks" />
          <ServiceStyleCard plan="CAFÉ" style="QR + partial table service" focus="Quick cafés / single floor" />
          <ServiceStyleCard plan="DINEPRO" style="Full waiter service" focus="Busy dine-in operations" />
          <ServiceStyleCard plan="PREMIUM" style="Central operator control" focus="Multi-outlet HQ" />
        </div>
      </div>

      <div className="mt-16 pt-16 border-t border-[var(--border)] grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-8 rounded-3xl bg-[var(--surface-2)] border border-[var(--border)]">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Zap className="text-blue-400" size={20} />
            </div>
            <h4 className="font-black text-[var(--text-1)]">Advanced waiter app</h4>
          </div>
          <p className="text-[var(--text-2)] text-sm font-medium mb-4">Mobile-first waiter workflow for table-side capture, guest acknowledgement, and faster service recovery. Available from Café upward.</p>
          <button className="text-blue-400 text-sm font-black uppercase tracking-widest hover:text-blue-300 transition-all">Enable role-based login →</button>
        </div>

        <div className="p-8 rounded-3xl bg-[var(--surface-2)] border border-[var(--border)]">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Target className="text-orange-400" size={20} />
            </div>
            <h4 className="font-black text-[var(--text-1)]">White-glove setup</h4>
          </div>
          <p className="text-[var(--text-2)] text-sm font-medium mb-4">For venues that want help scanning menus, mapping floors, and tightening the first week of operations instead of figuring it all out alone.</p>
          <button className="text-orange-400 text-sm font-black uppercase tracking-widest hover:text-orange-300 transition-all">Request quote →</button>
        </div>
      </div>

      <div className="mt-20 text-center space-y-4">
        <div className="flex items-center justify-center gap-6 mb-4 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[var(--surface-opaque)] border border-[var(--border)]">
            <Check className="text-emerald-400" size={16} />
            <span className="text-xs font-black text-[var(--text-1)] uppercase tracking-wider">No platform commission</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[var(--surface-opaque)] border border-[var(--border)]">
            <Smartphone className="text-blue-400" size={16} />
            <span className="text-xs font-black text-[var(--text-1)] uppercase tracking-wider">Works on phones and tablets</span>
          </div>
        </div>
        <p className="text-[var(--text-3)] text-sm font-medium">
          Choose for the workload you have now, not the company you hope to become two years from today.
        </p>
      </div>
    </div>
  );
}

function ServiceStyleCard({ plan, style, focus }: { plan: string; style: string; focus: string }) {
  return (
    <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-blue-500/30 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
          {plan}
        </span>
        <ChevronRight size={14} className="text-[var(--text-3)] group-hover:text-blue-400 transition-colors" />
      </div>
      <p className="text-sm font-black text-[var(--text-1)] mb-1">{style}</p>
      <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-tight">{focus}</p>
    </div>
  );
}

function MetricBox({ label, value, icon, description }: { label: string; value: string; icon: ReactNode; description: string }) {
  return (
    <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
          {icon}
        </div>
        <span className="text-[10px] font-black text-[var(--text-3)] uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-2xl font-black text-[var(--text-1)]">{value}</div>
      <p className="text-[10px] text-[var(--text-3)] font-bold mt-1 uppercase tracking-tight">{description}</p>
    </div>
  );
}

function QuestionItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-3)] border border-[var(--border-strong)]">
      <span className="text-sm font-bold text-[var(--text-2)]">{label}</span>
      {value}
    </div>
  );
}

function QuestionToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-3)] border border-[var(--border-strong)]">
      <span className="text-sm font-bold text-[var(--text-2)]">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-all relative ${checked ? 'bg-blue-600' : 'bg-[var(--border)]'}`}
      >
        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${checked ? 'right-1' : 'left-1'}`} />
      </button>
    </div>
  );
}
