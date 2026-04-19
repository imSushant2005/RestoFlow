type OrderStatusLike = {
  status?: string | null;
};

export function hasServiceInProgress(orders: Array<OrderStatusLike> = []) {
  return orders.some((order) => !['SERVED', 'RECEIVED'].includes(String(order?.status || '').toUpperCase()));
}

export function canMoveSessionToBilling(orders: Array<OrderStatusLike> = []) {
  return orders.length > 0 && !hasServiceInProgress(orders);
}

export function resolvePostPaymentSessionStatus(
  currentStatus: string,
  orders: Array<OrderStatusLike> = [],
  shouldClose: boolean,
) {
  if (shouldClose) {
    return 'CLOSED';
  }

  return canMoveSessionToBilling(orders) ? 'AWAITING_BILL' : currentStatus;
}
