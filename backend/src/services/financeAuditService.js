import prisma from '../config/db.js';

export async function logFinanceAudit(entityType, entityId, action, before = null, after = null, userId = null, client = prisma) {
  const [financeLog] = await Promise.all([
    client.financeAuditLog.create({
      data: { entityType, entityId, action, before: before || undefined, after: after || undefined, userId: userId || null },
    }),
    client.auditLog.create({
      data: {
        entityType,
        entityId,
        field: action,
        oldValue: before == null ? null : JSON.stringify(before),
        newValue: after == null ? null : JSON.stringify(after),
        changedById: userId,
      },
    }),
  ]);
  return financeLog;
}
