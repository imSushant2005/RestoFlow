import type { SignOptions } from 'jsonwebtoken';

export type PlanLimit = {
  items: number;
  tables: number;
  staff: number;
  price: number;
  name: string;
  serviceWorkflow: 'TOKEN_COUNTER' | 'HYBRID_CAFE' | 'FULL_DINE_IN';
  hasKDS: boolean;
  hasWaiterRole: boolean;
  hasWaiterApp: boolean;
  hasAdvancedAnalytics: boolean;
  hasAssistedDirectBill: boolean;
  hasAssistedCustomerLookup: boolean;
  maxFloors: number;
  hasFranchiseControls: boolean;
  hasWaiterCalling: 'HIDDEN' | 'TOGGLEABLE' | 'ALWAYS';
  recommendedDiningMinutes: number;
  largePartyDiningMinutes: number;
  emptySessionTimeoutMinutes: number;
  sessionAccessHours: number;
};

export type CanonicalPlan = 'MINI' | 'CAFE' | 'BHOJPRO' | 'PREMIUM';
export type SessionAccessTokenTtl = Extract<NonNullable<SignOptions['expiresIn']>, string>;

const CANONICAL_PLAN_LIMITS: Record<CanonicalPlan, PlanLimit> = {
  MINI: {
    items: 50,
    tables: 4,
    staff: 1,
    price: 799,
    name: 'Mini',
    serviceWorkflow: 'TOKEN_COUNTER',
    hasKDS: false,
    hasWaiterRole: false,
    hasWaiterApp: false,
    hasAdvancedAnalytics: false,
    hasAssistedDirectBill: false,
    hasAssistedCustomerLookup: false,
    maxFloors: 1,
    hasFranchiseControls: false,
    hasWaiterCalling: 'HIDDEN',
    recommendedDiningMinutes: 60,
    largePartyDiningMinutes: 150,
    emptySessionTimeoutMinutes: 90,
    sessionAccessHours: 4,
  },
  CAFE: {
    items: 200,
    tables: 9,
    staff: 5,
    price: 1599,
    name: 'Cafe',
    serviceWorkflow: 'HYBRID_CAFE',
    hasKDS: true,
    hasWaiterRole: true,
    hasWaiterApp: true,
    hasAdvancedAnalytics: true,
    hasAssistedDirectBill: true,
    hasAssistedCustomerLookup: true,
    maxFloors: 1,
    hasFranchiseControls: false,
    hasWaiterCalling: 'TOGGLEABLE',
    recommendedDiningMinutes: 120,
    largePartyDiningMinutes: 180,
    emptySessionTimeoutMinutes: 180,
    sessionAccessHours: 8,
  },
  BHOJPRO: {
    items: 9999,
    tables: 18,
    staff: 200,
    price: 3499,
    name: 'Bhoj Pro',
    serviceWorkflow: 'FULL_DINE_IN',
    hasKDS: true,
    hasWaiterRole: true,
    hasWaiterApp: true,
    hasAdvancedAnalytics: true,
    hasAssistedDirectBill: true,
    hasAssistedCustomerLookup: true,
    maxFloors: 2,
    hasFranchiseControls: false,
    hasWaiterCalling: 'ALWAYS',
    recommendedDiningMinutes: 150,
    largePartyDiningMinutes: 210,
    emptySessionTimeoutMinutes: 240,
    sessionAccessHours: 10,
  },
  PREMIUM: {
    items: 99999,
    tables: 9999,
    staff: 9999,
    price: 6499,
    name: 'Hotel / Enterprise',
    serviceWorkflow: 'FULL_DINE_IN',
    hasKDS: true,
    hasWaiterRole: true,
    hasWaiterApp: true,
    hasAdvancedAnalytics: true,
    hasAssistedDirectBill: true,
    hasAssistedCustomerLookup: true,
    maxFloors: 10,
    hasFranchiseControls: true,
    hasWaiterCalling: 'ALWAYS',
    recommendedDiningMinutes: 180,
    largePartyDiningMinutes: 240,
    emptySessionTimeoutMinutes: 300,
    sessionAccessHours: 12,
  },
};

export const PLAN_ALIASES: Record<string, CanonicalPlan> = {
  MINI: 'MINI',
  STARTER: 'MINI',
  CAFE: 'CAFE',
  GROWTH: 'CAFE',
  DINEPRO: 'BHOJPRO',
  BHOJPRO: 'BHOJPRO',
  'BHOJ PRO': 'BHOJPRO',
  GOLD: 'BHOJPRO',
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

function resolveDiningWindowMinutes(plan: unknown, partySize?: number | null) {
  const limits = getPlanLimits(plan);
  const normalizedPartySize = Math.max(1, Number(partySize || 1));
  const familyDiningWindowMinutes = Math.max(limits.recommendedDiningMinutes, 120);

  if (normalizedPartySize >= 6) {
    return Math.max(limits.largePartyDiningMinutes, familyDiningWindowMinutes + 30);
  }

  if (normalizedPartySize >= 4) {
    return familyDiningWindowMinutes;
  }

  return limits.recommendedDiningMinutes;
}

export function getSessionAccessTokenTtl(plan: unknown, partySize?: number | null): SessionAccessTokenTtl {
  const limits = getPlanLimits(plan);
  const diningWindowMinutes = resolveDiningWindowMinutes(plan, partySize);
  const hours = Math.max(limits.sessionAccessHours, Math.ceil((diningWindowMinutes + 120) / 60));
  return `${hours}h` as SessionAccessTokenTtl;
}

export function getEmptySessionTimeoutMinutes(plan: unknown, partySize?: number | null) {
  const limits = getPlanLimits(plan);
  const diningWindowMinutes = resolveDiningWindowMinutes(plan, partySize);
  return Math.max(limits.emptySessionTimeoutMinutes, diningWindowMinutes + 45);
}
