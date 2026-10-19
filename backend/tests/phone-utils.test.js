import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidIndonesianPhone, normalizeIndonesianPhone } from '../src/utils/phoneUtils.js';

test('normalizes common Indonesian mobile number formats', () => {
  assert.equal(normalizeIndonesianPhone('0812-3456-7890'), '6281234567890');
  assert.equal(normalizeIndonesianPhone('+62 812 3456 7890'), '6281234567890');
  assert.equal(normalizeIndonesianPhone('0062 812 3456 7890'), '6281234567890');
  assert.equal(normalizeIndonesianPhone('81234567890'), '6281234567890');
});

test('validates normalized Indonesian mobile numbers', () => {
  assert.equal(isValidIndonesianPhone('0812-3456-7890'), true);
  assert.equal(isValidIndonesianPhone('+62 812 3456 7890'), true);
  assert.equal(isValidIndonesianPhone('021-555-0123'), false);
  assert.equal(isValidIndonesianPhone('not a phone'), false);
});
