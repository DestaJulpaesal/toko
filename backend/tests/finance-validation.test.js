import test from 'node:test';
import assert from 'node:assert/strict';
import {
  financeBulkPasteConfirmSchema,
  financeBulkPastePreviewSchema,
  reconciliationSchema,
} from '../src/middleware/security.js';

test('cash reconciliation accepts a valid account and physical count', () => {
  assert.deepEqual(reconciliationSchema.parse({
    accountId: 'cash-account',
    physicalCount: '250000',
    note: 'Tutup kas',
  }), {
    accountId: 'cash-account',
    physicalCount: 250000,
    note: 'Tutup kas',
  });
});

test('cash reconciliation validation messages are clear Indonesian', () => {
  const missingAccount = reconciliationSchema.safeParse({ physicalCount: 1000 });
  const missingAmount = reconciliationSchema.safeParse({ accountId: 'cash-account' });
  const negativeAmount = reconciliationSchema.safeParse({ accountId: 'cash-account', physicalCount: -1 });

  assert.equal(missingAccount.error.issues[0].message, 'Pilih akun kas yang akan dihitung.');
  assert.equal(missingAmount.error.issues[0].message, 'Masukkan jumlah uang yang valid.');
  assert.equal(negativeAmount.error.issues[0].message, 'Jumlah uang tidak boleh kurang dari nol.');
});

test('bulk cash input validation messages are clear Indonesian', () => {
  const longText = financeBulkPastePreviewSchema.safeParse({ text: 'a'.repeat(50001) });
  const invalidDescription = financeBulkPasteConfirmSchema.safeParse({
    transactions: [{ amount: 1000, description: 'a'.repeat(501) }],
  });
  const tooManyTransactions = financeBulkPasteConfirmSchema.safeParse({
    transactions: Array.from({ length: 501 }, () => ({ amount: 1000, description: 'Catatan' })),
  });

  assert.equal(longText.error.issues[0].message, 'Teks transaksi maksimal 50.000 karakter.');
  assert.equal(invalidDescription.error.issues[0].message, 'Keterangan maksimal 500 karakter.');
  assert.equal(tooManyTransactions.error.issues[0].message, 'Maksimal 500 transaksi dapat disimpan sekaligus.');
});
