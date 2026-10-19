import assert from 'node:assert/strict';
import test from 'node:test';
import { getFinanceSummary } from '../src/services/financeSummaryService.js';

test('finance summary aggregates transaction periods and order profit without loading orders into Node', async () => {
  const calls = { groupBy: 0, aggregate: 0, raw: 0 };
  const client = {
    financeTransaction: {
      groupBy: async () => {
        calls.groupBy += 1;
        return [
          { type: 'INCOME', _sum: { amount: 1000 }, _count: { _all: 4 } },
          { type: 'EXPENSE', _sum: { amount: 250 }, _count: { _all: 2 } },
          { type: 'TRANSFER', _sum: { amount: 100 }, _count: { _all: 1 } },
          { type: 'DEBT', _sum: { amount: 50 }, _count: { _all: 1 } },
        ];
      },
      aggregate: async ({ where }) => {
        calls.aggregate += 1;
        return { _sum: { amount: where.type === 'INCOME' ? 300 : 75 } };
      },
    },
    $queryRaw: async (strings, ...values) => {
      calls.raw += 1;
      assert.equal(values.length, 3);
      assert.match(strings.join('?'), /SUM\(.*unitPrice/s);
      return [{ grossProfit: 500, todaysGrossProfit: 40, weekGrossProfit: 220, monthGrossProfit: 350 }];
    },
  };

  const summary = await getFinanceSummary(client, new Date(2026, 9, 19, 14));

  assert.deepEqual(summary, {
    success: true,
    summary: {
      totalIncome: 1000,
      totalExpense: 250,
      totalTransfer: 100,
      totalDebt: 50,
      incomeCount: 4,
      expenseCount: 2,
      transferCount: 1,
      debtCount: 1,
      net: 700,
      todaysIncome: 300,
      weekIncome: 300,
      monthIncome: 300,
      todaysExpense: 75,
      weekExpense: 75,
      monthExpense: 75,
      todaysNet: 225,
      grossProfit: 500,
      todaysGrossProfit: 40,
      weekGrossProfit: 220,
      monthGrossProfit: 350,
    },
  });
  assert.deepEqual(calls, { groupBy: 1, aggregate: 6, raw: 1 });
});
