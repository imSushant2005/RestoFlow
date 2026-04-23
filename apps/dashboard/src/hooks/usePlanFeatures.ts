import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export type PlanTier = 'MINI' | 'CAFE' | 'BHOJPRO' | 'PREMIUM';

type ServerPlanLimits = {
  name?: string;
  tables?: number;
  staff?: number;
  hasKDS?: boolean;
  hasWaiterRole?: boolean;
  hasWaiterApp?: boolean;
  hasAdvancedAnalytics?: boolean;
  hasAssistedDirectBill?: boolean;
  hasAssistedCustomerLookup?: boolean;
  maxFloors?: number;
  hasFranchiseControls?: boolean;
};

const PLAN_ALIASES: Record<string, PlanTier> = {
  MINI: 'MINI',
  FREE: 'MINI',
  STARTER: 'MINI',
  CAFE: 'CAFE',
  GROWTH: 'CAFE',
  BHOJPRO: 'BHOJPRO',
  'BHOJ PRO': 'BHOJPRO',
  GOLD: 'BHOJPRO',
  PREMIUM: 'PREMIUM',
  PLATINUM: 'PREMIUM',
};

export interface PlanFeatures {
  name: string;
  tables: number;
  staff: number;
  hasKDS: boolean;
  hasWaiterRole: boolean;
  hasWaiterApp: boolean;
  hasAdvancedAnalytics: boolean;
  analyticsLevel: 'BASIC' | 'STANDARD' | 'ADVANCED';
  hasExpenseTracking: boolean;
  hasAssistedDirectBill: boolean;
  hasAssistedCustomerLookup: boolean;
  maxFloors: number;
  hasFranchiseControls: boolean;
}

const PLAN_FEATURES_MAP: Record<PlanTier, PlanFeatures> = {
  MINI: {
    name: 'Mini',
    tables: 4,
    staff: 1,
    hasKDS: true,
    hasWaiterRole: true,
    hasWaiterApp: false,
    hasAdvancedAnalytics: true,
    analyticsLevel: 'ADVANCED',
    hasExpenseTracking: true,
    hasAssistedDirectBill: true,
    hasAssistedCustomerLookup: true,
    maxFloors: 1,
    hasFranchiseControls: false,
  },
  CAFE: {
    name: 'Cafe',
    tables: 9,
    staff: 5,
    hasKDS: true,
    hasWaiterRole: true,
    hasWaiterApp: true,
    hasAdvancedAnalytics: true,
    analyticsLevel: 'ADVANCED',
    hasExpenseTracking: true,
    hasAssistedDirectBill: true,
    hasAssistedCustomerLookup: true,
    maxFloors: 1,
    hasFranchiseControls: false,
  },
  BHOJPRO: {
    name: 'Bhoj Pro',
    tables: 18,
    staff: 200,
    hasKDS: true,
    hasWaiterRole: true,
    hasWaiterApp: true,
    hasAdvancedAnalytics: true,
    analyticsLevel: 'ADVANCED',
    hasExpenseTracking: true,
    hasAssistedDirectBill: true,
    hasAssistedCustomerLookup: true,
    maxFloors: 2,
    hasFranchiseControls: false,
  },
  PREMIUM: {
    name: 'Hotel / Enterprise',
    tables: 9999,
    staff: 9999,
    hasKDS: true,
    hasWaiterRole: true,
    hasWaiterApp: true,
    hasAdvancedAnalytics: true,
    analyticsLevel: 'ADVANCED',
    hasExpenseTracking: true,
    hasAssistedDirectBill: true,
    hasAssistedCustomerLookup: true,
    maxFloors: 10,
    hasFranchiseControls: true,
  },
};

export function normalizePlanTier(plan: unknown): PlanTier {
  const key = String(plan || '').trim().toUpperCase();
  return PLAN_ALIASES[key] || 'MINI';
}

function mergeServerPlanLimits(plan: PlanTier, serverLimits?: ServerPlanLimits | null): PlanFeatures {
  const fallback = PLAN_FEATURES_MAP[plan];
  if (!serverLimits) return fallback;

  const hasAdvancedAnalytics =
    typeof serverLimits.hasAdvancedAnalytics === 'boolean'
      ? serverLimits.hasAdvancedAnalytics
      : fallback.hasAdvancedAnalytics;

  return {
    ...fallback,
    name: typeof serverLimits.name === 'string' && serverLimits.name.trim() ? serverLimits.name : fallback.name,
    tables: typeof serverLimits.tables === 'number' ? serverLimits.tables : fallback.tables,
    staff: typeof serverLimits.staff === 'number' ? serverLimits.staff : fallback.staff,
    hasKDS: typeof serverLimits.hasKDS === 'boolean' ? serverLimits.hasKDS : fallback.hasKDS,
    hasWaiterRole:
      typeof serverLimits.hasWaiterRole === 'boolean' ? serverLimits.hasWaiterRole : fallback.hasWaiterRole,
    hasWaiterApp:
      typeof serverLimits.hasWaiterApp === 'boolean' ? serverLimits.hasWaiterApp : fallback.hasWaiterApp,
    hasAdvancedAnalytics,
    analyticsLevel: hasAdvancedAnalytics ? 'ADVANCED' : 'BASIC',
    hasExpenseTracking: hasAdvancedAnalytics,
    hasAssistedDirectBill:
      typeof serverLimits.hasAssistedDirectBill === 'boolean'
        ? serverLimits.hasAssistedDirectBill
        : fallback.hasAssistedDirectBill,
    hasAssistedCustomerLookup:
      typeof serverLimits.hasAssistedCustomerLookup === 'boolean'
        ? serverLimits.hasAssistedCustomerLookup
        : fallback.hasAssistedCustomerLookup,
    maxFloors: typeof serverLimits.maxFloors === 'number' ? serverLimits.maxFloors : fallback.maxFloors,
    hasFranchiseControls:
      typeof serverLimits.hasFranchiseControls === 'boolean'
        ? serverLimits.hasFranchiseControls
        : fallback.hasFranchiseControls,
  };
}

export function usePlanFeatures() {
  const { data: business, isLoading } = useQuery({
    queryKey: ['settings-business'],
    queryFn: async () => (await api.get('/settings/business')).data,
    staleTime: 1000 * 60 * 5,
  });

  const plan = normalizePlanTier(business?.plan);
  const features = useMemo(
    () => mergeServerPlanLimits(plan, business?.planLimits),
    [business?.planLimits, plan],
  );

  return {
    plan,
    features,
    isLoading,
    isTrial: !!business?.trialEndsAt,
    daysLeft: business?.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(business.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0,
  };
}
