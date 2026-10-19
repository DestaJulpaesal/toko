import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultAppSettings,
  getAppSettings,
  invalidateAppSettingsCache,
  updateAppSettings,
} from '../src/services/appSettingService.js';

test('settings use safe defaults and cache database-backed overrides', async () => {
  invalidateAppSettingsCache();
  let reads = 0;
  const client = {
    appSetting: {
      findMany: async () => {
        reads += 1;
        return [{ key: 'delivery', value: { ...defaultAppSettings.delivery, ratePerKm: 7000 } }];
      },
    },
  };

  const first = await getAppSettings(client);
  const second = await getAppSettings(client);
  assert.equal(first.delivery.ratePerKm, 7000);
  assert.equal(first.cashierDiscount.maxPercent, 10);
  assert.deepEqual(second, first);
  assert.equal(reads, 1);
  invalidateAppSettingsCache();
});

test('public settings query only returns rows marked public', async () => {
  invalidateAppSettingsCache();
  let query;
  const client = {
    appSetting: {
      findMany: async (args) => {
        query = args;
        return [{ key: 'storeProfile', value: { name: 'Toko Contoh' } }];
      },
    },
  };

  assert.deepEqual(await getAppSettings(client, { publicOnly: true }), {
    storeProfile: { name: 'Toko Contoh' },
  });
  assert.deepEqual(query.where, { isPublic: true });
  invalidateAppSettingsCache();
});

test('setting updates are transactional and write an audit record', async () => {
  const calls = [];
  const transaction = {
    appSetting: {
      findUnique: async () => ({ value: { ratePerKm: 5000 } }),
      upsert: async ({ where, create, update }) => calls.push(['upsert', where, create, update]),
    },
    auditLog: {
      create: async ({ data }) => calls.push(['audit', data]),
    },
  };
  const client = {
    $transaction: async (callback) => callback(transaction),
  };

  const updated = await updateAppSettings(client, {
    settings: { delivery: { ratePerKm: 7000 } },
    changedById: 'owner-id',
  });

  assert.deepEqual(updated, { delivery: { ratePerKm: 7000 } });
  assert.equal(calls[0][0], 'upsert');
  assert.equal(calls[0][3].isPublic, true);
  assert.equal(calls[1][0], 'audit');
  assert.equal(calls[1][1].entityId, 'delivery');
  assert.equal(calls[1][1].changedById, 'owner-id');
});
