import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeCatalogCategories } from './catalogStorage.js';

test('mergeCatalogCategories keeps database categories and adds catalog-only categories', () => {
  const categories = [
    { id: 'db-parsel', name: 'Parsel', productCount: 0 },
    { id: 'db-test', name: 'Test', productCount: 2 },
  ];
  const products = [
    { category: 'Parsel' },
    { category: 'Paket Acara' },
  ];

  assert.deepEqual(mergeCatalogCategories(categories, products), [
    { id: 'db-parsel', name: 'Parsel', productCount: 0 },
    { id: 'db-test', name: 'Test', productCount: 2 },
    { id: 'cached-Paket Acara', name: 'Paket Acara', productCount: 1 },
  ]);
});

test('mergeCatalogCategories deduplicates names without replacing database metadata', () => {
  const categories = [{ id: 'db-parsel', name: 'Parsel', productCount: 3 }];
  const products = [{ category: ' parsel ' }];

  assert.deepEqual(mergeCatalogCategories(categories, products), categories);
});
