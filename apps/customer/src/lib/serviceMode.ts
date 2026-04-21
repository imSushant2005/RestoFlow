export type CustomerServiceMode = 'DINE_IN' | 'TAKEAWAY';

export function normalizeCustomerServiceMode(value: unknown): CustomerServiceMode {
  return String(value || '').trim().toUpperCase() === 'DINE_IN' ? 'DINE_IN' : 'TAKEAWAY';
}

export function getCustomerServiceCopy(value: unknown) {
  const mode = normalizeCustomerServiceMode(value);

  if (mode === 'DINE_IN') {
    return {
      mode,
      label: 'Dine In',
      shortLabel: 'Dine in',
      compactLabel: 'Dine In',
      description: 'Enjoy it in the outlet',
      summary: 'Prepared for your table or dine-in seat',
    };
  }

  return {
    mode,
    label: 'Packed',
    shortLabel: 'Packed',
    compactLabel: 'Packed',
    description: 'Collect it from the counter',
    summary: 'Packed and ready for pickup',
  };
}

export function getCustomerSessionLabel(input: { tableName?: string | null; orderType?: string | null }) {
  const tableName = String(input.tableName || '').trim();
  if (tableName) return tableName;
  return getCustomerServiceCopy(input.orderType).label;
}
