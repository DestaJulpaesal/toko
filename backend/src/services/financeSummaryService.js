const money = (value) => Number(value || 0);

export async function getFinanceSummary(client, now = new Date()) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const ranges = [
    ['todaysIncome', 'INCOME', todayStart],
    ['weekIncome', 'INCOME', weekStart],
    ['monthIncome', 'INCOME', monthStart],
    ['todaysExpense', 'EXPENSE', todayStart],
    ['weekExpense', 'EXPENSE', weekStart],
    ['monthExpense', 'EXPENSE', monthStart],
  ];

  const [totals, rangeTotals, profitRows] = await Promise.all([
    client.financeTransaction.groupBy({
      by: ['type'],
      where: { deletedAt: null },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    Promise.all(ranges.map(async ([key, type, start]) => {
      const result = await client.financeTransaction.aggregate({
        where: { type, deletedAt: null, createdAt: { gte: start } },
        _sum: { amount: true },
      });
      return [key, money(result._sum.amount)];
    })),
    client.$queryRaw`
      SELECT
        COALESCE(SUM((item."unitPrice" - COALESCE(variant."basePrice", 0)) * item."quantity"), 0)::double precision AS "grossProfit",
        COALESCE(SUM(CASE WHEN orders."createdAt" >= ${todayStart} THEN (item."unitPrice" - COALESCE(variant."basePrice", 0)) * item."quantity" ELSE 0 END), 0)::double precision AS "todaysGrossProfit",
        COALESCE(SUM(CASE WHEN orders."createdAt" >= ${weekStart} THEN (item."unitPrice" - COALESCE(variant."basePrice", 0)) * item."quantity" ELSE 0 END), 0)::double precision AS "weekGrossProfit",
        COALESCE(SUM(CASE WHEN orders."createdAt" >= ${monthStart} THEN (item."unitPrice" - COALESCE(variant."basePrice", 0)) * item."quantity" ELSE 0 END), 0)::double precision AS "monthGrossProfit"
      FROM "Order" AS orders
      INNER JOIN "OrderItem" AS item ON item."orderId" = orders."id"
      LEFT JOIN "ProductVariant" AS variant ON variant."id" = item."variantId"
      WHERE orders."status"::text = 'COMPLETED'
    `,
  ]);

  const totalsByType = new Map(totals.map((row) => [row.type, row]));
  const sums = Object.fromEntries(rangeTotals);
  const income = money(totalsByType.get('INCOME')?._sum.amount);
  const expense = money(totalsByType.get('EXPENSE')?._sum.amount);
  const transfer = money(totalsByType.get('TRANSFER')?._sum.amount);
  const debt = money(totalsByType.get('DEBT')?._sum.amount);
  const profit = profitRows[0] || {};

  return {
    success: true,
    summary: {
      totalIncome: income,
      totalExpense: expense,
      totalTransfer: transfer,
      totalDebt: debt,
      incomeCount: totalsByType.get('INCOME')?._count._all || 0,
      expenseCount: totalsByType.get('EXPENSE')?._count._all || 0,
      transferCount: totalsByType.get('TRANSFER')?._count._all || 0,
      debtCount: totalsByType.get('DEBT')?._count._all || 0,
      net: income - expense - debt,
      ...sums,
      todaysNet: sums.todaysIncome - sums.todaysExpense,
      grossProfit: money(profit.grossProfit),
      todaysGrossProfit: money(profit.todaysGrossProfit),
      weekGrossProfit: money(profit.weekGrossProfit),
      monthGrossProfit: money(profit.monthGrossProfit),
    },
  };
}
