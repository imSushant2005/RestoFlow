import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export type PlanTier = 'MINI' | 'CAFE' | 'DINEPRO' | 'PREMIUM';

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
}

const PLAN_FEATURES_MAP: Record<PlanTier, PlanFeatures> = {
  MINI: {
    name: 'Mini',
    tables: 3,
    staff: 1,
    hasKDS: false,
    hasWaiterRole: true,
    hasWaiterApp: false,
    hasAdvancedAnalytics: true,
    analyticsLevel: 'STANDARD',
    hasExpenseTracking: true,
    hasAssistedDirectBill: true,
    hasAssistedCustomerLookup: true,
    maxFloors: 1,
  },
  CAFE: {
    name: 'Café',
    tables: 9,
    staff: 5,
    hasKDS: true,
    hasWaiterRole: true,
    hasWaiterApp: false,
    hasAdvancedAnalytics: false,
    analyticsLevel: 'STANDARD',
    hasExpenseTracking: false,
    hasAssistedDirectBill: true,
    hasAssistedCustomerLookup: false,
    maxFloors: 1,
  },
  DINEPRO: {
    name: 'DinePro',
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
  },
  PREMIUM: {
    name: 'Premium',
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
  },
};

export function usePlanFeatures() {
  const { data: business, isLoading } = useQuery({
    queryKey: ['settings-business'],
    queryFn: async () => (await api.get('/settings/business')).data,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const plan = (business?.plan?.toUpperCase() || 'MINI') as PlanTier;
  const features = PLAN_FEATURES_MAP[plan] || PLAN_FEATURES_MAP.MINI;

  return {
    plan,
    features,
    isLoading,
    isTrial: !!business?.trialEndsAt,
    daysLeft: business?.trialEndsAt 
      ? Math.ceil((new Date(business.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0
  };
}
