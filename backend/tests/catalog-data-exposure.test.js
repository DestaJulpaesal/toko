// Tes: data internal (harga modal, dll.) TIDAK boleh bocor ke pengunjung publik.
// Jalankan: npm run test:catalog   (tidak butuh database, memakai data palsu)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createAuth } from '../src/middleware/auth.js';
import { createSessionService } from '../src/services/sessionService.js';
import { createCatalogHandlers } from '../src/services/catalogHandlers.js';
import { createHomepageHandler } from '../src/services/homepageHandler.js';
import {
  AUDIENCE,
  PUBLIC_FORBIDDEN_KEYS,
  findForbiddenKeys,
  formatProduct,
  getAudience,
  parcelListWhere,
} from '../src/services/catalogSerializers.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'rahasia-khusus-tes';
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- Data palsu berbentuk seperti hasil Prisma (lengkap dengan kolom sensitif) ----------
const category = { id: 'c1', name: 'Makanan & Minuman Lain' };
const makeProduct = (overrides = {}, variantOverrides = {}) => ({
  id: 'p-aktif',
  name: 'Le Mineral 1,5 ML',
  sku: 'SKU-LEMINERAL',
  status: 'ACTIVE',
  description: 'Air mineral untuk kebutuhan sehari-hari.',
  stockWarning: 5,
  isQuickAccess: true,
  isFeatured: false,
  isParcel: false,
  originalPrice: null,
  imageUrl: null,
  category,
  variants: [{
    id: 'v-aktif', name: 'Botol', sku: 'SKU-LEMINERAL', barcode: '8996001600399',
    sellPrice: '6000', basePrice: '4500', wholesalePrice: '5000', stockQty: 12, isDefault: true, isActive: true,
    ...variantOverrides,
  }],
  units: [{
    id: 'u-aktif', name: 'Dus', sku: 'SKU-LEMINERAL-DUS', barcode: null,
    basePrice: '50000', sellPrice: '65000', wholesalePrice: '60000', conversionToBase: '12',
    isSellable: true, isDefault: true, isActive: true,
  }],
  ...overrides,
});
const products = [
  makeProduct(),
  makeProduct({ id: 'p-draft', name: 'Produk Draft', status: 'DRAFT' }, { id: 'v-draft' }),
  // Dijual di bawah modal: modal (7000) > harga jual (6000). Dulu angka 7000 bocor sebagai "harga coret".
  makeProduct({ id: 'p-rugi', name: 'Produk Rugi' }, { id: 'v-rugi', basePrice: '7000', sellPrice: '6000' }),
];
const eventPackages = [{
  id: 'e1', name: 'Paket Arisan', slug: 'paket-arisan', description: null, imageUrl: null,
  price: '150000', isManualPrice: false, isCustom: false, isActive: true, createdAt: new Date(), updatedAt: new Date(),
  items: [{
    id: 'ei1', eventPackageId: 'e1', variantId: 'v-aktif', quantity: 2,
    // Bentuk hasil `include: { variant: { include: { product: true } } }`: SEMUA kolom ikut terbaca dari database.
    variant: { ...products[0].variants[0], productId: 'p-aktif', product: { ...products[0], stockWarning: 5 } },
  }],
}];

const fakeDb = {
  product: {
    async findMany({ where, include }) {
      const status = where?.status;
      const result = status === 'ACTIVE'
        ? products.filter((p) => p.status === 'ACTIVE')
        : status?.not
          ? products.filter((p) => p.status !== status.not)
          : products;
      return result.map((product) => include?.units ? product : { ...product, units: undefined });
    },
    async findUnique({ where, include }) {
      const product = products.find((p) => p.id === where.id);
      return product ? (include?.units ? product : { ...product, units: undefined }) : null;
    },
  },
  eventPackage: {
    async findMany() { return eventPackages.filter((e) => e.isActive); },
    async findFirst({ where }) {
      return eventPackages.find((e) => e.isActive && where.OR.some((c) => c.id === e.id || c.slug === e.slug)) ?? null;
    },
  },
};

