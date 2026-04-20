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
        tables: 4,
        staff: 1,
        price: 799,
        name: 'Mini',
        hasKDS: true,
        hasWaiterRole: true,
        hasWaiterApp: false,
        hasAdvancedAnalytics: true,
        hasAssistedDirectBill: true,
        hasAssistedCustomerLookup: true,
        maxFloors: 1,
        hasFranchiseControls: false,
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
    },
};
const PLAN_ALIASES = {
    MINI: 'MINI',
    FREE: 'MINI',
    STARTER: 'MINI',
    CAFE: 'CAFE',
    GROWTH: 'CAFE',
    DINEPRO: 'DINEPRO',
    // Legacy tier kept in the Prisma enum before the current service-model naming.
    GOLD: 'DINEPRO',
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