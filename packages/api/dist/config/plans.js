"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_LIMITS = void 0;
exports.parsePlan = parsePlan;
exports.normalizePlan = normalizePlan;
exports.getPlanLimits = getPlanLimits;
exports.getAvailablePlans = getAvailablePlans;
const CANONICAL_PLAN_LIMITS = {
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
const PLAN_ALIASES = {
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
exports.PLAN_LIMITS = {
    ...CANONICAL_PLAN_LIMITS,
    PRO: CANONICAL_PLAN_LIMITS.STARTER,
    GROWTH: CANONICAL_PLAN_LIMITS.GOLD,
    SCALE: CANONICAL_PLAN_LIMITS.PLATINUM,
    PREMIUM: CANONICAL_PLAN_LIMITS.PLATINUM,
};
function parsePlan(plan) {
    const key = String(plan || '').trim().toUpperCase();
    return PLAN_ALIASES[key] ?? null;
}
function normalizePlan(plan) {
    return parsePlan(plan) || 'FREE';
}
function getPlanLimits(plan) {
    return CANONICAL_PLAN_LIMITS[normalizePlan(plan)];
}
function getAvailablePlans() {
    return CANONICAL_PLAN_LIMITS;
}
//# sourceMappingURL=plans.js.map