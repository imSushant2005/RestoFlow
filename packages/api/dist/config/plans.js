"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_LIMITS = void 0;
exports.parsePlan = parsePlan;
exports.normalizePlan = normalizePlan;
exports.getPlanLimits = getPlanLimits;
exports.getAvailablePlans = getAvailablePlans;
const CANONICAL_PLAN_LIMITS = {
    MINI: {
        items: 50,
        tables: 3,
        staff: 1,
        price: 599,
        name: 'Mini',
        hasKDS: false,
        hasWaiterRole: true,
        hasWaiterApp: false,
        hasAdvancedAnalytics: true,
        hasAssistedDirectBill: true,
        hasAssistedCustomerLookup: true,
        maxFloors: 1,
    },
    CAFE: {
        items: 200,
        tables: 9,
        staff: 5,
        price: 1299,
        name: 'Cafe',
        hasKDS: true,
        hasWaiterRole: true,
        hasWaiterApp: false,
        hasAdvancedAnalytics: false,
        hasAssistedDirectBill: true,
        hasAssistedCustomerLookup: false,
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
        hasAssistedDirectBill: true,
        hasAssistedCustomerLookup: true,
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
        hasAssistedDirectBill: true,
        hasAssistedCustomerLookup: true,
        maxFloors: 10,
    },
};
const PLAN_ALIASES = {
    MINI: 'MINI',
    FREE: 'MINI',
    STARTER: 'MINI',
    CAFE: 'CAFE',
    GROWTH: 'CAFE',
    DINEPRO: 'DINEPRO',
    PREMIUM: 'PREMIUM',
    PLATINUM: 'PREMIUM',
};
exports.PLAN_LIMITS = {
    ...CANONICAL_PLAN_LIMITS,
};
function parsePlan(plan) {
    const key = String(plan || '').trim().toUpperCase();
    return PLAN_ALIASES[key] ?? null;
}
function normalizePlan(plan) {
    return parsePlan(plan) || 'MINI';
}
function getPlanLimits(plan) {
    return CANONICAL_PLAN_LIMITS[normalizePlan(plan)];
}
function getAvailablePlans() {
    return CANONICAL_PLAN_LIMITS;
}
//# sourceMappingURL=plans.js.map