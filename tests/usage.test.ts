import test from 'node:test';
import assert from 'node:assert/strict';
import { readUsage, shapeUsage } from '../src/usage.ts';

test('usage panel shows the 5-hour and weekly limits, hidden when the plan has none', async () => {
  const u = shapeUsage({ subscription_type: 'max', rate_limits_available: true, rate_limits: { five_hour: { utilization: 25.4, resets_at: 'x' }, seven_day: { utilization: 2, resets_at: null } } });
  assert.deepEqual(u, { plan: 'Max', windows: [{ key: 'five_hour', label: '5-hour', used: 25, resetsAt: 'x' }, { key: 'seven_day', label: 'Weekly', used: 2, resetsAt: null }] });
  assert.equal(shapeUsage({ rate_limits_available: false, rate_limits: null }), null);
  assert.equal(shapeUsage(undefined), null);
  // Claude Code without the call: hide, never break.
  const noCall = (() => ({ interrupt: async () => {}, close() {} })) as any;
  assert.equal(await readUsage('.', noCall), null);
  const throws = (() => ({ usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET: async () => { throw new Error('gone'); } })) as any;
  assert.equal(await readUsage('.', throws), null);
});
