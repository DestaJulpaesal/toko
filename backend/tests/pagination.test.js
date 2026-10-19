import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePagination } from '../src/utils/pagination.js';

test('pagination defaults to a bounded first page', () => {
  assert.deepEqual(parsePagination({}), { page: 1, pageSize: 50, skip: 0, take: 50 });
});

test('pagination clamps invalid and oversized parameters', () => {
  assert.deepEqual(parsePagination({ page: '-4', pageSize: '9999' }), {
    page: 1,
    pageSize: 200,
    skip: 0,
    take: 200,
  });
  assert.deepEqual(parsePagination({ page: '3', pageSize: '25' }), {
    page: 3,
    pageSize: 25,
    skip: 50,
    take: 25,
  });
});
