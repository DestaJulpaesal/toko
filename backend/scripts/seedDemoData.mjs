import prisma from '../src/config/db.js';

const date = (daysAgo = 0, hour = 10) => {
  const value = new Date();
  value.setDate(value.getDate() - daysAgo);
  value.setHours(hour, 0, 0, 0);
  return value;
};

async function upsertMany(model, rows) {
  for (const row of rows) {
    const { id, ...data } = row;
    await prisma[model].upsert({ where: { id }, update: data, create: row });
  }
}

async function seedDemoData() {
  const owner = await prisma.user.findUnique({ where: { email: 'owner@glosir.com' } });
  const cashier = await prisma.user.findUnique({ where: { email: 'kasir@glosir.com' } });
  if (!owner || !cashier) throw new Error('Akun demo belum ada. Jalankan seedDemoPrisma.mjs terlebih dahulu.');

  const products = await prisma.product.findMany({
    where: { isParcel: false, status: 'ACTIVE' },
    include: { variants: { where: { isActive: true }, take: 1 } },
    orderBy: { createdAt: 'asc' },
  });
  if (!products.length || !products[0].variants[0]) throw new Error('Produk demo belum tersedia.');

  const customers = Array.from({ length: 10 }, (_, index) => ({
    id: `demo-customer-${index + 1}`,
    name: `Pelanggan Demo ${String(index + 1).padStart(2, '0')}`,
    phone: `08212000${String(index + 1).padStart(4, '0')}`,
    email: `pelanggan.demo${index + 1}@example.com`,
    address: `Jl. Demo No. ${index + 1}, Jakarta`,
    notes: 'Data demo untuk pengujian aplikasi',
    points: (index + 1) * 25,
  }));
  await upsertMany('customer', customers);

  const regions = Array.from({ length: 10 }, (_, index) => ({
    id: `demo-region-${index + 1}`,
    name: `Wilayah Demo ${index + 1}`,
    code: `DM${String(index + 1).padStart(2, '0')}`,
    managerId: owner.id,
    isActive: true,
  }));
  await upsertMany('parcelRegion', regions);

  const parcels = await prisma.parcel.findMany({ orderBy: { createdAt: 'asc' }, take: 3 });
  const programs = Array.from({ length: 10 }, (_, index) => ({
    id: `demo-program-${index + 1}`,
    name: `Program Parsel Demo ${index + 1}`,
    year: new Date().getFullYear(),
    targetAmount: 5000000 + (index * 250000),
    isActive: true,
    notes: 'Program demo untuk pengujian pengelolaan parsel',
  }));
  for (const program of programs) {
    await prisma.parcelProgram.upsert({
      where: { name_year: { name: program.name, year: program.year } },
      update: program,
      create: program,
    });
  }

  const participants = Array.from({ length: 10 }, (_, index) => ({
    id: `demo-participant-${index + 1}`,
    customerId: customers[index].id,
    parcelId: parcels[index % parcels.length]?.id,
    programId: programs[index].id,
    regionId: regions[index].id,
    name: customers[index].name,
    participantPhone: customers[index].phone,
    targetAmount: 1000000 + (index * 100000),
    salePrice: 950000 + (index * 100000),
    grossMargin: 50000,
    managerCommission: 25000,
    contributionAmount: 50000,
    frequency: index % 2 ? 'WEEKLY' : 'DAILY',
    startDate: date(index + 1),
    status: 'ACTIVE',
    notes: 'Peserta demo',
  }));
  await upsertMany('parcelParticipant', participants);

  const contributions = Array.from({ length: 10 }, (_, index) => ({
    id: `demo-contribution-${index + 1}`,
    participantId: participants[index].id,
    amount: 50000 + (index * 5000),
    paidAt: date(index),
    note: 'Setoran demo',
  }));
  await upsertMany('parcelContribution', contributions);

  const sessions = Array.from({ length: 10 }, (_, index) => ({
    id: `demo-collection-${index + 1}`,
    regionId: regions[index].id,
    managerId: owner.id,
    collectionDate: date(index),
    status: index % 3 === 0 ? 'VERIFIED' : 'SUBMITTED',
    expectedAmount: 250000 + (index * 10000),
    actualCash: 250000 + (index * 10000),
    difference: 0,
    note: 'Sesi penagihan demo',
    verifiedAt: index % 3 === 0 ? date(index, 15) : null,
    verifiedById: index % 3 === 0 ? owner.id : null,
  }));
  await upsertMany('collectionSession', sessions);
  for (let index = 0; index < 10; index += 1) {
    await prisma.collectionEntry.upsert({
      where: { sessionId_participantId: { sessionId: sessions[index].id, participantId: participants[index].id } },
      update: { amount: contributions[index].amount, note: 'Entri demo' },
      create: { id: `demo-collection-entry-${index + 1}`, sessionId: sessions[index].id, participantId: participants[index].id, amount: contributions[index].amount, note: 'Entri demo' },
    });
  }

  const financeCategories = [
    ['demo-fin-cat-income', 'Penjualan Toko', 'INCOME'],
    ['demo-fin-cat-expense', 'Belanja Stok', 'EXPENSE'],
    ['demo-fin-cat-operational', 'Operasional', 'EXPENSE'],
  ];
  for (const [id, name, type] of financeCategories) {
    await prisma.financeCategory.upsert({
      where: { name_type: { name, type } },
      update: { icon: 'wallet', isDefault: true },
      create: { id, name, type, icon: 'wallet', isDefault: true },
    });
  }
  const incomeCategory = await prisma.financeCategory.findUnique({ where: { name_type: { name: 'Penjualan Toko', type: 'INCOME' } } });
  const expenseCategory = await prisma.financeCategory.findUnique({ where: { name_type: { name: 'Belanja Stok', type: 'EXPENSE' } } });
  const accounts = [
    { id: 'demo-account-cash', name: 'Kas Toko Demo', type: 'CASH', startBalance: 2500000 },
    { id: 'demo-account-bank', name: 'Bank Toko Demo', type: 'BANK', startBalance: 7500000 },
  ];
  await upsertMany('financeAccount', accounts);
  const tags = Array.from({ length: 10 }, (_, index) => ({ id: `demo-tag-${index + 1}`, name: `Demo Tag ${index + 1}`, color: '#2a8f5b' }));
  await upsertMany('financeTag', tags);

  const orders = [];
  const orderItems = [];
  const transactions = [];
  for (let index = 0; index < 50; index += 1) {
    const product = products[index % products.length];
    const variant = product.variants[0];
    const quantity = (index % 3) + 1;
    const subtotal = Number(variant.sellPrice) * quantity;
    const orderId = `demo-order-${String(index + 1).padStart(3, '0')}`;
    const customer = customers[index % customers.length];
    orders.push({
      id: orderId,
      orderNumber: `DEMO-${new Date().getFullYear()}-${String(index + 1).padStart(4, '0')}`,
      type: 'STORE',
      status: index % 7 === 0 ? 'PENDING' : 'COMPLETED',
      customerId: customer.id,
      userId: cashier.id,
      subtotal,
      discount: index % 5 === 0 ? 5000 : 0,
      shippingCost: 0,
      fulfillmentMethod: 'PICKUP',
      total: subtotal - (index % 5 === 0 ? 5000 : 0),
      paymentMethod: index % 4 === 0 ? 'QRIS' : 'CASH',
      paymentStatus: 'PAID',
      paidAmount: subtotal - (index % 5 === 0 ? 5000 : 0),
      pointsAwarded: Math.floor(subtotal / 100000),
      notes: 'Transaksi kasir demo',
      createdAt: date(index % 14, 9 + (index % 8)),
    });
    orderItems.push({
      id: `demo-order-item-${String(index + 1).padStart(3, '0')}`,
      orderId,
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      quantity,
      unitPrice: variant.sellPrice,
      total: subtotal,
    });
    transactions.push({
      id: `demo-income-${String(index + 1).padStart(3, '0')}`,
      orderId,
      userId: cashier.id,
      accountId: index % 4 === 0 ? accounts[1].id : accounts[0].id,
      categoryId: incomeCategory.id,
      type: 'INCOME',
      amount: subtotal - (index % 5 === 0 ? 5000 : 0),
      description: `Penjualan kasir ${index + 1}`,
      category: 'Penjualan',
      paymentMethod: index % 4 === 0 ? 'QRIS' : 'CASH',
      createdAt: date(index % 14, 9 + (index % 8)),
    });
  }
  await upsertMany('order', orders);
  await upsertMany('orderItem', orderItems);
  await upsertMany('financeTransaction', transactions);

  const debts = customers.slice(0, 10).map((customer, index) => ({
    id: `demo-debt-${index + 1}`,
    customerId: customer.id,
    amount: 150000 + (index * 25000),
    paidAmount: index % 3 === 0 ? 50000 : 0,
    status: index % 3 === 0 ? 'PARTIAL' : 'OPEN',
    dueDate: date(-7 - index),
    description: 'Piutang pelanggan demo',
  }));
  await upsertMany('debtRecord', debts);

  const stockMovements = [];
  const opnames = [];
  for (let index = 0; index < 10 && index < products.length; index += 1) {
    const product = products[index];
    const variant = product.variants[0];
    stockMovements.push({
      id: `demo-stock-in-${index + 1}`,
      productId: product.id,
      variantId: variant.id,
      type: 'IN',
      quantity: 25,
      note: 'Stok awal demo',
      reference: 'SEED-DEMO',
    });
    opnames.push({
      id: `demo-opname-${index + 1}`,
      variantId: variant.id,
      systemQty: variant.stockQty,
      physicalQty: Number(variant.stockQty) - (index % 2),
      difference: index % 2 ? -1 : 0,
      note: 'Opname demo',
      performedById: owner.id,
    });
  }
  await upsertMany('stockMovement', stockMovements);
  await upsertMany('stockOpname', opnames);

  const restock = await prisma.restockList.upsert({
    where: { id: 'demo-restock-list' },
    update: { status: 'OPEN', notes: 'Daftar restock demo' },
    create: { id: 'demo-restock-list', status: 'OPEN', notes: 'Daftar restock demo', createdById: owner.id },
  });
  for (let index = 0; index < 10 && index < products.length; index += 1) {
    const product = products[index];
    const variant = product.variants[0];
    await prisma.restockItem.upsert({
      where: { restockListId_variantId: { restockListId: restock.id, variantId: variant.id } },
      update: { requestedQty: 10, stockQty: Number(variant.stockQty), purchaseUnit: variant.unit },
      create: {
        id: `demo-restock-item-${index + 1}`, restockListId: restock.id, productId: product.id, variantId: variant.id,
        productName: product.name, sku: variant.sku, categoryName: 'Demo', unit: variant.unit,
        stockQty: Number(variant.stockQty), stockWarning: product.stockWarning, suggestedQty: 10,
        requestedQty: 10, purchaseUnit: variant.unit, status: 'OPEN',
      },
    });
  }

  const financeRows = [
    ...Array.from({ length: 10 }, (_, index) => ({
      id: `demo-expense-${index + 1}`, userId: owner.id, accountId: accounts[0].id, categoryId: expenseCategory.id,
      type: 'EXPENSE', amount: 100000 + (index * 10000), description: `Belanja operasional demo ${index + 1}`,
      category: 'Belanja Stok', paymentMethod: 'CASH', createdAt: date(index),
    })),
  ];
  await upsertMany('financeTransaction', financeRows);
  await upsertMany('budget', [{ id: 'demo-budget-1', categoryId: expenseCategory.id, month: new Date().getMonth() + 1, year: new Date().getFullYear(), limitAmount: 5000000 }]);
  await upsertMany('recurringTransaction', [{ id: 'demo-recurring-1', type: 'EXPENSE', amount: 750000, description: 'Sewa toko bulanan demo', categoryId: expenseCategory.id, accountId: accounts[0].id, frequency: 'MONTHLY', dayOfMonth: 1, startDate: date(30) }]);
  await upsertMany('accountTransfer', [{ id: 'demo-transfer-1', fromAccountId: accounts[1].id, toAccountId: accounts[0].id, amount: 500000, note: 'Transfer dana demo' }]);
  await upsertMany('cashReconciliation', [{ id: 'demo-reconciliation-1', accountId: accounts[0].id, systemBalance: 2500000, physicalCount: 2495000, difference: -5000, note: 'Selisih kas demo', userId: owner.id }]);
  await upsertMany('financeReminder', Array.from({ length: 10 }, (_, index) => ({ id: `demo-reminder-${index + 1}`, type: 'PAYMENT', title: `Pengingat demo ${index + 1}`, dueDate: date(-index), channel: 'APP' })));
  await upsertMany('promoCampaign', Array.from({ length: 10 }, (_, index) => ({ id: `demo-promo-${index + 1}`, name: `Promo Demo ${index + 1}`, slug: `promo-demo-${index + 1}`, description: 'Promo untuk pengujian', discountType: 'PERCENT', discountValue: 5 + index, startsAt: date(10), endsAt: date(-20) })));
  await upsertMany('siteContent', [
    { id: 'demo-content-terms', type: 'TERMS', title: 'Syarat dan Ketentuan Demo', slug: 'syarat-demo', content: 'Konten demo untuk pengujian.' },
    { id: 'demo-content-faq', type: 'FAQ', title: 'FAQ Demo', slug: 'faq-demo', content: 'Pertanyaan umum demo.' },
  ]);
  await upsertMany('loyaltyRule', [{ id: 'demo-loyalty-rule', pointsPerRp100k: 100, minTransactionAmount: 100000, pointsPerRp: 0.001, isActive: true }]);
  await upsertMany('siteProfile', [{ id: 'main', headline: 'Glosir Demo', story: 'Profil toko demo untuk pengujian.', photoUrl: null }]);
  await upsertMany('savingsGoal', [{ id: 'demo-savings-goal', userId: owner.id, name: 'Dana Renovasi Toko', targetAmount: 15000000, dailyAmount: 100000 }]);
  await upsertMany('savingsDeposit', [{ id: 'demo-savings-deposit', goalId: 'demo-savings-goal', amount: 250000, depositDate: date(1) }]);
  await upsertMany('netWorthItem', [{ id: 'demo-net-worth-cash', name: 'Kas dan Bank Demo', kind: 'ASSET', value: 10000000, isAuto: true }]);
  await upsertMany('netWorthItemHistory', [{ id: 'demo-net-worth-history', itemId: 'demo-net-worth-cash', amount: 10000000, addedAt: date(1) }]);
  await upsertMany('netWorthSnapshot', [{ id: 'demo-net-worth-snapshot', totalAsset: 10000000, totalLiability: 1500000, netWorth: 8500000, capturedAt: date(1) }]);
  await upsertMany('financeQuickTemplate', [{ id: 'demo-quick-template', userId: owner.id, label: 'Belanja Stok', type: 'EXPENSE', amount: 250000, description: 'Belanja stok harian', categoryId: expenseCategory.id, accountId: accounts[0].id, icon: 'shopping-cart' }]);
  await upsertMany('financeLoggingStreak', [{ id: 'demo-finance-streak', userId: owner.id, currentStreak: 5, longestStreak: 12, lastLoggedDate: date(0), totalDaysLogged: 20 }]);
  await prisma.whatsappFinanceSession.upsert({
    where: { phoneNumber: '6282120000000' },
    update: { lastTransactionId: transactions[0].id, pendingCategoryConfirm: null },
    create: { phoneNumber: '6282120000000', lastTransactionId: transactions[0].id, pendingCategoryConfirm: null },
  });
  await upsertMany('emailLog', [{ id: 'demo-email-log', userId: owner.id, recipient: 'owner@glosir.com', subject: 'Ringkasan demo', type: 'REPORT', status: 'SENT', sentAt: date(1) }]);
  await upsertMany('financeAuditLog', [{ id: 'demo-finance-audit', entityType: 'FinanceTransaction', entityId: transactions[0].id, action: 'CREATE', after: { source: 'demo-seed' }, userId: owner.id }]);
  await upsertMany('auditLog', [{ id: 'demo-audit-log', entityType: 'Order', entityId: orders[0].id, field: 'status', oldValue: 'PENDING', newValue: 'COMPLETED', changedById: cashier.id }]);
  await upsertMany('financeApproval', [{ id: 'demo-finance-approval', transactionId: financeRows[0].id, requestedById: owner.id, amount: financeRows[0].amount, description: financeRows[0].description, status: 'PENDING' }]);
  await upsertMany('financeAttachment', [{ id: 'demo-finance-attachment', transactionId: financeRows[0].id, fileUrl: 'https://example.com/demo-receipt.jpg', fileType: 'image/jpeg', ocrRawText: 'Nota demo' }]);
  await upsertMany('financeTransactionSplit', [{ id: 'demo-finance-split', transactionId: financeRows[0].id, categoryId: expenseCategory.id, amount: financeRows[0].amount, note: 'Split demo' }]);
  await prisma.financeTransactionTag.upsert({
    where: { transactionId_tagId: { transactionId: financeRows[0].id, tagId: tags[0].id } },
    update: {},
    create: { transactionId: financeRows[0].id, tagId: tags[0].id },
  });
  if (parcels[0] && products[0]?.variants[0]) {
    await prisma.parcelItem.upsert({
      where: { parcelId_variantId: { parcelId: parcels[0].id, variantId: products[0].variants[0].id } },
      update: { quantity: 1, notes: 'Isi parcel demo' },
      create: { id: 'demo-parcel-item', parcelId: parcels[0].id, variantId: products[0].variants[0].id, quantity: 1, notes: 'Isi parcel demo' },
    });
  }
  const eventPackage = await prisma.eventPackage.findFirst({ orderBy: { createdAt: 'asc' } });
  if (eventPackage && products[0]?.variants[0]) {
    await prisma.eventPackageItem.upsert({
      where: { eventPackageId_variantId: { eventPackageId: eventPackage.id, variantId: products[0].variants[0].id } },
      update: { quantity: 2 },
      create: { id: 'demo-event-package-item', eventPackageId: eventPackage.id, variantId: products[0].variants[0].id, quantity: 2 },
    });
  }

  console.log('Demo operational data seeded: 10 customers, 10 parcel participants, 50 cashier orders, and supporting finance/stock data.');
}

seedDemoData()
  .catch((error) => {
    console.error('Demo data seed error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
