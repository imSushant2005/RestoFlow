import assert from 'node:assert/strict';
import { getPlanLimits, normalizePlan, parsePlan } from '../src/config/plans';
import {
  canMoveSessionToBilling,
  hasServiceInProgress,
  resolvePostPaymentSessionStatus,
} from '../src/utils/session-settlement';

function runChecks() {
  assert.equal(parsePlan('free'), 'MINI');
  assert.equal(parsePlan('growth'), 'CAFE');
  assert.equal(parsePlan('platinum'), 'PREMIUM');
  assert.equal(normalizePlan(undefined), 'MINI');

  const mini = getPlanLimits('MINI');
  const cafe = getPlanLimits('CAFE');
  const dinePro = getPlanLimits('DINEPRO');

  assert.equal(mini.hasAssistedDirectBill, true);
  assert.equal(mini.hasAssistedCustomerLookup, true);
  assert.equal(cafe.hasAssistedDirectBill, true);
  assert.equal(cafe.hasAssistedCustomerLookup, false);
  assert.equal(dinePro.hasAssistedDirectBill, true);
  assert.equal(dinePro.hasAssistedCustomerLookup, true);

  const activeOrders = [{ status: 'NEW' }, { status: 'PREPARING' }];
  assert.equal(hasServiceInProgress(activeOrders), true);
  assert.equal(canMoveSessionToBilling(activeOrders), false);
  assert.equal(resolvePostPaymentSessionStatus('ACTIVE', activeOrders, false), 'ACTIVE');

  const servedOrders = [{ status: 'SERVED' }, { status: 'RECEIVED' }];
  assert.equal(hasServiceInProgress(servedOrders), false);
  assert.equal(canMoveSessionToBilling(servedOrders), true);
  assert.equal(resolvePostPaymentSessionStatus('ACTIVE', servedOrders, false), 'AWAITING_BILL');
  assert.equal(resolvePostPaymentSessionStatus('ACTIVE', activeOrders, true), 'CLOSED');

  console.log('verify-plan-session-flows: ok');
}

runChecks();
