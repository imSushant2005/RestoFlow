export type PlanLimit = {
  items: number;
  tables: number;
  staff: number;
  price: number;
  name: string;
  hasKDS: boolean;
  hasWaiterRole: boolean;
  hasWaiterApp: boolean;
  hasAdvancedAnalytics: boolean;
  maxFloors: number;
};

export type CanonicalPlan = 'MINI' | 'CAFE' | 'DINEPRO' | 'PREMIUM';

const CANONICAL_PLAN_LIMITS: Record<CanonicalPlan, PlanLimit> = {
  MINI: {
    items: 50,
    tables: 3,
    staff: 1, // Only Owner
    price: 599,
    name: 'Mini',
    hasKDS: false,
    hasWaiterRole: false,
    hasWaiterApp: false,
    hasAdvancedAnalytics: false,
    maxFloors: 1,
  },
  CAFE: {
    items: 200,
    tables: 9,
    staff: 5,
    price: 1299,
    name: 'Café',
    hasKDS: true,
    hasWaiterRole: true,
    hasWaiterApp: false, // Waiter role supported, but not the full app
    hasAdvancedAnalytics: false,
    maxFloors: 1,
  },
  DINEPRO: {
    items: 9999,
    tables: 18,
    staff: 20,
    price: 2999,
    name: 'DinePro',
    hasKDS: true,
    hasWaiterRole: true,
    hasWaiterApp: true,
    hasAdvancedAnalytics: true,
    maxFloors: 2,
  },
  PREMIUM: {
    items: 99999,
    tables: 9999,
    staff: 9999,
    price: 6999,
    name: 'Premium',
    hasKDS: true,
    hasWaiterRole: true,
    hasWaiterApp: true,
    hasAdvancedAnalytics: true,
    maxFloors: 10,
  },
};

const PLAN_ALIASES: Record<string, CanonicalPlan> = {
  MINI: 'MINI',
  FREE: 'MINI',
  STARTER: 'MINI',
  CAFE: 'CAFE',
  GROWTH: 'CAFE',
  DINEPRO: 'DINEPRO',
  PREMIUM: 'PREMIUM',
  PLATINUM: 'PREMIUM',
};

export const PLAN_LIMITS: Record<string, PlanLimit> = {
  ...CANONICAL_PLAN_LIMITS,
};

export function parsePlan(plan: unknown): CanonicalPlan | null {
  const key = String(plan || '').trim().toUpperCase();
  return PLAN_ALIASES[key] ?? null;
}

export function normalizePlan(plan: unknown): CanonicalPlan {
  return parsePlan(plan) || 'MINI';
}

export function getPlanLimits(plan: unknown): PlanLimit {
  return CANONICAL_PLAN_LIMITS[normalizePlan(plan)];
}

export function getAvailablePlans() {
  return CANONICAL_PLAN_LIMITS;
}
