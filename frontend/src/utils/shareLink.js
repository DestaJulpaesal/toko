export function buildProductShareUrl(product, baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://glosir.id') {
  const normalizedBase = typeof baseUrl === 'string' && baseUrl ? baseUrl.replace(/\/$/, '') : 'https://glosir.id';
  if (!product) return `${normalizedBase}/products`;

  if (product.detailPath && product.detailPath.startsWith('/')) {
    return new URL(product.detailPath, normalizedBase).toString();
  }

  const productId = product.id ?? product.slug ?? 'produk';
  return new URL(`/products/${productId}`, normalizedBase).toString();
}

export function buildProductShareText(product, url = buildProductShareUrl(product)) {
  const productName = product?.name || 'produk ini';
  return `Lihat ${productName} di Glosir: ${url}`;
}

export function buildWhatsAppShareLink(phoneNumber, productUrl, productName) {
  const normalizedPhone = (phoneNumber || '').replace(/[^\d]/g, '');
  const safeLabel = productName ? productName.trim() : 'produk ini';
  const message = encodeURIComponent(`Halo, saya mau cek ${safeLabel} di Glosir: ${productUrl}`);
  return normalizedPhone ? `https://wa.me/${normalizedPhone}?text=${message}` : `https://wa.me/?text=${message}`;
}

export function buildWhatsAppOrderLink(phoneNumber, productName, quantity = 1, productUrl = '') {
  const normalizedPhone = (phoneNumber || '').replace(/[^\d]/g, '');
  const safeLabel = productName ? productName.trim() : 'produk ini';
  const qtyPart = Number(quantity) > 1 ? ` sebanyak ${Number(quantity)}` : '';
  const urlPart = productUrl ? ` (${productUrl})` : '';
  const message = encodeURIComponent(`Halo Glosir, saya mau order ${safeLabel}${qtyPart}${urlPart}`);
  return normalizedPhone ? `https://wa.me/${normalizedPhone}?text=${message}` : `https://wa.me/?text=${message}`;
}

export function buildCartCheckoutLink(phoneNumber, items = [], total = 0) {
  const normalizedPhone = (phoneNumber || '').replace(/[^\d]/g, '');
  const details = (items || []).map((item) => `${item.name} x${item.qty} (${Number(item.price || 0).toLocaleString('id-ID')})`).join('\n');
  const message = encodeURIComponent(
    `Halo Glosir, saya ingin checkout keranjang:\n${details || 'Tidak ada item'}\n\nTotal: Rp ${Number(total || 0).toLocaleString('id-ID')}`
  );
  return normalizedPhone ? `https://wa.me/${normalizedPhone}?text=${message}` : `https://wa.me/?text=${message}`;
}

export function buildPromoWhatsAppLink(phoneNumber, promoTitle, promoText = '', promoUrl = '') {
  const normalizedPhone = (phoneNumber || '').replace(/[^\d]/g, '');
  const title = promoTitle ? promoTitle.trim() : 'promo Glosir';
  const notes = promoText ? ` - ${promoText.trim()}` : '';
  const urlPart = promoUrl ? ` (${promoUrl})` : '';
  const message = encodeURIComponent(`Halo Glosir, saya mau klaim promo ${title}${notes}${urlPart}`);
  return normalizedPhone ? `https://wa.me/${normalizedPhone}?text=${message}` : `https://wa.me/?text=${message}`;
}

export async function shareProduct(product, options = {}) {
  const baseUrl = options.baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://glosir.id');
  const url = buildProductShareUrl(product, baseUrl);
  const text = options.text || buildProductShareText(product, url);

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: product?.name || 'Glosir', text, url });
      return { ok: true, url, text, method: 'native' };
    } catch (error) {
      if (error && error.name === 'AbortError') {
        return { ok: false, canceled: true, url, text, method: 'native' };
      }
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return { ok: true, url, text, method: 'clipboard' };
  }

  if (typeof document !== 'undefined') {
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', 'true');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    return { ok: true, url, text, method: 'fallback' };
  }

  return { ok: true, url, text, method: 'manual' };
}
