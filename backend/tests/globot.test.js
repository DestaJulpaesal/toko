import test from 'node:test';
import assert from 'node:assert/strict';
import { chatSchema } from '../src/routes/globotRoutes.js';
import { createGlobotHandler, generateGlobotReply } from '../src/services/globotService.js';

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

test('Globot accepts its own long assistant replies in chat history but keeps user input limited', () => {
  const longAssistantReply = 'x'.repeat(2500);
  const valid = chatSchema.safeParse({
    messages: [
      { role: 'assistant', content: longAssistantReply },
      { role: 'user', content: 'Lanjut jelaskan ya' },
    ],
  });
  const oversizedUserMessage = chatSchema.safeParse({
    messages: [{ role: 'user', content: 'x'.repeat(1201) }],
  });

  assert.equal(valid.success, true);
  assert.equal(oversizedUserMessage.success, false);
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

test('Globot can reply to brainware chats without exposing sensitive text to the provider', async () => {
  let providerBody;
  const result = await generateGlobotReply({
    db: {},
    messages: [{ role: 'user', content: 'Bantu saya, nomor saya 081234567890' }],
    context: { path: '/whatsapp', title: 'Percakapan WhatsApp' },
    audience: 'brainware',
    env: {
      GLOBOT_CHAT_COMPLETIONS_URL: 'https://ai.example.test/v1/chat/completions',
      GLOBOT_API_KEY: 'test-key',
      GLOBOT_MODEL: 'test-model',
    },
    fetchImpl: async (_url, options) => {
      providerBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { role: 'assistant', content: 'Siap, ada yang bisa saya bantu?' } }],
        }),
      };
    },
  });

  assert.equal(result.answer, 'Siap, ada yang bisa saya bantu?');
  assert.match(providerBody.messages[0].content, /brainware\/tim toko/);
  assert.doesNotMatch(providerBody.messages.at(-1).content, /081234567890/);
  assert.match(providerBody.messages.at(-1).content, /nomor telepon disamarkan/);
});

test('Globot welcomes general conversation and does not require a store-related question', async () => {
  let providerBody;
  const result = await generateGlobotReply({
    db: {},
    messages: [{ role: 'user', content: 'Aku lagi bosan, ada ide kegiatan santai?' }],
    fetchImpl: async (_url, options) => {
      providerBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { role: 'assistant', content: 'Bisa coba jalan santai atau nonton film favorit, kak.' } }],
        }),
      };
    },
    env: {
      GLOBOT_CHAT_COMPLETIONS_URL: 'https://ai.example.test/v1/chat/completions',
      GLOBOT_API_KEY: 'test-key',
      GLOBOT_MODEL: 'test-model',
    },
  });

  assert.equal(result.answer, 'Bisa coba jalan santai atau nonton film favorit, kak.');
  assert.match(providerBody.messages[0].content, /bukan hanya mesin pencari produk/);
  assert.match(providerBody.messages[0].content, /pertanyaan umum sehari-hari/);
});

test('Globot returns the same available top sellers used by the homepage', async () => {
  const product = (id, name, stockQty, isBestseller = false) => ({
    id,
    categoryId: 'category-1',
    name,
    description: '',
    status: 'ACTIVE',
    stockWarning: 5,
    originalPrice: null,
    isFeatured: false,
    isParcel: false,
    isBestseller,
    category: { name: 'Sembako' },
    variants: [{
      id: `${id}-variant`,
      name: '1 kg',
      sellPrice: 20000,
      stockQty,
      isDefault: true,
      basePrice: 15000,
      wholesalePrice: 17000,
    }],
  });
  let orderItemQuery;
  const productFindMany = async () => [
    product('popular', 'Produk Populer', 5),
    product('unavailable', 'Produk Kosong', 0, true),
    product('tagged', 'Produk Ditandai', 3, true),
  ];
  const db = {
    product: { findMany: productFindMany },
    orderItem: {
      findMany: async (query) => {
        orderItemQuery = query;
        return [
          { productId: 'popular', quantity: 12 },
          { productId: 'unavailable', quantity: 20 },
        ];
      },
    },
  };
  const providerBodies = [];
  let callCount = 0;
  const response = {
    ok: true,
    json: async () => {
      callCount += 1;
      if (callCount === 1) {
        return {
          choices: [{
            message: {
              role: 'assistant',
              tool_calls: [{
                id: 'call-bestsellers',
                type: 'function',
                function: { name: 'get_bestsellers', arguments: '{}' },
              }],
            },
          }],
        };
      }
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: 'Berikut produk terlaris:\n\n| No | Nama Produk | Kategori | Harga | Stok |\n|---|---|---|---|---|\n| 1 | Produk Populer | Sembako | Rp20.000 | 5 |',
          },
        }],
      };
    },
  };
  const result = await generateGlobotReply({
    db,
    messages: [{ role: 'user', content: 'Cari produk terlaris' }],
    fetchImpl: async (_url, options) => {
      providerBodies.push(JSON.parse(options.body));
      return response;
    },
    env: {
      GLOBOT_CHAT_COMPLETIONS_URL: 'https://ai.example.test/v1/chat/completions',
      GLOBOT_API_KEY: 'test-key',
      GLOBOT_MODEL: 'test-model',
    },
  });

  assert.equal(
    result.answer,
    'Berikut produk terlaris:\n\n1. Produk Populer\n   Kategori: Sembako\n   Harga: Rp 20.000\n   Stok: 5',
  );
  assert.doesNotMatch(result.answer, /\|/);
  assert.deepEqual(result.products.map(({ id }) => id), ['popular']);
  assert.equal(orderItemQuery.where.order.status, 'COMPLETED');
  assert.ok(orderItemQuery.where.order.createdAt.gte instanceof Date);
  assert.equal('wholesalePrice' in result.products[0].variants[0], false);
  assert.equal('basePrice' in result.products[0].variants[0], false);
  assert.deepEqual(providerBodies[0].tools.map(({ function: tool }) => tool.name), [
    'search_products',
    'get_bestsellers',
    'get_product_detail',
    'get_store_info',
  ]);
});
