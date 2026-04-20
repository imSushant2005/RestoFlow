const assert = require('node:assert/strict');

const { parsePlan, normalizePlan, getPlanLimits, getAvailablePlans } = require('../dist/config/plans.js');
const { resolvePostPaymentSessionStatus } = require('../dist/utils/session-settlement.js');

const activeOrders = [{ status: 'NEW' }];
const servedOrders = [{ status: 'SERVED' }, { status: 'RECEIVED' }];

assert.deepStrictEqual(Object.keys(getAvailablePlans()).sort(), ['CAFE', 'DINEPRO', 'MINI', 'PREMIUM']);

assert.strictEqual(parsePlan('FREE'), 'MINI');
assert.strictEqual(parsePlan('STARTER'), 'MINI');
assert.strictEqual(parsePlan('GOLD'), 'DINEPRO');
assert.strictEqual(parsePlan('PLATINUM'), 'PREMIUM');
assert.strictEqual(parsePlan('GROWTH'), 'CAFE');

assert.strictEqual(normalizePlan('GOLD'), 'DINEPRO');
assert.strictEqual(getPlanLimits('GOLD').name, 'DinePro');
assert.strictEqual(getPlanLimits('PLATINUM').name, 'Premium');

assert.strictEqual(resolvePostPaymentSessionStatus('ACTIVE', activeOrders, false), 'ACTIVE');
assert.strictEqual(resolvePostPaymentSessionStatus('ACTIVE', servedOrders, false), 'AWAITING_BILL');
assert.strictEqual(resolvePostPaymentSessionStatus('AWAITING_BILL', servedOrders, false), 'AWAITING_BILL');
assert.strictEqual(resolvePostPaymentSessionStatus('ACTIVE', activeOrders, true), 'CLOSED');

console.log('plan-session verification ok');
