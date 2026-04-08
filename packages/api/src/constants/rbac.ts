import { UserRole } from '@dineflow/prisma';

export const FULL_ACCESS_ROLES: UserRole[] = [UserRole.OWNER, UserRole.MANAGER];

export const ORDER_ACCESS_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.CASHIER,
  UserRole.WAITER,
  UserRole.KITCHEN,
];

export const ORDER_HISTORY_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.CASHIER,
];

export const BUSINESS_SETTINGS_READ_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.CASHIER,
  UserRole.WAITER,
  UserRole.KITCHEN,
];

export const BILLING_VIEW_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.CASHIER,
];

