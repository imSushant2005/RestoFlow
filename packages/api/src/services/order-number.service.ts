import { randomBytes } from 'crypto';

/**
 * Generates a tenant-scoped order number that is collision-resistant
 * without requiring a DB sequence.
 *
 * Format: {PREFIX}-{YYMMDD}-{RANDOM6}
 * Example: D-260417-K3XZ9P
 *
 * The random component (6 base-36 chars from 4 random bytes → 2^32 ≈ 4 billion
 * combinations) makes collision probability negligible per day per tenant.
 *
 * A DB unique constraint on (tenantId, orderNumber) is the final safety net —
 * Prisma throws P2002 on collision, which the caller must catch and retry once.
 */
export function generateOrderNumber(orderType?: string): string {
  const now = new Date();
  const dateStr = [
    String(now.getFullYear()).slice(-2),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');

  const rand = randomBytes(4)
    .readUInt32BE(0)
    .toString(36)
    .toUpperCase()
    .padStart(6, '0')
    .slice(0, 6);

  const uppercaseType = String(orderType || '').toUpperCase();
  let prefix = 'T';
  if (uppercaseType === 'DINE_IN') prefix = 'D';
  else if (uppercaseType === 'ROAMING') prefix = 'R';
  else if (uppercaseType === 'ZOMATO') prefix = 'Z';
  else if (uppercaseType === 'SWIGGY') prefix = 'S';

  return `${prefix}-${dateStr}-${rand}`;
}
