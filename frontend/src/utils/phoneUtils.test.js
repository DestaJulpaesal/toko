import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidIndonesianPhone, normalizeIndonesianPhone } from './phoneUtils.js';

test('normalizes Indonesian phone number variants', () => {
  assert.equal(normalizeIndonesianPhone('0812-3456-7890'), '6281234567890');
  assert.equal(normalizeIndonesianPhone('+62 812 3456 7890'), '6281234567890');
  assert.equal(normalizeIndonesianPhone('0062 812 3456 7890'), '6281234567890');
  assert.equal(normalizeIndonesianPhone('81234567890'), '6281234567890');
});

test('validates Indonesian mobile numbers', () => {
  assert.equal(isValidIndonesianPhone('0812-3456-7890'), true);
  assert.equal(isValidIndonesianPhone('+62 812 3456 7890'), true);
  assert.equal(isValidIndonesianPhone('021-555-0123'), false);
  assert.equal(isValidIndonesianPhone('invalid'), false);
});
