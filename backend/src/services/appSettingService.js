import { randomUUID } from 'node:crypto';
import prisma from '../config/db.js';
import { writeAuditLog } from './auditLogService.js';

const CACHE_TTL_MS = 60_000;
let cache = { settingsExpiresAt: 0, publicExpiresAt: 0, settings: null, publicSettings: null };

export const defaultAppSettings = {
  storeProfile: {
    name: 'Glosir',
    phone: '',
    address: '',
    openingHours: '',
  },
  delivery: {
    enabled: true,
    freeDistanceKm: 1,
    ratePerKm: 5000,
    minimumSubtotal: 0,
  },
  checkout: {
    paymentMethods: ['CASH', 'QRIS', 'TRANSFER', 'DEBT'],
  },
  cashierDiscount: {
    maxPercent: 10,
    maxAmount: 50000,
  },
  inventory: {
    lowStockThreshold: 5,
    expiryWarningDays: 30,
  },
};

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

export function invalidateAppSettingsCache() {
  cache = { settingsExpiresAt: 0, publicExpiresAt: 0, settings: null, publicSettings: null };
}

export async function getAppSettings(client = prisma, { publicOnly = false } = {}) {
  const cached = publicOnly ? cache.publicSettings : cache.settings;
  const expiresAt = publicOnly ? cache.publicExpiresAt : cache.settingsExpiresAt;
  if (cached && expiresAt > Date.now()) return copy(cached);

  const rows = await client.appSetting.findMany({
    where: publicOnly ? { isPublic: true } : undefined,
    select: { key: true, value: true },
  });
  const settings = publicOnly ? {} : copy(defaultAppSettings);
  for (const row of rows) settings[row.key] = row.value;

  cache = {
    ...cache,
    ...(publicOnly
      ? { publicExpiresAt: Date.now() + CACHE_TTL_MS, publicSettings: copy(settings) }
      : { settingsExpiresAt: Date.now() + CACHE_TTL_MS, settings: copy(settings) }),
  };
  return settings;
}

export async function updateAppSettings(client, { settings, changedById }) {
  return client.$transaction(async (transaction) => {
    const updated = {};
    for (const [key, value] of Object.entries(settings)) {
      const previous = await transaction.appSetting.findUnique({ where: { key }, select: { value: true } });
      const isPublic = ['storeProfile', 'delivery'].includes(key);
      await transaction.appSetting.upsert({
        where: { key },
        create: { id: randomUUID(), key, value, isPublic, updatedById: changedById },
        update: { value, isPublic, updatedById: changedById },
      });
      await writeAuditLog({
        client: transaction,
        entityType: 'AppSetting',
        entityId: key,
        field: key,
        oldValue: previous?.value ?? null,
        newValue: value,
        changedById,
      });
      updated[key] = value;
    }
    return updated;
  });
}
