import prisma from '../config/db.js';

export async function logFinanceAudit(entityType, entityId, action, before = null, after = null, userId = null, client = prisma) {
  return client.financeAuditLog.create({
    data: { entityType, entityId, action, before: before || undefined, after: after || undefined, userId: userId || null },
  });
}

