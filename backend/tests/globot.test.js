import test from 'node:test';
import assert from 'node:assert/strict';
import { createGlobotHandler } from '../src/services/globotService.js';

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

const context = {
  path: '/products',
  title: 'Katalog produk',
  productId: null,
  cart: [],
  store: {},
};

test('Globot reports that provider settings are missing without making a request', async () => {
  let fetchCalled = false;
  const handler = createGlobotHandler({
    db: {},
    env: {},
    fetchImpl: async () => {
      fetchCalled = true;
    },
  });
  const response = responseRecorder();

  await handler({ body: { messages: [{ role: 'user', content: 'Hai' }], context } }, response);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'GLOBOT_NOT_CONFIGURED');
  assert.equal(fetchCalled, false);
});

test('Globot searches public products and returns safe linked product data', async () => {
  const product = {
    id: 'product-1',
    categoryId: 'category-1',
    name: 'Beras Ramos',
    description: 'Beras pilihan',
    status: 'ACTIVE',
    stockWarning: 5,
    originalPrice: null,
    isFeatured: false,
    isParcel: false,
    category: { name: 'Beras' },
    variants: [{
      id: 'variant-1',
      name: '5 kg',
      sellPrice: 72000,
      stockQty: 14,
      isDefault: true,
      basePrice: 60000,
      wholesalePrice: 65000,
    }],
  };
  const db = {
    product: {
      findMany: async () => [product],
    },
  };
  const providerBodies = [];
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    providerBodies.push(body);
    if (providerBodies.length === 1) {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              role: 'assistant',
              tool_calls: [{
                id: 'call-search-1',
                type: 'function',
                function: { name: 'search_products', arguments: '{"keyword":"beras"}' },
              }],
            },
          }],
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: 'Beras Ramos 5 kg tersedia.' } }],
      }),
    };
  };
  const handler = createGlobotHandler({
    db,
    fetchImpl,
    env: {
      GLOBOT_CHAT_COMPLETIONS_URL: 'https://ai.example.test/v1/chat/completions',
      GLOBOT_API_KEY: 'test-key',
      GLOBOT_MODEL: 'test-model',
    },
  });
  const response = responseRecorder();

  await handler({
    body: {
      messages: [{ role: 'user', content: 'Saya cari beras, WA saya 081234567890' }],
      context,
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.answer, 'Beras Ramos 5 kg tersedia.');
  assert.equal(response.body.products[0].id, 'product-1');
  assert.equal(response.body.products[0].price, 72000);
  assert.equal('wholesalePrice' in response.body.products[0].variants[0], false);
  assert.equal(providerBodies[0].messages.at(-1).content.includes('081234567890'), false);
  assert.match(providerBodies[0].messages.at(-1).content, /nomor telepon disamarkan/);
});
