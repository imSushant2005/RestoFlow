import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { 
  Rocket, 
  Target, 
  Check, 
  Zap, 
  HelpCircle, 
  LayoutDashboard, 
  Sparkles,
  TrendingUp,
  Smartphone,
  ChevronRight,
} from 'lucide-react';

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
  icon: React.ReactNode;
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
    tagline: 'Fast GST Billing (Self Service)',
    serviceStyle: 'Token + Self Pickup',
    description: 'Perfect for street food, kiosks, and small cafes with self-service.',
    gradient: 'from-blue-500 to-cyan-500',
    icon: <Zap className="text-[var(--text-1)]" size={24} />,
    features: [
      'Fast GST Billing & Receipting',
      'QR Ordering (Self-Serve)',
      'Live Order Status Display',
      'Customer Self Pickup Flow',
      'Basic Menu Setup',
      'Daily Sales Reports (Email)',
      'Works on any Android Phone',
      'Up to 3 tables / Single device',
    ]
  },
  {
    id: 'CAFE',
    name: 'CAFÉ',
    price: '₹1299',
    annualPrice: '₹1299',
    tagline: 'Table Service (Hybrid Model)',
    serviceStyle: 'Table + Waiter Service',
    description: 'Designed for small cafes where waiters or QR orders drive the service.',
    gradient: 'from-fuchsia-600 to-purple-600',
    icon: <Target className="text-[var(--text-1)]" size={24} />,
    features: [
      'Everything in MINI',
      'Table Management (Up to 9)',
      'Waiter Role Support (Staff)',
      'Basic Kitchen Display (KDS)',
      'Table Mapping & Sessions',
      'GST Billing & Receipting',
      'Detailed Sales Reports',
      'Up to 5 Staff accounts',
    ]
  },
  {
    id: 'DINEPRO',
    name: 'DINEPRO',
    price: '₹2999',
    annualPrice: '₹2999',
    tagline: 'High Control Dining System',
    serviceStyle: 'Full Waiter Service Controller',
    description: 'The standard for high-volume restaurants requiring full waiter coordination.',
    gradient: 'from-orange-500 to-rose-600',
    icon: <Rocket className="text-[var(--text-1)]" size={24} />,
    popular: true,
    features: [
      'Everything in CAFÉ',
      'Up to 18 Tables Support',
      '2-Floor / Zone Management',
      'Mobile Waiter App (Full POS)',
      'Advanced Sessions Tracking',
      'Analytics Pro (Hourly Rush)',
      'Unlimited Staff accounts',
      'Multi-device (Dual Floor Support)',
    ]
  },
  {
    id: 'PREMIUM',
    name: 'PREMIUM',
    price: '₹6,999',
    annualPrice: '₹5,599',
    tagline: 'Coming Soon',
    serviceStyle: 'Multi-Outlet Intelligence',
    description: 'Advanced profit monitoring and central HQ control for growing restaurant chains.',
    gradient: 'from-amber-400 to-orange-600',
    icon: <Sparkles className="text-[var(--text-1)]" size={24} />,
    isComingSoon: true,
    features: [
      'Everything in DinePro',
      'Profit per item tracking',
      'Central Inventory HQ',
      'Customer Loyalty (Repeat/VIP)',
      'Advanced Multi-branch Analytics',
      'Feedback & Review Tracking',
      'Priority 24/7 Setup Support',
    ]
  }
];

