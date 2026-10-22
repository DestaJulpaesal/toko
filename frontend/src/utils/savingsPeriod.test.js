import test from 'node:test';
import assert from 'node:assert/strict';
import { getExpectedSavingsAmount, getSavingsDepositsInRange, getSavingsPeriodRange } from './savingsPeriod.js';

test('getSavingsPeriodRange returns the trailing seven calendar days', () => {
  assert.deepEqual(getSavingsPeriodRange('week', new Date(2026, 9, 22)), {
    start: '2026-10-16',
    end: '2026-10-22',
    elapsedDays: 7,
  });
});

test('getSavingsPeriodRange returns elapsed days for the current month and year', () => {
  assert.deepEqual(getSavingsPeriodRange('month', new Date(2026, 9, 22)), {
    start: '2026-10-01',
    end: '2026-10-22',
    elapsedDays: 22,
  });
  assert.deepEqual(getSavingsPeriodRange('year', new Date(2026, 9, 22)), {
    start: '2026-01-01',
    end: '2026-10-22',
    elapsedDays: 295,
  });
});

test('getExpectedSavingsAmount scales each contribution cadence to the selected period', () => {
  assert.equal(getExpectedSavingsAmount(10000, 'DAILY', 7), 70000);
  assert.equal(getExpectedSavingsAmount(70000, 'WEEKLY', 7), 70000);
  assert.ok(Math.abs(getExpectedSavingsAmount(300000, 'MONTHLY', 30) - 295700) < 100);
  assert.ok(Math.abs(getExpectedSavingsAmount(3600000, 'YEARLY', 365) - 3597609) < 10);
});

test('getSavingsDepositsInRange filters deposits inclusively by local date', () => {
  const deposits = [
    { date: '2026-10-15', amount: 5 },
    { date: '2026-10-16', amount: 10 },
    { date: '2026-10-22', amount: 15 },
    { date: '2026-10-23', amount: 20 },
  ];
  assert.deepEqual(getSavingsDepositsInRange(deposits, { start: '2026-10-16', end: '2026-10-22' }), deposits.slice(1, 3));
});
