import assert from 'node:assert/strict';
import test from 'node:test';
import { getAdminDashboardSummary } from '../src/services/adminDashboardService.js';

test('dashboard summary aggregates income, low stock, and due debts and caches briefly', async () => {
  const calls = { aggregate: 0, variants: 0, groupBy: 0, debts: 0 };
  const client = {
    financeTransaction: {
      aggregate: async ({ where }) => {
        calls.aggregate += 1;
        return { _sum: { amount: where.createdAt.gte.getDate() === 15 ? 1250 : 8000 } };
      },
    },
    productVariant: {
      findMany: async () => {
        calls.variants += 1;
        return [
          { id: 'low', stockQty: 4, product: { stockWarning: 2 } },
          { id: 'healthy', stockQty: 20, product: { stockWarning: 1 } },
        ];
      },
    },
    stockMovement: {
      groupBy: async () => {
        calls.groupBy += 1;
        return [{ variantId: 'low', _sum: { quantity: 14 } }];
      },
    },
    debtRecord: {
      count: async () => {
        calls.debts += 1;
        return 3;
      },
    },
  };
  const now = new Date(2026, 5, 15, 12);
  const first = await getAdminDashboardSummary(client, now);
  const cached = await getAdminDashboardSummary(client, new Date(now.getTime() + 1_000));

  assert.deepEqual(first.summary, {
    income: 1250,
    weekIncome: 8000,
    lowStock: 1,
    dueDebts: 3,
    generatedAt: now,
  });
  assert.equal(cached, first);
  assert.deepEqual(calls, { aggregate: 2, variants: 1, groupBy: 1, debts: 1 });
});