export function PlansHub() {
  const queryClient = useQueryClient();
  const [isAnnual, setIsAnnual] = useState(true);
  
  const { data: business } = useQuery({
    queryKey: ['settings-business'],
    queryFn: async () => (await api.get('/settings/business')).data,
  });

  const planMutation = useMutation({
    mutationFn: async (plan: string) => {
      return api.patch('/settings/business', { plan });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-business'] });
    },
  });

  const userEmail = localStorage.getItem('userEmail');
  const isSuperuser = userEmail === 'sushantrana2005@gmail.com';

  // Recommendation Engine State
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [answers, setAnswers] = useState({
    tables: 0,
    qr: false,
    multi: false
  });

  // Plan/Trial Logic
  const activePlan = (business?.plan || 'MINI') as PlanTier;
  const trialEndsAt = business?.trialEndsAt;
  
  const daysLeft = useMemo(() => {
    if (!trialEndsAt) return 0;
    const end = new Date(trialEndsAt);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }, [trialEndsAt]);

  const recommendedPlan = useMemo(() => {
    if (answers.multi || answers.tables > 18) return 'PREMIUM';
    if (answers.tables > 9) return 'DINEPRO';
    if (answers.tables > 3) return 'CAFE';
    return 'MINI';
  }, [answers]);

  return (
    <div className="flex-1 p-8 overflow-y-auto w-full custom-scrollbar bg-transparent">
      {activePlan && trialEndsAt && daysLeft > 0 && (
        <div className="mb-10 p-4 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-900/40">
              <Zap size={20} />
            </div>
            <div>
              <p className="text-sm font-black text-[var(--text-1)]">Active {activePlan} Trial</p>
              <p className="text-xs text-indigo-300">You have full Pro access for {daysLeft} more days.</p>
            </div>
          </div>
          <Link to="/onboarding" className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all">
            Recalibrate Operations
          </Link>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20 flex items-center gap-1">
               <Sparkles size={10} /> 30-Day Free Trial
             </span>
          </div>
          <h2 className="text-4xl font-black text-[var(--text-1)] tracking-tight"> Subscription & Growth</h2>
          <div className="flex items-center gap-3 mt-3">
            <p className="text-[var(--text-2)] font-medium max-w-xl">
              {activePlan ? `Manage your account subscription and scale your restaurant operations.` : "You're currently in your first month of RestoFlow. Dominate your operations with zero friction."}
            </p>
            {activePlan && (
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                Active Plan: {activePlan}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Trial Performance Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-12">
        <MetricBox 
          label="Trial Days Left" 
          value="24 Days" 
          icon={<Zap size={16} />}
          description="Full Pro Access"
        />
        <MetricBox 
          label="Efficiency Gained" 
          value="82%" 
          icon={<TrendingUp size={16} />}
          description="vs manual workflow"
        />
        <MetricBox 
          label="Orders Processed" 
          value="142" 
          icon={<LayoutDashboard size={16} />}
          description="Trial usage data"
        />
        <button 
          onClick={() => setShowRecommendation(true)}
          className="p-5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex flex-col justify-center items-center gap-2 group hover:scale-[1.02] transition-all shadow-xl shadow-blue-900/20"
        >
          <HelpCircle size={24} className="group-hover:rotate-12 transition-transform" />
          <span className="font-black text-sm text-center">Plan Recommendation Engine</span>
        </button>
      </div>

      {/* Recommendation Engine UI */}
      {showRecommendation && (
        <div className="mb-12 p-8 rounded-3xl bg-[var(--surface-opaque)] border border-blue-500/30 backdrop-blur-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 -rotate-12 pointer-events-none">
            <Rocket size={120} className="text-blue-400" />
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            <div className="flex-1">
              <h3 className="text-2xl font-black text-[var(--text-1)] mb-2 flex items-center gap-3">
                <Target className="text-blue-400" /> Finding your perfect scale
              </h3>
              <p className="text-[var(--text-2)] font-medium mb-6">Answer a few questions to see which RestoFlow plan fits your operations best.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <QuestionItem 
                  label="Number of Tables" 
                  value={
                    <input 
                      type="number" 
                      value={answers.tables} 
                      onChange={(e) => setAnswers((prev: typeof answers) => ({ ...prev, tables: Number(e.target.value) }))}
                      className="w-20 bg-[var(--input-bg)] border-[var(--border-strong)] rounded-lg px-2 py-1 text-[var(--text-1)] font-bold"
                    />
                  }
                />
                <QuestionToggle 
                   label="High QR Order Volume?" 
                   checked={answers.qr} 
                   onChange={(v) => setAnswers((prev: typeof answers) => ({ ...prev, qr: v }))} 
                />
                <QuestionToggle 
                   label="Multi-Outlet Management?" 
                   checked={answers.multi} 
                   onChange={(v) => setAnswers((prev: typeof answers) => ({ ...prev, multi: v }))} 
                />
              </div>
            </div>
            
            <div className="w-full md:w-64 p-6 rounded-2xl bg-[var(--surface-3)] border border-[var(--border-strong)] text-center flex flex-col items-center shadow-2xl">
              <p className="text-xs font-black text-[var(--text-3)] uppercase tracking-widest mb-2">Our Recommendation</p>
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-3 text-white">
                <Sparkles size={24} />
              </div>
              <p className="text-xl font-black text-[var(--text-1)]">{recommendedPlan}</p>
              <button 
                onClick={() => {
                  const el = document.getElementById(`plan-${recommendedPlan}`);
                  el?.scrollIntoView({ behavior: 'smooth' });
                  setShowRecommendation(false);
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-wider hover:bg-blue-500 transition-all"
              >
                Choose This Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Toggle */}
      <div className="flex items-center justify-center gap-4 mb-12">
        <span className={`text-sm font-bold transition-all ${!isAnnual ? 'text-[var(--text-1)]' : 'text-[var(--text-3)]'}`}>Monthly</span>
        <button 
          onClick={() => setIsAnnual(!isAnnual)}
          className={`w-14 h-7 rounded-full transition-all relative ${isAnnual ? 'bg-blue-600' : 'bg-[var(--input-bg)]'}`}
        >
          <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${isAnnual ? 'right-1' : 'left-1'}`} />
        </button>
        <span className={`text-sm font-bold transition-all ${isAnnual ? 'text-[var(--text-1)]' : 'text-[var(--text-3)]'}`}>
          Annual Billing <span className="text-emerald-400 ml-1 text-xs px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">Save 20%</span>
        </span>
      </div>

      {/* Pricing Grid */}
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
                Most Popular Choice
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
            
            <h3 className="text-xl font-black text-[var(--text-1)]">{plan.name} Plan</h3>
            <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-1">{plan.tagline}</p>
            
            <div className="flex items-baseline gap-1 mt-1 mb-4">
              <span className="text-3xl font-black text-[var(--text-1)]">{isAnnual ? plan.annualPrice : plan.price}</span>
              <span className="text-[var(--text-3)] font-bold text-xs">/outlet /mo</span>
            </div>
            
            <div className="px-3 py-2 rounded-xl bg-[var(--surface-3)] border border-[var(--border)] mb-6">
              <p className="text-[9px] font-black text-[var(--text-3)] uppercase tracking-widest mb-0.5">Service Model</p>
              <p className="text-sm font-bold text-[var(--text-1)]">{plan.serviceStyle}</p>
            </div>
            
            <div className="flex-1 space-y-3 mb-8">
              {plan.features.map((feature, i) => (
                <div key={i} className="flex items-start gap-2">
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
            }`}>
              {plan.id === activePlan ? (isSuperuser ? 'Active (Change Anyway)' : 'Active Plan') : 
               plan.isComingSoon ? (isSuperuser ? 'Coming Soon (Apply anyway)' : 'Coming Soon') :
               planMutation.isPending ? 'Updating...' :
               !trialEndsAt ? 'Start 30-Day Free Trial' : 'Upgrade Now'}
            </button>
          </div>
        ))}
      </div>

      {/* Service Style Logic Row — The Game Changer */}
      <div className="mb-20">
        <h4 className="text-center text-[var(--text-3)] font-black text-sm uppercase tracking-[0.2em] mb-8">Choose by Operations Style</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <ServiceStyleCard plan="MINI" style="Token + Self Pickup" focus="Street Food / Kiosks" />
          <ServiceStyleCard plan="CAFÉ" style="Table + Partial Service" focus="Quick Cafes / Single Floor" />
          <ServiceStyleCard plan="DINEPRO" style="Full Waiter Service" focus="Fine Dine / 2 Floor Systems" />
          <ServiceStyleCard plan="PREMIUM" style="Smart + Optimized" focus="Multi-Outlet HQ (Coming Soon)" />
        </div>
      </div>

      {/* Add-on Strategy Layer */}
      <div className="mt-16 pt-16 border-t border-[var(--border)] grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-8 rounded-3xl bg-[var(--surface-2)] border border-[var(--border)]">
           <div className="flex items-center gap-4 mb-4">
             <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
               <Zap className="text-blue-400" size={20} />
             </div>
             <h4 className="font-black text-[var(--text-1)]">Advanced Waiter App</h4>
           </div>
           <p className="text-[var(--text-2)] text-sm font-medium mb-4">Mobile-optimized interface for waiters to take orders at the table. Available for Café and DinePro.</p>
           <button className="text-blue-400 text-sm font-black uppercase tracking-widest hover:text-blue-300 transition-all">Enable Role-based login →</button>
        </div>
        
        <div className="p-8 rounded-3xl bg-[var(--surface-2)] border border-[var(--border)]">
           <div className="flex items-center gap-4 mb-4">
             <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
               <Target className="text-orange-400" size={20} />
             </div>
             <h4 className="font-black text-[var(--text-1)]">White-Glove Setup</h4>
           </div>
           <p className="text-[var(--text-2)] text-sm font-medium mb-4">Expert team visit for physical menu high-res scanning and floor layout mapping.</p>
           <button className="text-orange-400 text-sm font-black uppercase tracking-widest hover:text-orange-300 transition-all">Request Quote →</button>
        </div>
      </div>

      <div className="mt-20 text-center space-y-4">
        <div className="flex items-center justify-center gap-6 mb-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[var(--surface-opaque)] border border-[var(--border)]">
             <Check className="text-emerald-400" size={16} />
             <span className="text-xs font-black text-[var(--text-1)] uppercase tracking-wider">No Commission</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[var(--surface-opaque)] border border-[var(--border)]">
             <Smartphone className="text-blue-400" size={16} />
             <span className="text-xs font-black text-[var(--text-1)] uppercase tracking-wider">Works on any Android / Tablet</span>
          </div>
        </div>
        <p className="text-[var(--text-3)] text-sm font-medium">
          Secure payments powered by <strong>Razorpay</strong>. No hidden fees. Cancel anytime.
        </p>
      </div>
    </div>
  );
}

function ServiceStyleCard({ plan, style, focus }: { plan: string, style: string, focus: string }) {
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

function MetricBox({ label, value, icon, description }: { label: string, value: string, icon: React.ReactNode, description: string }) {
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

function QuestionItem({ label, value }: { label: string, value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-3)] border border-[var(--border-strong)]">
      <span className="text-sm font-bold text-[var(--text-2)]">{label}</span>
      {value}
    </div>
  );
}

function QuestionToggle({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean) => void }) {
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
