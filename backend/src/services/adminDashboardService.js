const CACHE_TTL_MS = 15_000;
const dashboardCache = new WeakMap();

function dayStart(now) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function getAdminDashboardSummary(client, now = new Date()) {
  const cached = dashboardCache.get(client);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const today = dayStart(now);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);
  const dueThrough = new Date(now);
  dueThrough.setDate(dueThrough.getDate() + 7);
  const stockSince = new Date(now);
  stockSince.setDate(stockSince.getDate() - 14);

  const [todayIncome, weekIncome, variants, stockOut, dueDebts] = await Promise.all([
    client.financeTransaction.aggregate({
      where: { type: 'INCOME', deletedAt: null, createdAt: { gte: today } },
      _sum: { amount: true },
    }),
    client.financeTransaction.aggregate({
      where: { type: 'INCOME', deletedAt: null, createdAt: { gte: weekStart } },
      _sum: { amount: true },
    }),
    client.productVariant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        stockQty: true,
        product: { select: { stockWarning: true } },
      },
    }),
    client.stockMovement.groupBy({
      by: ['variantId'],
      where: { type: 'OUT', createdAt: { gte: stockSince }, variantId: { not: null } },
      _sum: { quantity: true },
    }),
    client.debtRecord.count({
      where: { status: 'OPEN', deletedAt: null, dueDate: { lte: dueThrough } },
    }),
  ]);

  const soldByVariant = new Map(
    stockOut.map((movement) => [movement.variantId, Number(movement._sum.quantity || 0)]),
  );
  const lowStock = variants.filter((variant) => {
    const averageDailyOut = (soldByVariant.get(variant.id) || 0) / 14;
    const suggestedPurchase = Math.max(
      Math.ceil(averageDailyOut * 7 - Number(variant.stockQty)),
      0,
    );
    return suggestedPurchase > 0 || Number(variant.stockQty) <= Number(variant.product.stockWarning);
  }).length;

  const value = {
    success: true,
    summary: {
      income: Number(todayIncome._sum.amount || 0),
      weekIncome: Number(weekIncome._sum.amount || 0),
      lowStock,
      dueDebts,
      generatedAt: now,
    },
  };
  dashboardCache.set(client, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export function invalidateAdminDashboardSummary(client) {
  dashboardCache.delete(client);
}
