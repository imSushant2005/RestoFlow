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
export type CanonicalPlan = 'MINI' | 'CAFE' | 'BHOJPRO' | 'PREMIUM';
export declare const PLAN_ALIASES: Record<string, CanonicalPlan>;
export declare const PLAN_LIMITS: Record<string, PlanLimit>;
export declare function parsePlan(plan: unknown): CanonicalPlan | null;
export declare function normalizePlan(plan: unknown): CanonicalPlan;
export declare function getPlanLimits(plan: unknown): PlanLimit;
export declare function getAvailablePlans(): Record<CanonicalPlan, PlanLimit>;
//# sourceMappingURL=plans.d.ts.map