const base = 'http://localhost:5000';

const fetchJson = async (url) => {
  const res = await fetch(url);
  return res.json();
};

const products = await fetchJson(`${base}/api/products?all=true`);
const customers = await fetchJson(`${base}/api/customers`);

console.log('PRODUCTS_SOURCE', products.source || 'unknown');
console.log('PRODUCTS_COUNT', products.products?.length ?? 0);
console.log('FIRST_PRODUCT', products.products?.[0] ? JSON.stringify(products.products[0]) : 'none');

console.log('CUSTOMERS_SOURCE', customers.source || 'unknown');
console.log('CUSTOMERS_COUNT', customers.customers?.length ?? 0);
console.log('FIRST_CUSTOMER', customers.customers?.[0] ? JSON.stringify(customers.customers[0]) : 'none');

if (products.products?.length) {
  const first = products.products[0];
  const payload = {
    items: [{ variantId: first.variantId, quantity: 1, name: first.name, price: first.price }],
    paidAmount: first.price,
    paymentMethod: 'CASH',
    cashierName: 'Kasir Glosir',
    customerName: 'Pelanggan Umum'
  };

  const checkoutRes = await fetch(`${base}/api/orders/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const checkoutData = await checkoutRes.json();
  console.log('CHECKOUT_STATUS', checkoutRes.status);
  console.log('CHECKOUT_SUCCESS', checkoutData.success);
  console.log('CHECKOUT_SOURCE', checkoutData.source || 'database');
  console.log('CHECKOUT_ORDER', checkoutData.orderNumber || checkoutData.id || 'none');

  const after = await fetchJson(`${base}/api/products?all=true`);
  const current = after.products?.find((p) => p.id === first.id) || null;
  console.log('STOCK_BEFORE', first.stock);
  console.log('STOCK_AFTER', current?.stock ?? 'unknown');
  console.log('STOCK_DECREASED', current ? current.stock < first.stock : 'unknown');
}
