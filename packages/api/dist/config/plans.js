"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_LIMITS = exports.PLAN_ALIASES = void 0;
exports.parsePlan = parsePlan;
exports.normalizePlan = normalizePlan;
exports.getPlanLimits = getPlanLimits;
exports.getAvailablePlans = getAvailablePlans;
exports.getSessionAccessTokenTtl = getSessionAccessTokenTtl;
exports.getEmptySessionTimeoutMinutes = getEmptySessionTimeoutMinutes;
const CANONICAL_PLAN_LIMITS = {
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
exports.PLAN_ALIASES = {
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
function resolveDiningWindowMinutes(plan, partySize) {
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
function getSessionAccessTokenTtl(plan, partySize) {
    const limits = getPlanLimits(plan);
    const diningWindowMinutes = resolveDiningWindowMinutes(plan, partySize);
    const hours = Math.max(limits.sessionAccessHours, Math.ceil((diningWindowMinutes + 120) / 60));
    return `${hours}h`;
}
function getEmptySessionTimeoutMinutes(plan, partySize) {
    const limits = getPlanLimits(plan);
    const diningWindowMinutes = resolveDiningWindowMinutes(plan, partySize);
    return Math.max(limits.emptySessionTimeoutMinutes, diningWindowMinutes + 45);
}
//# sourceMappingURL=plans.js.map