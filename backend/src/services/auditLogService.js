import prisma from '../config/db.js';

/**
 * Writes the canonical AuditLog record. Keep values serializable and avoid
 * storing credentials or other secrets in the audit trail.
 */
export async function writeAuditLog({
  entityType,
  entityId,
  field = 'record',
  oldValue = null,
  newValue = null,
  changedById,
  client = prisma,
}) {
  return client.auditLog.create({
    data: {
      entityType: String(entityType),
      entityId: String(entityId),
      field: String(field),
      oldValue: oldValue == null ? null : typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue),
      newValue: newValue == null ? null : typeof newValue === 'string' ? newValue : JSON.stringify(newValue),
      changedById,
    },
  });
}
