import assert from 'node:assert/strict';
import test from 'node:test';
import { reverseCompletedOrder } from '../src/services/orderReversalService.js';

function createReversalTransaction(status = 'COMPLETED', claimCount = 1) {
  const calls = [];
  const order = {
    id: 'order-test',
    orderNumber: 'POS-test',
    status,
    createdAt: new Date(),
    userId: 'cashier-test',
    customerId: 'customer-test',
    pointsAwarded: 10,
    pointsRedeemed: 5,
    total: 100,
    debtRecord: { id: 'debt-test', status: 'OPEN' },
  };
  const transaction = {
    order: {
      findUnique: async () => order,
      updateMany: async ({ data }) => {
        calls.push(['order.updateMany', data]);
        return { count: claimCount };
      },
    },
    stockMovement: {
      findMany: async () => [{
        productId: 'product-test',
        variantId: 'variant-test',
        quantity: 2,
      }],
      create: async ({ data }) => calls.push(['stockMovement.create', data]),
    },
    productVariant: {
      update: async ({ data }) => calls.push(['productVariant.update', data]),
    },
    product: { update: async ({ data }) => calls.push(['product.update', data]) },
    financeTransaction: { updateMany: async ({ data }) => calls.push(['finance.updateMany', data]) },
    debtRecord: { update: async ({ data }) => calls.push(['debt.update', data]) },
    customer: {
      findUnique: async () => ({ points: 20 }),
      updateMany: async ({ data }) => {
        calls.push(['customer.updateMany', data]);
        return { count: 1 };
      },
    },
    auditLog: { create: async ({ data }) => calls.push(['audit.create', data]) },
  };
  return { transaction, calls };
}

test('void reversal returns stock, closes debt, reverses awarded points and restores redeemed points', async () => {
  const { transaction, calls } = createReversalTransaction();
  const result = await reverseCompletedOrder(transaction, {
    orderId: 'order-test',
    actor: { id: 'owner-test', role: 'OWNER' },
    reason: 'Salah input',
    action: 'VOID',
  });

  assert.equal(result.status, 'VOIDED');
  assert.equal(result.pointsRevoked, 10);
  assert.equal(result.pointsRestored, 5);
  assert.deepEqual(calls.find(([name]) => name === 'customer.updateMany')[1].points, { increment: -5 });
  assert.ok(calls.some(([name, data]) => name === 'stockMovement.create' && data.type === 'RETURN'));
  assert.ok(calls.some(([name, data]) => name === 'debt.update' && data.status === 'CANCELLED'));
  assert.ok(calls.some(([name]) => name === 'audit.create'));
});

test('cashier may reverse only own transaction on the same local day', async () => {
  const { transaction } = createReversalTransaction();
  await assert.rejects(
    reverseCompletedOrder(transaction, {
      orderId: 'order-test',
      actor: { id: 'other-cashier', role: 'CASHIER' },
      reason: 'Salah input',
      action: 'VOID',
    }),
    { statusCode: 403 },
  );
});

test('non-completed orders cannot be reversed', async () => {
  const { transaction, calls } = createReversalTransaction('HOLD');
  await assert.rejects(
    reverseCompletedOrder(transaction, {
      orderId: 'order-test',
      actor: { id: 'owner-test', role: 'OWNER' },
      reason: 'Batal',
      action: 'VOID',
    }),
    { statusCode: 409 },
  );
  assert.deepEqual(calls, []);
});

test('concurrent reversal loses the status claim before touching inventory', async () => {
  const { transaction, calls } = createReversalTransaction('COMPLETED', 0);
  await assert.rejects(
    reverseCompletedOrder(transaction, {
      orderId: 'order-test',
      actor: { id: 'owner-test', role: 'OWNER' },
      reason: 'Salah input',
      action: 'VOID',
    }),
    { statusCode: 409 },
  );
  assert.equal(calls.some(([name]) => name === 'stockMovement.create'), false);
});
