import { writeAuditLog } from './auditLogService.js';

function fail(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

function isSameLocalDay(first, second) {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

export async function reverseCompletedOrder(transaction, { orderId, actor, reason, action }) {
  const order = await transaction.order.findUnique({
    where: { id: orderId },
    include: { debtRecord: true },
  });
  if (!order) throw fail('Transaksi tidak ditemukan', 404);
  if (order.status !== 'COMPLETED') throw fail('Hanya transaksi selesai yang dapat dibatalkan atau direfund', 409);
  if (actor.role === 'CASHIER' && (order.userId !== actor.id || !isSameLocalDay(new Date(order.createdAt), new Date()))) {
    throw fail('Kasir hanya dapat membatalkan transaksi miliknya pada hari yang sama', 403);
  }
  const voidReason = `${action === 'REFUND' ? 'REFUND: ' : ''}${reason}`;
  const claimed = await transaction.order.updateMany({
    where: { id: order.id, status: 'COMPLETED' },
    data: { status: 'VOIDED', voidReason, voidedById: actor.id },
  });
  if (claimed.count !== 1) throw fail('Status transaksi berubah. Muat ulang lalu coba lagi.', 409);

  const movements = await transaction.stockMovement.findMany({
    where: { reference: order.orderNumber, type: 'OUT' },
  });
  for (const movement of movements) {
    if (movement.variantId) {
      await transaction.productVariant.update({
        where: { id: movement.variantId },
        data: { stockQty: { increment: movement.quantity } },
      });
    } else {
      await transaction.product.update({
        where: { id: movement.productId },
        data: { baseStockQty: { increment: movement.quantity } },
      });
    }
    await transaction.stockMovement.create({
      data: {
        productId: movement.productId,
        variantId: movement.variantId,
        type: 'RETURN',
        quantity: movement.quantity,
        note: `${action === 'REFUND' ? 'Refund' : 'Void'} transaksi: ${reason}`,
        reference: order.orderNumber,
        changedById: actor.id,
      },
    });
  }

  await transaction.financeTransaction.updateMany({
    where: { orderId: order.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (order.debtRecord && order.debtRecord.status === 'OPEN') {
    await transaction.debtRecord.update({
      where: { id: order.debtRecord.id },
      data: { status: 'CANCELLED' },
    });
  }

  let pointsRevoked = 0;
  const pointsRestored = Number(order.pointsRedeemed || 0);
  if (order.customerId && (Number(order.pointsAwarded || 0) > 0 || pointsRestored > 0)) {
    const customer = await transaction.customer.findUnique({ where: { id: order.customerId }, select: { points: true } });
    if (!customer) throw fail('Pelanggan transaksi tidak ditemukan', 409);
    const currentPoints = Number(customer.points || 0);
    pointsRevoked = Math.min(Number(order.pointsAwarded || 0), currentPoints);
    const pointsDelta = pointsRestored - pointsRevoked;
    const updatedPoints = await transaction.customer.updateMany({
      where: { id: order.customerId, points: currentPoints },
      data: { points: { increment: pointsDelta } },
    });
    if (updatedPoints.count !== 1) throw fail('Saldo poin berubah. Coba ulangi pembatalan.', 409);
  }

  const updated = { ...order, status: 'VOIDED', voidReason, voidedById: actor.id };
  await writeAuditLog({
    client: transaction,
    entityType: 'Order',
    entityId: updated.id,
    field: action,
    oldValue: { status: order.status, total: Number(order.total) },
    newValue: {
      status: updated.status,
      reason,
      amount: Number(order.total),
      pointsRevoked,
      pointsRestored,
    },
    changedById: actor.id,
  });
  return { ...updated, pointsRevoked, pointsRestored };
}
