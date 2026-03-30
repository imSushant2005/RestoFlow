import { useState, useEffect } from 'react';
import { Gift, Flame, X } from 'lucide-react';

const REWARDS = [
  { threshold: 3, label: 'Free Drink 🥤', discount: 0 },
  { threshold: 5, label: '10% Off Next Order', discount: 10 },
  { threshold: 10, label: '20% Off + Free Dessert 🍰', discount: 20 },
];

function getVisitCount(tenantSlug: string): number {
  try {
    return parseInt(localStorage.getItem(`rf_visits_${tenantSlug}`) || '0', 10);
  } catch { return 0; }
}

function incrementVisit(tenantSlug: string): number {
  const count = getVisitCount(tenantSlug) + 1;
  localStorage.setItem(`rf_visits_${tenantSlug}`, String(count));
  return count;
}

function getStreak(tenantSlug: string): number {
  try {
    const lastDate = localStorage.getItem(`rf_streak_date_${tenantSlug}`);
    const streak = parseInt(localStorage.getItem(`rf_streak_${tenantSlug}`) || '0', 10);
    if (!lastDate) return 0;
    const diff = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
    return diff <= 2 ? streak : 0; // streak resets after 2 days
  } catch { return 0; }
}

function updateStreak(tenantSlug: string): number {
  const lastDate = localStorage.getItem(`rf_streak_date_${tenantSlug}`);
  const today = new Date().toDateString();
  
  if (lastDate === today) return getStreak(tenantSlug);
  
  const oldStreak = getStreak(tenantSlug);
  const newStreak = oldStreak + 1;
  localStorage.setItem(`rf_streak_${tenantSlug}`, String(newStreak));
  localStorage.setItem(`rf_streak_date_${tenantSlug}`, today);
  return newStreak;
}

export function LoyaltyBanner({ tenantSlug }: { tenantSlug: string }) {
  const [visits, setVisits] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showReward, setShowReward] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const v = getVisitCount(tenantSlug);
    const s = getStreak(tenantSlug);
    setVisits(v);
    setStreak(s);
  }, [tenantSlug]);

  // Call this after a successful order
  const onOrderPlaced = () => {
    const newVisits = incrementVisit(tenantSlug);
    const newStreak = updateStreak(tenantSlug);
    setVisits(newVisits);
    setStreak(newStreak);
    
    const earned = REWARDS.find(r => r.threshold === newVisits);
    if (earned) setShowReward(true);
  };

  // Expose to parent
  (window as any).__restoflow_loyalty_onOrder = onOrderPlaced;

  if (dismissed) return null;

  const nextReward = REWARDS.find(r => r.threshold > visits) || REWARDS[REWARDS.length - 1];
  const remaining = Math.max(0, nextReward.threshold - visits);
  const progress = visits > 0 ? Math.min(100, (visits / nextReward.threshold) * 100) : 0;

  return (
    <>
      {/* Success Reward Modal */}
      {showReward && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm fade-in" onClick={() => setShowReward(false)}>
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl p-8 text-white text-center shadow-2xl scale-up max-w-xs mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-2xl font-black mb-2">Reward Unlocked!</h3>
            <p className="font-bold text-white/90 text-lg">{REWARDS.find(r => r.threshold === visits)?.label}</p>
            <p className="text-sm text-white/70 mt-3">Show this to your waiter to claim</p>
            <button onClick={() => setShowReward(false)} className="mt-6 px-6 py-2 bg-white/20 rounded-full font-bold text-sm backdrop-blur-sm">
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Loyalty Banner */}
      <div className="mx-4 mb-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 rounded-2xl p-4 relative overflow-hidden">
        <button onClick={() => setDismissed(true)} className="absolute top-2 right-2 p-1 text-amber-400 hover:text-amber-600">
          <X size={14} />
        </button>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
            <Gift size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-black text-amber-900">
              {remaining > 0 ? `${remaining} more order${remaining > 1 ? 's' : ''} to unlock` : 'Reward Available!'}
            </p>
            <p className="text-xs text-amber-600 font-medium">{nextReward.label}</p>
          </div>
          {streak > 1 && (
            <div className="ml-auto flex items-center gap-1 bg-red-100 text-red-600 px-2 py-1 rounded-full text-xs font-black">
              <Flame size={12} /> {streak}
            </div>
          )}
        </div>
        <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] font-bold text-amber-500">{visits} orders</span>
          <span className="text-[10px] font-bold text-amber-500">{nextReward.threshold} to unlock</span>
        </div>
      </div>
    </>
  );
}
