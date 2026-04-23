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
  hasAssistedDirectBill: boolean;
  hasAssistedCustomerLookup: boolean;
  maxFloors: number;
  hasFranchiseControls: boolean;
  hasWaiterCalling: 'HIDDEN' | 'TOGGLEABLE' | 'ALWAYS';
};

export type CanonicalPlan = 'MINI' | 'CAFE' | 'DINEPRO' | 'PREMIUM';

const CANONICAL_PLAN_LIMITS: Record<CanonicalPlan, PlanLimit> = {
  MINI: {
    items: 50,
    tables: 4,
    staff: 1,
    price: 799,
    name: 'Mini',
    hasKDS: false,
    hasWaiterRole: false,
    hasWaiterApp: false,
    hasAdvancedAnalytics: false,
    hasAssistedDirectBill: false,
    hasAssistedCustomerLookup: false,
    maxFloors: 1,
    hasFranchiseControls: false,
    hasWaiterCalling: 'HIDDEN',
  },
  CAFE: {
    items: 200,
    tables: 9,
    staff: 5,
    price: 1599,
    name: 'Cafe',
    hasKDS: true,
    hasWaiterRole: true,
    hasWaiterApp: true,
    hasAdvancedAnalytics: true,
    hasAssistedDirectBill: true,
    hasAssistedCustomerLookup: true,
    maxFloors: 1,
    hasFranchiseControls: false,
    hasWaiterCalling: 'TOGGLEABLE',
  },
  DINEPRO: {
    items: 9999,
    tables: 18,
    staff: 200,
    price: 3499,
    name: 'Dine Pro',
    hasKDS: true,
    hasWaiterRole: true,
    hasWaiterApp: true,
    hasAdvancedAnalytics: true,
    hasAssistedDirectBill: true,
    hasAssistedCustomerLookup: true,
    maxFloors: 2,
    hasFranchiseControls: false,
    hasWaiterCalling: 'ALWAYS',
  },
  PREMIUM: {
    items: 99999,
    tables: 9999,
    staff: 9999,
    price: 6499,
    name: 'Hotel / Enterprise',
    hasKDS: true,
    hasWaiterRole: true,
    hasWaiterApp: true,
    hasAdvancedAnalytics: true,
    hasAssistedDirectBill: true,
    hasAssistedCustomerLookup: true,
    maxFloors: 10,
    hasFranchiseControls: true,
    hasWaiterCalling: 'ALWAYS',
  },
};

export const PLAN_ALIASES: Record<string, CanonicalPlan> = {
  MINI: 'MINI',
  STARTER: 'MINI',
  CAFE: 'CAFE',
  GROWTH: 'CAFE',
  DINEPRO: 'DINEPRO',
  GOLD: 'DINEPRO',
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
