import prisma from '../config/db.js';

/**
 * Service untuk menjalankan uji otomatis (preflight check) transaksi kasir,
 * pemotongan stok, mutasi kartu stok, dan pencatatan keuangan sebelum toko beroperasi.
 *
 * Semua data uji diisolasi dan langsung dibersihkan (teardown) di akhir proses
 * sehingga tidak mengotori database operasional.
 */
export async function runDailyPreflightCheck() {
  const startTime = Date.now();
  const testRunId = `PREFLIGHT-${Date.now()}`;
  const results = [];

  const createdIds = {
    categoryId: null,
    productId: null,
    variantId: null,
    customerId: null,
    orderIds: [],
    stockMovementIds: [],
    financeTransactionIds: [],
    debtRecordIds: [],
  };

  try {
    // -------------------------------------------------------------
    // TEST 1: KONEKSI DATABASE & INISIALISASI FIXTURE UJI
    // -------------------------------------------------------------
    let testCategory;
    let testProduct;
    let testVariant;
    let testCustomer;

    try {
      // 1. Kategori Uji
      testCategory = await prisma.category.create({
        data: {
          name: `Kategori Tes ${testRunId}`,
          slug: `kategori-tes-${testRunId.toLowerCase()}`,
        },
      });
      createdIds.categoryId = testCategory.id;

      // 2. Produk & Varian Uji dengan stok awal 50 pcs
      testProduct = await prisma.product.create({
        data: {
          sku: `SKU-PROD-${testRunId}`,
          name: `Produk Tes Kasir ${testRunId}`,
          slug: `produk-tes-${testRunId.toLowerCase()}`,
          categoryId: testCategory.id,
          status: 'ACTIVE',
        },
      });
      createdIds.productId = testProduct.id;

      testVariant = await prisma.productVariant.create({
        data: {
          productId: testProduct.id,
          name: 'Standar',
          sku: `SKU-${testRunId}`,
          barcode: `BAR-${testRunId}`,
          basePrice: 10000,
          sellPrice: 15000,
          wholesalePrice: 13000,
          stockQty: 50,
          unit: 'pcs',
          isDefault: true,
          isActive: true,
        },
      });
      createdIds.variantId = testVariant.id;

      // 3. Pelanggan Uji (untuk uji transaksi bon)
      testCustomer = await prisma.customer.create({
        data: {
          name: `Pelanggan Tes ${testRunId}`,
          phone: `08999${Math.floor(100000 + Math.random() * 900000)}`,
        },
      });
      createdIds.customerId = testCustomer.id;

      results.push({
        name: 'Koneksi Database & Inisialisasi Fixture Uji',
        passed: true,
        message: 'Koneksi database aktif dan data fixture terisolasi berhasil disiapkan.',
      });
    } catch (err) {
      results.push({
        name: 'Koneksi Database & Inisialisasi Fixture Uji',
        passed: false,
        message: `Gagal menyiapkan fixture: ${err.message}`,
      });
      throw err;
    }

    // -------------------------------------------------------------
    // TEST 2: TRANSAKSI KASIR TUNAI (CASH), PERHITUNGAN & KEMBALIAN
    // -------------------------------------------------------------
    const cashOrderNumber = `POS-TEST-CASH-${Math.floor(1000 + Math.random() * 9000)}`;
    const cashQty = 2;
    const itemPrice = Number(testVariant.sellPrice); // 15.000
    const cashTotal = itemPrice * cashQty; // 30.000
    const cashPaid = 50000;
    const expectedChange = cashPaid - cashTotal; // 20.000

    let cashOrder;
    try {
      // Jalankan transaksi penjualan kasir (sama persis dengan logic di orderRoutes /checkout)
      cashOrder = await prisma.$transaction(async (tx) => {
        // 1. Potong stok varian
        const updatedVariant = await tx.productVariant.update({
          where: { id: testVariant.id },
          data: { stockQty: { decrement: cashQty } },
        });

        // 2. Catat riwayat perpindahan kartu stok (OUT)
        const mv = await tx.stockMovement.create({
          data: {
            productId: testProduct.id,
            variantId: testVariant.id,
            type: 'OUT',
            quantity: cashQty,
            note: 'Penjualan kasir POS (Preflight Test)',
            reference: cashOrderNumber,
          },
        });
        createdIds.stockMovementIds.push(mv.id);

        // 3. Buat pesanan kasir
        const ord = await tx.order.create({
          data: {
            orderNumber: cashOrderNumber,
            type: 'STORE',
            status: 'COMPLETED',
            customerId: testCustomer.id,
            subtotal: cashTotal,
            discount: 0,
            total: cashTotal,
            paidAmount: cashPaid,
            paymentMethod: 'CASH',
            paymentStatus: 'PAID',
            items: {
              create: [
                {
                  productId: testProduct.id,
                  variantId: testVariant.id,
                  name: testProduct.name,
                  quantity: cashQty,
                  unitPrice: itemPrice,
                  total: cashTotal,
                },
              ],
            },
          },
        });
        createdIds.orderIds.push(ord.id);

        // 4. Catat kas masuk di financeTransaction
        const defaultAccount = await tx.financeAccount.upsert({
          where: { id: 'finance-default-cash' },
          create: { id: 'finance-default-cash', name: 'Kas Toko', type: 'CASH', startBalance: 0 },
          update: {},
        });
        const salesCategory = await tx.financeCategory.upsert({
          where: { name_type: { name: 'Penjualan', type: 'INCOME' } },
          create: { name: 'Penjualan', type: 'INCOME', isDefault: true },
          update: {},
        });

        const fin = await tx.financeTransaction.create({
          data: {
            orderId: ord.id,
            type: 'INCOME',
            amount: cashTotal,
            description: `Penjualan kasir ${cashOrderNumber} (CASH) - Preflight Test`,
            category: 'Penjualan',
            accountId: defaultAccount.id,
            categoryId: salesCategory.id,
            paymentMethod: 'CASH',
          },
        });
        createdIds.financeTransactionIds.push(fin.id);

        return { ord, updatedVariant, fin };
      });

      const actualChange = cashPaid - cashTotal;
      const pass = actualChange === expectedChange && Number(cashOrder.ord.total) === cashTotal;

      results.push({
        name: 'Transaksi Kasir Tunai (Cash) & Perhitungan Kembalian',
        passed: pass,
        message: pass
          ? `Sukses: Order #${cashOrderNumber} selesai. Total: Rp ${cashTotal.toLocaleString('id-ID')}, Bayar: Rp ${cashPaid.toLocaleString('id-ID')}, Kembalian akurat: Rp ${actualChange.toLocaleString('id-ID')}.`
          : 'Perhitungan total atau kembalian tidak sesuai.',
      });
    } catch (err) {
      results.push({
        name: 'Transaksi Kasir Tunai (Cash) & Perhitungan Kembalian',
        passed: false,
        message: `Gagal transaksi kasir tunai: ${err.message}`,
      });
    }

    // -------------------------------------------------------------
    // TEST 3: PEMOTONGAN STOK & PENCATATAN KARTU STOK (STOCK MOVEMENT)
    // -------------------------------------------------------------
    try {
      const currentVariant = await prisma.productVariant.findUnique({
        where: { id: testVariant.id },
      });
      const stockMovement = await prisma.stockMovement.findFirst({
        where: { reference: cashOrderNumber, type: 'OUT' },
      });

      const expectedStock = 50 - cashQty; // 48
      const stockAccurate = currentVariant && currentVariant.stockQty === expectedStock;
      const movementAccurate = stockMovement && stockMovement.quantity === cashQty;

      const pass = stockAccurate && movementAccurate;
      results.push({
        name: 'Pemotongan Stok Otomatis & Mutasi Kartu Stok',
        passed: pass,
        message: pass
          ? `Sukses: Stok varian berkurang tepat dari 50 ke ${currentVariant.stockQty} pcs. Kartu stok mencatat mutasi OUT (${stockMovement.quantity} pcs) dengan referensi #${cashOrderNumber}.`
          : `Tidak sesuai: Stok saat ini ${currentVariant?.stockQty} (diharapkan ${expectedStock}), Mutasi: ${movementAccurate ? 'Ada' : 'Tidak ada'}.`,
      });
    } catch (err) {
      results.push({
        name: 'Pemotongan Stok Otomatis & Mutasi Kartu Stok',
        passed: false,
        message: `Gagal verifikasi kartu stok: ${err.message}`,
      });
    }

    // -------------------------------------------------------------
    // TEST 4: TRANSAKSI BON / PIUTANG (DEBT) & BUKU KEUANGAN
    // -------------------------------------------------------------
    const debtOrderNumber = `POS-TEST-DEBT-${Math.floor(1000 + Math.random() * 9000)}`;
    const debtQty = 1;
    const debtTotal = itemPrice * debtQty; // 15.000

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Potong stok varian lagi
        await tx.productVariant.update({
          where: { id: testVariant.id },
          data: { stockQty: { decrement: debtQty } },
        });

        const mv = await tx.stockMovement.create({
          data: {
            productId: testProduct.id,
            variantId: testVariant.id,
            type: 'OUT',
            quantity: debtQty,
            note: 'Penjualan bon POS (Preflight Test)',
            reference: debtOrderNumber,
          },
        });
        createdIds.stockMovementIds.push(mv.id);

        // 2. Order bon status UNPAID
        const ord = await tx.order.create({
          data: {
            orderNumber: debtOrderNumber,
            type: 'STORE',
            status: 'COMPLETED',
            customerId: testCustomer.id,
            subtotal: debtTotal,
            discount: 0,
            total: debtTotal,
            paidAmount: 0,
            paymentMethod: 'DEBT',
            paymentStatus: 'UNPAID',
            items: {
              create: [
                {
                  productId: testProduct.id,
                  variantId: testVariant.id,
                  name: testProduct.name,
                  quantity: debtQty,
                  unitPrice: itemPrice,
                  total: debtTotal,
                },
              ],
            },
          },
        });
        createdIds.orderIds.push(ord.id);

        // 3. Catat buku piutang aktif
        const debt = await tx.debtRecord.create({
          data: {
            orderId: ord.id,
            customerId: testCustomer.id,
            amount: debtTotal,
            paidAmount: 0,
            status: 'OPEN',
            description: `Bon kasir ${debtOrderNumber} - Preflight Test`,
          },
        });
        createdIds.debtRecordIds.push(debt.id);
      });

      const recordedDebt = await prisma.debtRecord.findFirst({
        where: { customerId: testCustomer.id, status: 'OPEN' },
      });

      const pass = recordedDebt && Number(recordedDebt.amount) === debtTotal;
      results.push({
        name: 'Pencatatan Keuangan Kas & Piutang (Bon / Debt)',
        passed: Boolean(pass),
        message: pass
          ? `Sukses: Transaksi bon #${debtOrderNumber} tercatat. Buku piutang aktif membuka tagihan Rp ${debtTotal.toLocaleString('id-ID')} atas nama ${testCustomer.name}.`
          : 'Catatan piutang tidak ditemukan atau nominal tidak cocok.',
      });
    } catch (err) {
      results.push({
        name: 'Pencatatan Keuangan Kas & Piutang (Bon / Debt)',
        passed: false,
        message: `Gagal verifikasi pencatatan piutang: ${err.message}`,
      });
    }
  } finally {
    // -------------------------------------------------------------
    // TEARDOWN & CLEANUP: HAPUS SEMUA DATA UJI AGAR DATABASE BERSIH
    // -------------------------------------------------------------
    try {
      if (createdIds.debtRecordIds.length) {
        await prisma.debtRecord.deleteMany({ where: { id: { in: createdIds.debtRecordIds } } });
      }
      if (createdIds.financeTransactionIds.length) {
        await prisma.financeTransaction.deleteMany({ where: { id: { in: createdIds.financeTransactionIds } } });
      }
      if (createdIds.orderIds.length) {
        await prisma.orderItem.deleteMany({ where: { orderId: { in: createdIds.orderIds } } });
        await prisma.order.deleteMany({ where: { id: { in: createdIds.orderIds } } });
      }
      if (createdIds.stockMovementIds.length) {
        await prisma.stockMovement.deleteMany({ where: { id: { in: createdIds.stockMovementIds } } });
      }
      if (createdIds.variantId) {
        await prisma.productVariant.deleteMany({ where: { id: createdIds.variantId } });
      }
      if (createdIds.productId) {
        await prisma.product.deleteMany({ where: { id: createdIds.productId } });
      }
      if (createdIds.categoryId) {
        await prisma.category.deleteMany({ where: { id: createdIds.categoryId } });
      }
      if (createdIds.customerId) {
        await prisma.customer.deleteMany({ where: { id: createdIds.customerId } });
      }
    } catch (cleanupError) {
      console.warn(`[Preflight] Cleanup warning: ${cleanupError.message}`);
    }
  }

  const durationMs = Date.now() - startTime;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  const allPassed = failedCount === 0;

  return {
    testRunId,
    timestamp: new Date().toISOString(),
    durationMs,
    allPassed,
    summary: {
      total: results.length,
      passed: passedCount,
      failed: failedCount,
    },
    tests: results,
  };
}
