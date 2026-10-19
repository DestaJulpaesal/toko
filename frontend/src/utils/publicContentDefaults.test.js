import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PUBLIC_CATEGORIES,
  publicCategoriesOrDefault,
  publicInfoOrDefault,
  sortPublicCategories,
} from './publicContentDefaults.js';

test('public database content takes precedence over frontend defaults', () => {
  const databaseCategories = [{ id: 'db-category', name: 'Sayuran' }];
  const databaseInfo = [{ id: 'db-faq', type: 'FAQ', title: 'FAQ terbaru', content: 'Isi terbaru' }];

  assert.equal(publicCategoriesOrDefault(databaseCategories), databaseCategories);
  assert.equal(publicInfoOrDefault('FAQ', databaseInfo), databaseInfo);
});

test('frontend defaults are available when public database content is empty', () => {
  assert.equal(publicCategoriesOrDefault([]), DEFAULT_PUBLIC_CATEGORIES);
  assert.equal(publicInfoOrDefault('FAQ', []).length, 1);
  assert.equal(publicInfoOrDefault('UNKNOWN', []).length, 0);
});

test('public category ordering is shared and deterministic across public pages', () => {
  const categories = [
    { name: 'Parsel' },
    { name: 'Kebutuhan Dapur' },
    { name: 'Acara' },
    { name: 'Glosir' },
    { name: 'Kategori Baru' },
  ];

  assert.deepEqual(sortPublicCategories(categories).map(({ name }) => name), [
    'Glosir',
    'Kebutuhan Dapur',
    'Acara',
    'Parsel',
    'Kategori Baru',
  ]);
});
