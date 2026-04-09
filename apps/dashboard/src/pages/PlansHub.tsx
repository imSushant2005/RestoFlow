import { useState, useMemo } from 'react';
import { 
  Rocket, 
  Target, 
  Crown, 
  Check, 
  Zap, 
  HelpCircle, 
  LayoutDashboard, 
  Sparkles,
  TrendingUp,
} from 'lucide-react';

type PlanTier = 'STARTER' | 'GROWTH' | 'ENTERPRISE';

interface PricingPlan {
  id: PlanTier;
  name: string;
  price: string;
  annualPrice: string;
  description: string;
  gradient: string;
  icon: React.ReactNode;
  popular?: boolean;
  features: string[];
}

const PLANS: PricingPlan[] = [
  {
    id: 'STARTER',
    name: 'Starter',
    price: '₹999',
    annualPrice: '₹799',
    description: 'Perfect for small cafes and food trucks getting started.',
    gradient: 'from-blue-500 to-cyan-500',
    icon: <Target className="text-white" size={24} />,
    features: [
      'Core GST Billing & Invoicing',
      'Basic Menu Management',
      'Table & Zone Tracking',
      'Standard Staff Access',
      'Business Identity (Logo/GSTIN)',
    ]
  },
  {
    id: 'GROWTH',
    name: 'Growth',
    price: '₹1,999',
    annualPrice: '₹1,499',
    description: 'The "Digital Hub" for modern restaurants focused on expansion.',
    gradient: 'from-fuchsia-600 to-purple-600',
    icon: <Rocket className="text-white" size={24} />,
    popular: true,
    features: [
      'Everything in Starter',
      'Unlimited QR Ordering',
      'High-Res Digital Menu',
      '0% Commission on Orders',
      'Customer Feedback Engine',
      'WhatsApp Sales Alerts',
    ]
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: '₹2,999',
    annualPrice: '₹2,399',
    description: 'High-volume operations requiring advanced kitchen control.',
    gradient: 'from-orange-500 to-rose-600',
    icon: <Crown className="text-white" size={24} />,
    features: [
      'Everything in Growth',
      'Advanced Kitchen Display (KDS)',
      'Multi-Outlet Analytics',
      'Inventory Tracking Pro',
      'Custom Setup & Training',
      'Priority 24/7 Support',
    ]
  }
];

