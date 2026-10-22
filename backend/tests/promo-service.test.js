import assert from 'node:assert/strict';
import test from 'node:test';
import { recordPromoUse, validatePromoCode } from '../src/services/promoService.js';

function promo(overrides = {}) {
  return {
    id: 'promo-test',
    code: 'HEMAT',
    isActive: true,
    startsAt: null,
    endsAt: null,
    minPurchase: 10000,
    maxDiscount: 5000,
    usageLimit: 3,
    usedCount: 1,
    discountType: 'PERCENT',
    discountValue: 20,
    ...overrides,
  };
}

test('promo validation computes a server-side discount and caps it', async () => {
  const result = await validatePromoCode({ promoCampaign: { findUnique: async () => promo() } }, ' hemat ', 50000);
  assert.equal(result.discountAmount, 5000);
});

test('scoped promo discounts only items matching a selected category or product', async () => {
  const scopedPromo = promo({ categoryIds: ['category-1'], productIds: ['product-2'], minPurchase: 5000, maxDiscount: null });
  const client = { promoCampaign: { findUnique: async () => scopedPromo } };
  const result = await validatePromoCode(client, 'HEMAT', 30000, [
    { categoryId: 'category-1', productId: 'product-1', total: 10000 },
    { categoryId: 'category-2', productId: 'product-2', total: 5000 },
    { categoryId: 'category-2', productId: 'product-3', total: 15000 },
  ]);
  assert.equal(result.discountAmount, 3000);
  await assert.rejects(
    validatePromoCode(client, 'HEMAT', 30000, [{ categoryId: 'category-2', productId: 'product-3', total: 30000 }]),
    /hanya berlaku/,
  );
});

test('promo validation rejects expired, exhausted and below-minimum codes', async () => {
  const findUnique = async () => promo({ endsAt: new Date(Date.now() - 1000) });
  await assert.rejects(validatePromoCode({ promoCampaign: { findUnique } }, 'HEMAT', 50000), /sudah berakhir/);
  await assert.rejects(
    validatePromoCode({ promoCampaign: { findUnique: async () => promo({ usedCount: 3 }) } }, 'HEMAT', 50000),
    /Kuota promo sudah habis/,
  );
  await assert.rejects(
    validatePromoCode({ promoCampaign: { findUnique: async () => promo() } }, 'HEMAT', 5000),
    /Minimal belanja/,
  );
});

test('promo usage updates atomically and rejects a concurrent exhausted quota', async () => {
  let input;
  await recordPromoUse({ promoCampaign: { updateMany: async (args) => { input = args; return { count: 1 }; } } }, promo());
  assert.equal(input.data.usedCount.increment, 1);
  await assert.rejects(
    recordPromoUse({ promoCampaign: { updateMany: async () => ({ count: 0 }) } }, promo()),
    /Promo baru saja tidak tersedia/,
  );
});
