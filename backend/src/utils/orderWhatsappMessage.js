export function formatOnlineOrderWhatsappMessage({
  orderNumber,
  customerName,
  customerPhone,
  fulfillmentMethod,
  distanceKm,
  note,
  items,
  subtotal,
  discount,
  shippingCost,
  total,
  promoCode,
}) {
  const isPickup = fulfillmentMethod !== 'DELIVERY';
  const pickupNote = /^metode:\s*ambil di toko$/i;
  const cleanNote = String(note || '').trim();
  const noteSection = cleanNote && !(isPickup && pickupNote.test(cleanNote))
    ? `*Catatan*\n${cleanNote}`
    : null;
  const distanceLine = !isPickup && Number.isFinite(Number(distanceKm))
    ? ` (${Number(distanceKm).toLocaleString('id-ID')} km)`
    : '';
  const itemLines = items.map((item, index) => [
    `${index + 1}. *${item.name}*`,
    `   ${item.quantity} x Rp ${item.unitPrice.toLocaleString('id-ID')} = *Rp ${item.total.toLocaleString('id-ID')}*`,
  ].join('\n'));
  const shippingLabel = isPickup && Number(shippingCost) === 0
    ? 'Gratis (ambil di toko)'
    : `Rp ${shippingCost.toLocaleString('id-ID')}`;
  const orderDetails = [
    `No. pesanan: *${orderNumber}*`,
    `Nama: ${customerName}`,
    `WhatsApp: ${customerPhone}`,
    `Pengambilan: ${isPickup ? 'Ambil langsung di toko' : 'Antar ke alamat'}${distanceLine}`,
  ].join('\n');
  const totals = [
    `Subtotal: Rp ${subtotal.toLocaleString('id-ID')}`,
    `Diskon: Rp ${discount.toLocaleString('id-ID')}`,
    `Ongkir: ${shippingLabel}`,
    promoCode ? `Promo: ${promoCode}` : null,
    `*TOTAL: Rp ${total.toLocaleString('id-ID')}*`,
  ].filter(Boolean).join('\n');

  return [
    '*PESANAN GLOSIR*',
    orderDetails,
    noteSection,
    `*DAFTAR BELANJA*\n${itemLines.join('\n')}`,
    totals,
    isPickup ? 'Pembayaran dilakukan di toko saat pengambilan.' : null,
    'Mohon konfirmasi pesanan saya. Terima kasih.',
  ].filter(Boolean).join('\n\n');
}