export function PlansHub() {
  const [isAnnual, setIsAnnual] = useState(true);
  
  // Recommendation Engine State
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [answers, setAnswers] = useState({
    tables: 0,
    qr: false,
    multi: false
  });

  const recommendedPlan = useMemo(() => {
    if (answers.multi || answers.tables > 20) return 'ENTERPRISE';
    if (answers.qr || answers.tables > 10) return 'GROWTH';
    return 'STARTER';
  }, [answers]);

  return (
    <div className="flex-1 p-8 overflow-y-auto w-full custom-scrollbar bg-slate-950/20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20 flex items-center gap-1">
               <Sparkles size={10} /> 30-Day Free Trial
             </span>
          </div>
          <h2 className="text-4xl font-black text-white tracking-tight"> Subscription & Growth</h2>
          <p className="text-slate-400 mt-2 font-medium max-w-xl">
            You're currently in your first month of RestoFlow. Dominate your operations with zero friction.
          </p>
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
        <div className="mb-12 p-8 rounded-3xl bg-slate-900/80 border border-blue-500/30 backdrop-blur-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 -rotate-12 pointer-events-none">
            <Rocket size={120} className="text-blue-400" />
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            <div className="flex-1">
              <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
                <Target className="text-blue-400" /> Finding your perfect scale
              </h3>
              <p className="text-slate-400 font-medium mb-6">Answer a few questions to see which RestoFlow plan fits your operations best.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <QuestionItem 
                  label="Number of Tables" 
                  value={
                    <input 
                      type="number" 
                      value={answers.tables} 
                      onChange={(e) => setAnswers(prev => ({ ...prev, tables: Number(e.target.value) }))}
                      className="w-20 bg-slate-800 border-slate-700 rounded-lg px-2 py-1 text-white font-bold"
                    />
                  }
                />
                <QuestionToggle 
                   label="High QR Order Volume?" 
                   checked={answers.qr} 
                   onChange={(v) => setAnswers(prev => ({ ...prev, qr: v }))} 
                />
                <QuestionToggle 
                   label="Multi-Outlet Management?" 
                   checked={answers.multi} 
                   onChange={(v) => setAnswers(prev => ({ ...prev, multi: v }))} 
                />
              </div>
            </div>
            
            <div className="w-full md:w-64 p-6 rounded-2xl bg-slate-800/80 border border-slate-700 text-center flex flex-col items-center shadow-2xl">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Our Recommendation</p>
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-3 text-white">
                <Sparkles size={24} />
              </div>
              <p className="text-xl font-black text-white">{recommendedPlan}</p>
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
        <span className={`text-sm font-bold transition-all ${!isAnnual ? 'text-white' : 'text-slate-500'}`}>Monthly</span>
        <button 
          onClick={() => setIsAnnual(!isAnnual)}
          className={`w-14 h-7 rounded-full transition-all relative ${isAnnual ? 'bg-blue-600' : 'bg-slate-800'}`}
        >
          <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${isAnnual ? 'right-1' : 'left-1'}`} />
        </button>
        <span className={`text-sm font-bold transition-all ${isAnnual ? 'text-white' : 'text-slate-500'}`}>
          Annual Billing <span className="text-emerald-400 ml-1 text-xs px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">Save 20%</span>
        </span>
      </div>

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {PLANS.map((plan) => (
          <div 
            key={plan.id}
            id={`plan-${plan.id}`}
            className={`rounded-3xl p-8 flex flex-col h-full relative border transition-all hover:scale-[1.01] ${
              plan.popular ? 'bg-slate-900 border-fuchsia-500/30' : 'bg-slate-900/40 border-slate-800'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-fuchsia-600 to-purple-600 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-fuchsia-900/20">
                Most Popular Choice
              </div>
            )}
            
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-6 shadow-xl`}>
              {plan.icon}
            </div>
            
            <h3 className="text-2xl font-black text-white">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mt-1 mb-4">
              <span className="text-4xl font-black text-white">{isAnnual ? plan.annualPrice : plan.price}</span>
              <span className="text-slate-500 font-bold text-sm">/outlet /mo</span>
            </div>
            
            <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
              {plan.description}
            </p>
            
            <div className="flex-1 space-y-4 mb-10">
              {plan.features.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1 w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Check size={10} className="text-blue-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-300">{feature}</span>
                </div>
              ))}
            </div>
            
            <button className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
              plan.popular 
                ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-xl shadow-fuchsia-900/20 hover:opacity-90' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}>
              {plan.id === 'STARTER' ? 'Start Free' : 'Upgrade Now'}
            </button>
          </div>
        ))}
      </div>

      {/* Add-on Strategy Layer */}
      <div className="mt-16 pt-16 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800">
           <div className="flex items-center gap-4 mb-4">
             <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
               <Zap className="text-emerald-400" size={20} />
             </div>
             <h4 className="font-black text-white">SMS & WhatsApp Alerts</h4>
           </div>
           <p className="text-slate-400 text-sm font-medium mb-4">Transactional credits for real-time order updates and marketing blasts. Pay as you go.</p>
           <button className="text-emerald-400 text-sm font-black uppercase tracking-widest hover:text-emerald-300 transition-all">Buy Credits →</button>
        </div>
        
        <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800">
           <div className="flex items-center gap-4 mb-4">
             <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
               <Target className="text-orange-400" size={20} />
             </div>
             <h4 className="font-black text-white">White-Glove Setup</h4>
           </div>
           <p className="text-slate-400 text-sm font-medium mb-4">Expert team visit for physical menu high-res scanning and floor layout mapping.</p>
           <button className="text-orange-400 text-sm font-black uppercase tracking-widest hover:text-orange-300 transition-all">Request Quote →</button>
        </div>
      </div>

      <div className="mt-20 text-center">
        <p className="text-slate-500 text-sm font-medium">
          Secure payments powered by <strong>Razorpay</strong>. No hidden fees. Cancel anytime.
        </p>
      </div>
    </div>
  );
}

function MetricBox({ label, value, icon, description }: { label: string, value: string, icon: React.ReactNode, description: string }) {
  return (
    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl backdrop-blur-md">
       <div className="flex items-center gap-2 mb-3">
         <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
           {icon}
         </div>
         <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
       </div>
       <div className="text-2xl font-black text-white">{value}</div>
       <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-tight">{description}</p>
    </div>
  );
}

function QuestionItem({ label, value }: { label: string, value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700">
      <span className="text-sm font-bold text-slate-300">{label}</span>
      {value}
    </div>
  );
}

function QuestionToggle({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700">
      <span className="text-sm font-bold text-slate-300">{label}</span>
      <button 
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-all relative ${checked ? 'bg-blue-600' : 'bg-slate-700'}`}
      >
        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${checked ? 'right-1' : 'left-1'}`} />
      </button>
    </div>
  );
}