// ---------- Server kecil untuk tes (memakai handler asli, database palsu) ----------
// Sesi juga dipalsukan: user-<ROLE> adalah akun aktif dengan role tersebut (tanpa menyentuh database asli).
const fakeSessions = createSessionService({
  loadUser: async (id) => (id.startsWith('user-')
    ? { id, name: id, email: `${id}@tes.local`, role: id.replace('user-', ''), isActive: true, regionId: null, tokenVersion: 0 }
    : null),
});
const { softAuth } = createAuth(fakeSessions);
const handlers = createCatalogHandlers(fakeDb);
let homepageQueryCount = 0;
const app = express();
app.get('/products', softAuth, handlers.listProducts);
app.get('/products/:id', softAuth, handlers.getProduct);
app.get('/event-packages', handlers.listEventPackages);
app.get('/event-packages/:id', handlers.getEventPackage);
app.get('/homepage', createHomepageHandler({
  category: {
    async findMany() {
      homepageQueryCount += 1;
      return [{ id: 'c-home', name: 'Sembako', imageUrl: 'https://example.test/sembako.webp', _count: { products: 1 } }];
    },
  },
  promoCampaign: {
    async findMany() {
      homepageQueryCount += 1;
      return [{ id: 'promo-home', name: 'Promo Hemat', discountType: 'PERCENT', discountValue: '10', isActive: true }];
    },
  },
  product: {
    async findMany(options) {
      homepageQueryCount += 1;
      assert.equal(options.select.originalPrice, undefined);
      assert.equal(options.select.variants.select.basePrice, undefined);
      return [{
        id: 'p-home',
        name: 'Beras',
        imageUrl: null,
        isFlashSale: true,
        isBestseller: true,
        isRecommended: false,
        category: { name: 'Sembako' },
        variants: [{ sellPrice: '12000' }],
      }];
    },
  },
}));
const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
const baseUrl = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const tokenFor = (role, options = {}) => jwt.sign({ id: `user-${role}`, role }, process.env.JWT_SECRET, options);
const get = async (url, token) => {
  const response = await fetch(`${baseUrl}${url}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: response.status, body: await response.json() };
};

// ---------- Pengunjung tanpa login ----------
test('pengunjung: daftar produk tidak berisi field terlarang (dicek sampai ke dalam)', async () => {
  const { status, body } = await get('/products');
  assert.equal(status, 200);
  assert.ok(body.products.length > 0);
  assert.deepEqual(findForbiddenKeys(body), []);
});

test('pengunjung: /products?all=true tidak membuka produk Draft', async () => {
  const { body } = await get('/products?all=true');
  assert.ok(body.products.every((p) => p.id !== 'p-draft'));
  assert.deepEqual(findForbiddenKeys(body), []);
});

test('pengunjung: detail produk aman, dan produk Draft dijawab 404', async () => {
  const ok = await get('/products/p-aktif');
  assert.equal(ok.status, 200);
  assert.deepEqual(findForbiddenKeys(ok.body), []);
  const draft = await get('/products/p-draft');
  assert.equal(draft.status, 404);
});

test('pengunjung: modal yang lebih tinggi dari harga jual tidak bocor sebagai harga coret', async () => {
  const { body } = await get('/products');
  const rugi = body.products.find((p) => p.id === 'p-rugi');
  assert.equal(rugi.originalPrice, null);
  assert.equal(rugi.discountPercent, 0);
  assert.equal(JSON.stringify(body).includes('7000'), false);
});

test('pengunjung: paket acara tidak berisi harga modal / kolom mentah varian', async () => {
  const list = await get('/event-packages');
  assert.equal(list.status, 200);
  assert.deepEqual(findForbiddenKeys(list.body), []);
  const detail = await get('/event-packages/paket-arisan');
  assert.equal(detail.status, 200);
  assert.deepEqual(findForbiddenKeys(detail.body), []);
  assert.equal(detail.body.package.items[0].quantity, 2);
  assert.equal(detail.body.package.items[0].variant.product.name, 'Le Mineral 1,5 ML');
});

test('homepage: satu respons berisi semua data publik tanpa membocorkan harga modal', async () => {
  const queryCountBefore = homepageQueryCount;
  const { status, body } = await get('/homepage');
  assert.equal(status, 200);
  assert.equal(body.categories[0].name, 'Sembako');
  assert.equal(body.categories[0].imageUrl, 'https://example.test/sembako.webp');
  assert.equal(body.promos[0].name, 'Promo Hemat');
  assert.equal(body.flashSaleProducts[0].price, 12000);
  assert.equal(body.flashSaleProducts[0].originalPrice, null);
  assert.equal(body.bestsellerProducts[0].id, 'p-home');
  assert.deepEqual(body.recommendedProducts, []);
  assert.deepEqual(findForbiddenKeys(body), []);

  const cached = await get('/homepage');
  assert.equal(cached.status, 200);
  assert.deepEqual(cached.body, body);
  assert.equal(homepageQueryCount - queryCountBefore, 3);
});

test('token kedaluwarsa atau ngawur: tetap 200 sebagai pengunjung, bukan 403', async () => {
  for (const token of [tokenFor('OWNER', { expiresIn: -10 }), 'token.ngawur.sekali']) {
    const { status, body } = await get('/products?all=true', token);
    assert.equal(status, 200);
    assert.deepEqual(findForbiddenKeys(body), []);
    assert.ok(body.products.every((p) => p.id !== 'p-draft'));
  }
});

test('role PARCEL_MANAGER diperlakukan sebagai publik untuk data produk', async () => {
  const { body } = await get('/products', tokenFor('PARCEL_MANAGER'));
  assert.deepEqual(findForbiddenKeys(body), []);
});

// ---------- Staf ----------
test('kasir: tidak menerima harga modal, tetapi menerima barcode dan harga grosir', async () => {
  const { body } = await get('/products', tokenFor('CASHIER'));
  const first = body.products.find((p) => p.id === 'p-aktif');
  assert.equal(JSON.stringify(body).includes('purchasePrice'), false);
  assert.equal(first.barcode, '8996001600399');
  assert.equal(first.wholesalePrice, 5000);
  assert.equal(first.variants[0].wholesalePrice, 5000);
  assert.equal(first.units[0].id, 'u-aktif');
  assert.equal(first.units[0].sellPrice, 65000);
  assert.equal(first.units[0].wholesalePrice, 60000);
  assert.equal(JSON.stringify(first.units).includes('basePrice'), false);
});

test('pengunjung publik tidak menerima satuan produk internal pada katalog', async () => {
  const { body } = await get('/products');
  const first = body.products.find((p) => p.id === 'p-aktif');
  assert.equal('units' in first, false);
  assert.deepEqual(findForbiddenKeys(body), []);
});

test('detail produk: mengirim deskripsi dan varian publik tanpa data modal', async () => {
  const { status, body } = await get('/products/p-aktif');
  assert.equal(status, 200);
  assert.equal(body.product.description, 'Air mineral untuk kebutuhan sehari-hari.');
  assert.equal(body.product.variants[0].id, 'v-aktif');
  assert.equal(JSON.stringify(body).includes('basePrice'), false);
  assert.equal(JSON.stringify(body).includes('purchasePrice'), false);
});

test('OWNER dan ADMIN: menerima harga modal dan bisa memakai ?all=true', async () => {
  for (const role of ['OWNER', 'ADMIN']) {
    const { body } = await get('/products?all=true', tokenFor(role));
    const first = body.products.find((p) => p.id === 'p-aktif');
    assert.equal(first.purchasePrice, 4500);
    assert.equal(first.variants[0].purchasePrice, 4500);
    assert.ok(body.products.some((p) => p.id === 'p-draft'));
    const draft = await get('/products/p-draft', tokenFor(role));
    assert.equal(draft.status, 200);
  }
});

// ---------- Aturan dasar ----------
test('serializer: audiens default adalah publik (aman bila lupa diisi)', () => {
  assert.deepEqual(findForbiddenKeys(formatProduct(products[0])), []);
  assert.deepEqual(findForbiddenKeys(formatProduct(products[0], AUDIENCE.PUBLIC)), []);
  assert.equal(getAudience(undefined), AUDIENCE.PUBLIC);
  assert.equal(getAudience({ role: 'OWNER' }), AUDIENCE.OWNER);
  assert.equal(getAudience({ role: 'CASHIER' }), AUDIENCE.STAFF);
});

test('pemindai key terlarang benar-benar menemukan key yang bersarang', () => {
  const contoh = { a: [{ b: { purchasePrice: 1 } }], c: { d: [{ barcode: 'x' }] } };
  assert.deepEqual(findForbiddenKeys(contoh), ['$.a[0].b.purchasePrice', '$.c.d[0].barcode']);
  assert.ok(PUBLIC_FORBIDDEN_KEYS.includes('basePrice'));
});

test('parsel: pengunjung hanya melihat yang aktif, pengelola melihat semuanya', () => {
  assert.deepEqual(parcelListWhere(undefined), { isActive: true });
  assert.deepEqual(parcelListWhere({ role: 'CASHIER' }), { isActive: true });
  for (const role of ['OWNER', 'ADMIN', 'PARCEL_MANAGER']) assert.equal(parcelListWhere({ role }), undefined);
});

// ---------- Memastikan route benar-benar memakai aturan di atas ----------
test('route: endpoint publik terpasang ke handler yang aman', () => {
  const read = (file) => fs.readFileSync(path.join(backendDir, 'src/routes', file), 'utf8');
  const productRoutes = read('productRoutes.js');
  assert.match(productRoutes, /router\.get\('\/', softAuth, catalog\.listProducts\)/);
  assert.match(productRoutes, /router\.get\('\/:id', softAuth, catalog\.getProduct\)/);
  assert.doesNotMatch(productRoutes, /function formatProduct/);
  const eventRoutes = read('eventPackageRoutes.js');
  assert.match(eventRoutes, /router\.get\('\/', catalog\.listEventPackages\)/);
  assert.match(eventRoutes, /router\.get\('\/:id', catalog\.getEventPackage\)/);
  assert.match(read('parcelRoutes.js'), /parcelListWhere\(req\.user\)/);
});
