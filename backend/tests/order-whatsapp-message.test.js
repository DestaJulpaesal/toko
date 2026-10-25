import assert from 'node:assert/strict';
import test from 'node:test';
import { createOnlineOrderNumber } from '../src/utils/orderNumber.js';
import { formatOnlineOrderWhatsappMessage } from '../src/utils/orderWhatsappMessage.js';

const order = {
  orderNumber: 'WEB-20261025-123456',
  customerName: 'Budi',
  customerPhone: '62821196827',
  fulfillmentMethod: 'PICKUP',
  note: 'Metode: Ambil di Toko',
  items: [
    { name: 'Boom Powder Det 600 Gr', quantity: 1, unitPrice: 18000, total: 18000 },
    { name: 'Daia Det Segar Putih 1 Kg', quantity: 1, unitPrice: 24000, total: 24000 },
  ],
  subtotal: 42000,
  discount: 0,
  shippingCost: 0,
  total: 42000,
  promoCode: '',
};

test('formats pickup orders as a readable WhatsApp message without duplicate pickup notes', () => {
  const message = formatOnlineOrderWhatsappMessage(order);

  assert.match(message, /^\*PESANAN GLOSIR\*/);
  assert.match(message, /No\. pesanan: \*WEB-20261025-123456\*/);
  assert.match(message, /Pengambilan: Ambil langsung di toko/);
  assert.match(message, /1\. \*Boom Powder Det 600 Gr\*\n\s{3}1 x Rp 18\.000 = \*Rp 18\.000\*/);
  assert.match(message, /\*TOTAL: Rp 42\.000\*/);
  assert.match(message, /Ongkir: Gratis \(ambil di toko\)/);
  assert.match(message, /Nama: Budi/);
  assert.doesNotMatch(message, /Catatan|Promo:/);
  assert.doesNotMatch(message, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  assert.doesNotMatch(message, /\n{3,}/);
});

test('includes genuine order notes, active promotions, and delivery distance', () => {
  const message = formatOnlineOrderWhatsappMessage({
    ...order,
    fulfillmentMethod: 'DELIVERY',
    distanceKm: 3.5,
    note: 'Rumah pagar biru, titip ke satpam.',
    shippingCost: 5000,
    total: 47000,
    promoCode: 'HEMAT10',
  });

  assert.match(message, /Pengambilan: Antar ke alamat \(3,5 km\)/);
  assert.match(message, /\*Catatan\*\nRumah pagar biru, titip ke satpam\./);
  assert.match(message, /Ongkir: Rp 5\.000/);
  assert.match(message, /Promo: HEMAT10/);
  assert.match(message, /\*TOTAL: Rp 47\.000\*/);
});

test('creates shorter online order numbers while retaining a date and unique reference', () => {
  const orderNumber = createOnlineOrderNumber(new Date('2026-10-25T10:00:00.000Z'), '12345678-1234-4abc-8def-123456789abc');

  assert.equal(orderNumber, 'WEB-20261025-123456781234');
  assert.equal(orderNumber.length, 25);
});
