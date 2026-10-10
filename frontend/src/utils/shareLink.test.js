import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProductShareUrl, buildProductShareText, buildWhatsAppShareLink, buildWhatsAppOrderLink, buildCartCheckoutLink, buildPromoWhatsAppLink } from './shareLink.js';

test('buildProductShareUrl returns canonical product URL', () => {
  const url = buildProductShareUrl({ id: '42', name: 'Kopi Bubuk Premium' }, 'https://glosir.id');
  assert.equal(url, 'https://glosir.id/products/42');
});

test('buildProductShareText includes product name and product URL', () => {
  const text = buildProductShareText({ id: '42', name: 'Kopi Bubuk Premium' }, 'https://glosir.id/products/42');
  assert.match(text, /Kopi Bubuk Premium/);
  assert.match(text, /https:\/\/glosir.id\/products\/42/);
});

test('buildWhatsAppShareLink encodes a share message', () => {
  const link = buildWhatsAppShareLink('628123456789', 'https://glosir.id/products/42', 'Kopi Bubuk Premium');
  assert.match(link, /wa.me\/628123456789/);
  assert.match(link, /Kopi%20Bubuk%20Premium/);
});

test('buildWhatsAppOrderLink encodes a purchase request', () => {
  const link = buildWhatsAppOrderLink('628123456789', 'Kopi Bubuk Premium', 2, 'https://glosir.id/products/42');
  assert.match(link, /wa.me\/628123456789/);
  assert.match(link, /order%20Kopi%20Bubuk%20Premium%20sebanyak%202/);
});

test('buildCartCheckoutLink encodes cart summary for WhatsApp', () => {
  const link = buildCartCheckoutLink('628123456789', [{ name: 'Kopi Bubuk Premium', qty: 2, price: 48000 }], 96000);
  assert.match(link, /wa.me\/628123456789/);
  assert.match(link, /Kopi%20Bubuk%20Premium/);
  assert.match(link, /Rp%2096.000/);
});

test('buildPromoWhatsAppLink encodes a promo claim message', () => {
  const link = buildPromoWhatsAppLink('628123456789', 'Promo Lebaran', 'Diskon 15% untuk pembelian kebutuhan rumah', 'https://glosir.id/promo');
  assert.match(link, /wa.me\/628123456789/);
  assert.match(link, /Promo%20Lebaran/);
  assert.match(link, /Diskon%2015%25/);
});
