import assert from 'node:assert/strict';
import test from 'node:test';
import { awardPoints, calculatePoints, checkSellBelowCost, getExpiringProducts, revokePoints } from '../src/services/loyaltyService.js';

function createCustomerStub(initialPoints) {
  const customer = { id: 'customer-test', points: initialPoints };
  return {
    customer: {
      update: async ({ data }) => {
        if (data.points.increment !== undefined) customer.points += data.points.increment;
        if (data.points.decrement !== undefined) customer.points -= data.points.decrement;
        return { ...customer };
      },
      findUnique: async () => ({ ...customer }),
    },
    current: () => ({ ...customer }),
  };
}

test('loyalty rules calculate points from the configured threshold and rate', () => {
  const rule = { pointsPerRp100k: 10, minTransactionAmount: 100000 };
  assert.equal(calculatePoints(99999, rule), 0);
  assert.equal(calculatePoints(100000, rule), 10);
  assert.equal(calculatePoints(250000, rule), 20);
});

test('awardPoints and revokePoints mutate the supplied transaction client only', async () => {
  const client = createCustomerStub(500);
  assert.equal((await awardPoints('customer-test', 100, 'order-test', client)).points, 600);
  assert.equal((await revokePoints('customer-test', 100, 'order-test', client)).points, 500);
  assert.equal(client.current().points, 500);
});

test('revokePoints never makes a customer balance negative', async () => {
  const client = createCustomerStub(50);
  assert.equal((await revokePoints('customer-test', 500, 'order-test', client)).points, 0);
});

test('sell-below-cost detection reports only loss items', () => {
  const losses = checkSellBelowCost([
    { name: 'Rugi', unitPrice: 12000, basePrice: 15000 },
    { name: 'Untung', unitPrice: 15000, basePrice: 12000 },
    { name: 'Impas', unitPrice: 10000, basePrice: 10000 },
  ]);
  assert.deepEqual(losses.map(({ name, loss }) => ({ name, loss })), [{ name: 'Rugi', loss: 3000 }]);
});

test('expiring product lookup works with a stubbed client and performs no database writes', async () => {
  const expiryDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const client = {
    productUnit: {
      findMany: async () => [{
        id: 'unit-test',
        name: 'Unit Test',
        expiryDate,
        product: { id: 'product-test', name: 'Produk Test', sku: 'TEST' },
      }],
    },
  };
  const expiring = await getExpiringProducts(30, client);
  assert.equal(expiring[0].unitId, 'unit-test');
  assert.equal(expiring[0].urgency, 'WARNING');
});
