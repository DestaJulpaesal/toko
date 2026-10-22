import test from 'node:test';
import assert from 'node:assert/strict';
import { savingsGoalSchema, savingsGoalUpdateSchema } from '../src/middleware/security.js';

test('savings goal accepts explicit contribution amount and defaults to daily cadence', () => {
  assert.deepEqual(savingsGoalSchema.parse({
    name: 'Dana pendidikan',
    targetAmount: '5000000',
    contributionAmount: '100000',
  }), {
    name: 'Dana pendidikan',
    targetAmount: 5000000,
    contributionAmount: 100000,
    contributionFrequency: 'DAILY',
  });
});

test('savings goal keeps accepting the legacy dailyAmount field', () => {
  const parsed = savingsGoalSchema.parse({
    name: 'Dana darurat',
    targetAmount: 1000000,
    dailyAmount: 250000,
    contributionFrequency: 'WEEKLY',
  });
  assert.equal(parsed.dailyAmount, 250000);
  assert.equal(parsed.contributionFrequency, 'WEEKLY');
});

test('savings goal requires a positive contribution and supported frequency', () => {
  assert.throws(() => savingsGoalSchema.parse({ name: 'Target', targetAmount: 100000 }));
  assert.throws(() => savingsGoalSchema.parse({
    name: 'Target',
    targetAmount: 100000,
    contributionAmount: 1000,
    contributionFrequency: 'FORTNIGHTLY',
  }));
});

test('savings goal partial updates do not require a contribution amount', () => {
  assert.deepEqual(savingsGoalUpdateSchema.parse({ name: 'Nama baru' }), { name: 'Nama baru' });
});
