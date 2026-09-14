import prisma from '../src/config/db.js';

/**
 * Backfills the finance master data after the finance_overhaul migration.
 * Local browser data is intentionally not read here; the authenticated
 * /api/savings/import-local endpoint handles that per user.
 */
async function main() {
  const account = await prisma.financeAccount.upsert({
    where: { id: 'finance-default-cash' },
    create: { id: 'finance-default-cash', name: 'Kas Toko', type: 'CASH', startBalance: 0 },
    update: {},
  });
  for (const [name, type] of [['Penjualan', 'INCOME'], ['Pendapatan lain-lain', 'INCOME'], ['Pengeluaran lain-lain', 'EXPENSE'], ['Transfer antar akun', 'TRANSFER']]) {
    await prisma.financeCategory.upsert({
      where: { name_type: { name, type } },
      create: { name, type, isDefault: true },
      update: {},
    });
  }

  const transactions = await prisma.financeTransaction.findMany({
    where: { OR: [{ accountId: null }, { categoryId: null }] },
    select: { id: true, type: true, category: true },
  });
  const categoryCache = new Map();
  for (const transaction of transactions) {
    const legacyName = transaction.category?.trim() || (transaction.type === 'INCOME' ? 'Pendapatan lain-lain' : 'Pengeluaran lain-lain');
    const key = `${legacyName}:${transaction.type}`;
    let category = categoryCache.get(key);
    if (!category) {
      category = await prisma.financeCategory.upsert({
        where: { name_type: { name: legacyName, type: transaction.type } },
        create: { name: legacyName, type: transaction.type, isDefault: true },
        update: {},
      });
      categoryCache.set(key, category);
    }
    await prisma.financeTransaction.update({
      where: { id: transaction.id },
      data: { accountId: transaction.accountId || account.id, categoryId: transaction.categoryId || category.id },
    });
  }
  console.log(`Finance data migration complete: ${transactions.length} transaction(s) backfilled.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
