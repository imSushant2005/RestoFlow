// Use string literals instead of Plan enum import to avoid requiring the enum to be exported correctly
// Plan values must match the Prisma schema enum exactly

export const PLAN_LIMITS: Record<string, { items: number; tables: number; staff: number; price: number; name: string }> = {
  FREE: {
    items: 10,
    tables: 5,
    staff: 2,
    price: 0,
    name: 'Free'
  },
  STARTER: {
    items: 50,
    tables: 20,
    staff: 5,
    price: 49,
    name: 'Starter'
  },
  GROWTH: {
    items: 200,
    tables: 50,
    staff: 20,
    price: 99,
    name: 'Growth'
  },
  SCALE: {
    items: 999999,
    tables: 999999,
    staff: 999999,
    price: 199,
    name: 'Scale'
  }
};
