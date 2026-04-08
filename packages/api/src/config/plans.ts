export type PlanLimit = {
  items: number;
  tables: number;
  staff: number;
  price: number;
  name: string;
};

export type CanonicalPlan = 'FREE' | 'STARTER' | 'GOLD' | 'PLATINUM';

const CANONICAL_PLAN_LIMITS: Record<CanonicalPlan, PlanLimit> = {
  FREE: {
    items: 10,
    tables: 5,
    staff: 2,
    price: 0,
    name: 'Free',
  },
  STARTER: {
    items: 50,
    tables: 20,
    staff: 5,
    price: 49,
    name: 'Starter',
  },
  GOLD: {
    items: 200,
    tables: 50,
    staff: 20,
    price: 99,
    name: 'Gold',
  },
  PLATINUM: {
    items: 999999,
    tables: 999999,
    staff: 999999,
    price: 199,
    name: 'Platinum',
  },
};

const PLAN_ALIASES: Record<string, CanonicalPlan> = {
  FREE: 'FREE',
  STARTER: 'STARTER',
  PRO: 'STARTER',
  GROWTH: 'GOLD',
  GOLD: 'GOLD',
  SCALE: 'PLATINUM',
  PREMIUM: 'PLATINUM',
  PLATINUM: 'PLATINUM',
};

// Backward-compatible map that accepts legacy keys as well.
export const PLAN_LIMITS: Record<string, PlanLimit> = {
  ...CANONICAL_PLAN_LIMITS,
  PRO: CANONICAL_PLAN_LIMITS.STARTER,
  GROWTH: CANONICAL_PLAN_LIMITS.GOLD,
  SCALE: CANONICAL_PLAN_LIMITS.PLATINUM,
  PREMIUM: CANONICAL_PLAN_LIMITS.PLATINUM,
};

export function parsePlan(plan: unknown): CanonicalPlan | null {
  const key = String(plan || '').trim().toUpperCase();
  return PLAN_ALIASES[key] ?? null;
}

export function normalizePlan(plan: unknown): CanonicalPlan {
  return parsePlan(plan) || 'FREE';
}

export function getPlanLimits(plan: unknown): PlanLimit {
  return CANONICAL_PLAN_LIMITS[normalizePlan(plan)];
}

export function getAvailablePlans() {
  return CANONICAL_PLAN_LIMITS;
}
