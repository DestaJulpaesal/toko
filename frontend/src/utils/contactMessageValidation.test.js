import assert from 'node:assert/strict';
import test from 'node:test';
import { validateContactMessage } from './contactMessageValidation.js';

test('requires a name and a message with Indonesian validation guidance', () => {
  assert.deepEqual(validateContactMessage({ name: ' ', phone: '', message: '' }), {
    name: 'Nama wajib diisi.',
    message: 'Pesan wajib diisi.',
  });
});

test('validates trimmed minimum lengths and maximum name length', () => {
  assert.deepEqual(validateContactMessage({ name: 'A', phone: '', message: 'Ok' }), {
    name: 'Nama minimal 2 karakter.',
    message: 'Pesan minimal 3 karakter.',
  });
  assert.equal(validateContactMessage({ name: 'n'.repeat(101), phone: '', message: 'Hai' }).name, 'Nama maksimal 100 karakter.');
});

test('allows an empty WhatsApp number but validates a provided Indonesian mobile number', () => {
  assert.deepEqual(validateContactMessage({ name: 'Udin', phone: '', message: 'Halo' }), {});
  assert.equal(
    validateContactMessage({ name: 'Udin', phone: '021-555-0123', message: 'Halo' }).phone,
    'Masukkan nomor WhatsApp Indonesia yang valid, misalnya 0812 3456 7890.',
  );
  assert.deepEqual(validateContactMessage({ name: 'Udin', phone: '+62 812-3456-7890', message: 'Halo' }), {});
});

test('enforces phone and message maximum lengths', () => {
  const errors = validateContactMessage({
    name: 'Udin',
    phone: '0'.repeat(31),
    message: 'x'.repeat(2001),
  });
  assert.equal(errors.phone, 'Nomor WhatsApp maksimal 30 karakter.');
  assert.equal(errors.message, 'Pesan maksimal 2.000 karakter.');
});
