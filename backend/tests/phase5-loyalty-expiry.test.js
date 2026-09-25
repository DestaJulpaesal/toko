import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/config/db.js';
import { calculatePoints, awardPoints, revokePoints, checkSellBelowCost, getExpiringProducts } from '../src/services/loyaltyService.js';

describe('FASE 5: Loyalty Points, Expiry, and Sell-Below-Cost Tests', () => {
  let testCustomer;
  let testProduct;
  let testUnit;

  beforeAll(async () => {
    // Setup test customer
    testCustomer = await prisma.customer.create({
      data: {
        name: 'Test Customer Loyalty',
        points: 500,
      },
    });

    // Setup test product with unit
    testProduct = await prisma.product.create({
      data: {
        name: 'Produk Test FASE 5',
        sku: `TEST-F5-${Date.now()}`,
        slug: `test-f5-${Date.now()}`,
        category: { connectOrCreate: { where: { slug: 'test' }, create: { name: 'Test', slug: 'test' } } },
      },
    });

    testUnit = await prisma.productUnit.create({
      data: {
        productId: testProduct.id,
        name: 'Bungkus',
        sku: `UNIT-F5-${Date.now()}`,
        basePrice: 15000, // Modal 15.000
        sellPrice: 18000, // Jual 18.000
        conversionToBase: 1,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    if (testUnit) await prisma.productUnit.delete({ where: { id: testUnit.id } });
    if (testProduct) await prisma.product.delete({ where: { id: testProduct.id } });
    if (testCustomer) await prisma.customer.delete({ where: { id: testCustomer.id } });
  });

  // ────────────────────────────────────────────
  // TEST 1: Batas Rp100.000 untuk Poin Loyalitas
  // ────────────────────────────────────────────
  describe('Loyalty Points Calculation', () => {
    const defaultRule = {
      pointsPerRp100k: 100,
      minTransactionAmount: 100000,
    };

    it('harus dapat 0 poin jika belanja di bawah Rp100.000 (contoh: Rp50.000)', () => {
      const points = calculatePoints(50000, defaultRule);
      expect(points).toBe(0);
    });

    it('harus dapat 100 poin jika belanja tepat Rp100.000', () => {
      const points = calculatePoints(100000, defaultRule);
      expect(points).toBe(100);
    });

    it('harus dapat 100 poin jika belanja Rp150.000 (kelipatan 100rb)', () => {
      const points = calculatePoints(150000, defaultRule);
      expect(points).toBe(100);
    });

    it('harus dapat 200 poin jika belanja Rp250.000', () => {
      const points = calculatePoints(250000, defaultRule);
      expect(points).toBe(200);
    });
  });

  // ────────────────────────────────────────────
  // TEST 2: Award & Revoke Points (Void)
  // ────────────────────────────────────────────
  describe('Award & Revoke Points', () => {
    it('harus menambah poin customer saat awardPoints dipanggil', async () => {
      const initialPoints = testCustomer.points;
      const updated = await awardPoints(testCustomer.id, 100, 'TEST-ORDER-1');

      expect(updated.points).toBe(initialPoints + 100);
      testCustomer.points = updated.points; // Update local state
    });

    it('harus mengembalikan (mengurangi) poin customer saat void order', async () => {
      const initialPoints = testCustomer.points;
      const updated = await revokePoints(testCustomer.id, 100, 'TEST-ORDER-1');

      expect(updated.points).toBe(initialPoints - 100);
      testCustomer.points = updated.points;
    });

    it('tidak boleh membuat poin customer menjadi minus saat void melebihi saldo', async () => {
      const currentPoints = testCustomer.points;
      const updated = await revokePoints(testCustomer.id, currentPoints + 999, 'TEST-ORDER-2');

      expect(updated.points).toBe(0); // Harus tetep 0, tidak minus
    });
  });

  // ────────────────────────────────────────────
  // TEST 3: Peringatan Jual Rugi
  // ────────────────────────────────────────────
  describe('Sell Below Cost Detection', () => {
    it('harus mendeteksi barang yang dijual di bawah harga modal', () => {
      const items = [
        { name: 'Rokok A', unitPrice: 12000, basePrice: 15000 }, // Rugi 3000
        { name: 'Beras B', unitPrice: 15000, basePrice: 12000 }, // Untung 3000
        { name: 'Minyak C', unitPrice: 10000, basePrice: 10000 }, // Pas
      ];

      const lossItems = checkSellBelowCost(items);

      expect(lossItems).toHaveLength(1);
      expect(lossItems[0].name).toBe('Rokok A');
      expect(lossItems[0].loss).toBe(3000);
    });

    it('harus return array kosong jika semua barang untung/pas', () => {
      const items = [
        { name: 'Beras B', unitPrice: 15000, basePrice: 12000 },
        { name: 'Minyak C', unitPrice: 10000, basePrice: 10000 },
      ];

      const lossItems = checkSellBelowCost(items);
      expect(lossItems).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────
  // TEST 4: Query Kadaluarsa
  // ────────────────────────────────────────────
  describe('Expiring Products Query', () => {
    let expiredUnit;

    beforeAll(async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10); // H-10

      expiredUnit = await prisma.productUnit.create({
        data: {
          productId: testProduct.id,
          name: 'Expired Test Unit',
          sku: `EXP-F5-${Date.now()}`,
          basePrice: 10000,
          sellPrice: 12000,
          conversionToBase: 1,
          expiryDate: futureDate,
        },
      });
    });

    afterAll(async () => {
      if (expiredUnit) await prisma.productUnit.delete({ where: { id: expiredUnit.id } });
    });

    it('harus bisa menemukan produk yang akan kadaluarsa dalam 30 hari', async () => {
      const expiring = await getExpiringProducts(30);
      const found = expiring.find((p) => p.unitId === expiredUnit.id);

      expect(found).toBeDefined();
      expect(found.daysLeft).toBeLessThanOrEqual(10);
      expect(found.urgency).toBe('WARNING');
    });
  });
});
