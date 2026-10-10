import test from 'node:test';
import assert from 'node:assert/strict';

import { getUrgencyState } from './urgency.js';

test('getUrgencyState returns countdown parts for active promo', () => {
  const state = getUrgencyState(new Date(Date.now() + 1000 * 60 * 60 * 25 + 1000 * 60 * 5));

  assert.strictEqual(state.isActive, true);
  assert.equal(typeof state.days, 'number');
  assert.equal(typeof state.hours, 'number');
  assert.equal(typeof state.minutes, 'number');
  assert.ok(state.minutes >= 0);
});

test('getUrgencyState marks expired promos as inactive', () => {
  const state = getUrgencyState(new Date(Date.now() - 1000 * 60));

  assert.strictEqual(state.isActive, false);
  assert.deepEqual(state.parts, { days: 0, hours: 0, minutes: 0, seconds: 0 });
});
