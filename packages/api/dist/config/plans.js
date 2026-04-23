"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_LIMITS = exports.PLAN_ALIASES = void 0;
exports.parsePlan = parsePlan;
exports.normalizePlan = normalizePlan;
exports.getPlanLimits = getPlanLimits;
exports.getAvailablePlans = getAvailablePlans;
const CANONICAL_PLAN_LIMITS = {
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
    BHOJPRO: {
        items: 9999,
        tables: 18,
        staff: 200,
        price: 3499,
        name: 'Bhoj Pro',
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
exports.PLAN_ALIASES = {
    MINI: 'MINI',
    STARTER: 'MINI',
    CAFE: 'CAFE',
    GROWTH: 'CAFE',
    BHOJPRO: 'BHOJPRO',
    'BHOJ PRO': 'BHOJPRO',
    GOLD: 'BHOJPRO',
    PREMIUM: 'PREMIUM',
    PLATINUM: 'PREMIUM',
};
exports.PLAN_LIMITS = {
    ...CANONICAL_PLAN_LIMITS,
};
function parsePlan(plan) {
    const key = String(plan || '').trim().toUpperCase();
    return exports.PLAN_ALIASES[key] ?? null;
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