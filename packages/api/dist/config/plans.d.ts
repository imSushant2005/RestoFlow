export type PlanLimit = {
    items: number;
    tables: number;
    staff: number;
    price: number;
    name: string;
};
export type CanonicalPlan = 'FREE' | 'STARTER' | 'GOLD' | 'PLATINUM';
export declare const PLAN_LIMITS: Record<string, PlanLimit>;
export declare function parsePlan(plan: unknown): CanonicalPlan | null;
export declare function normalizePlan(plan: unknown): CanonicalPlan;
export declare function getPlanLimits(plan: unknown): PlanLimit;
export declare function getAvailablePlans(): Record<CanonicalPlan, PlanLimit>;
//# sourceMappingURL=plans.d.ts.map