import assert from 'node:assert/strict';
import test from 'node:test';
import { accountUpdateSchema, contactMessageSchema, inviteUserSchema } from '../src/middleware/security.js';

test('account invitations require a parcel region only for parcel managers', () => {
  assert.equal(inviteUserSchema.safeParse({
    name: 'Kasir Glosir',
    email: 'cashier@example.com',
    role: 'CASHIER',
  }).success, true);

  assert.equal(inviteUserSchema.safeParse({
    name: 'Manager Parsel',
    email: 'manager@example.com',
    role: 'PARCEL_MANAGER',
  }).success, false);

  assert.equal(inviteUserSchema.safeParse({
    name: 'Manager Parsel',
    email: 'manager@example.com',
    role: 'PARCEL_MANAGER',
    regionId: 'region-1',
  }).success, true);

  assert.equal(inviteUserSchema.safeParse({
    name: 'Kasir Glosir',
    email: 'cashier@example.com',
    role: 'CASHIER',
    regionId: 'region-1',
  }).success, false);
});

test('account updates cannot assign owner privileges and enforce strong reset passwords', () => {
  assert.equal(accountUpdateSchema.safeParse({ role: 'OWNER' }).success, false);
  assert.equal(accountUpdateSchema.safeParse({ password: '12345678' }).success, false);
  assert.equal(accountUpdateSchema.safeParse({ password: 'Toko-Aman-2026!' }).success, true);
  assert.equal(accountUpdateSchema.safeParse({ isActive: false }).success, true);
});

test('contact messages accept an omitted or blank WhatsApp number', () => {
  const requiredFields = { name: 'Pelanggan', message: 'Tolong cek pesanan saya.' };
  assert.deepEqual(contactMessageSchema.parse(requiredFields), { ...requiredFields, phone: '' });
  assert.deepEqual(contactMessageSchema.parse({ ...requiredFields, phone: '   ' }), { ...requiredFields, phone: '' });
  assert.equal(contactMessageSchema.safeParse({ ...requiredFields, phone: '123' }).success, false);
  assert.equal(contactMessageSchema.safeParse({ ...requiredFields, phone: '081234567890' }).success, true);
  assert.equal(contactMessageSchema.safeParse({ ...requiredFields, phone: 'x'.repeat(31) }).success, false);
});
