export default function SupportButton() {
  const path = window.location.pathname;
  const isAdminPath = path.startsWith('/admin') || path.startsWith('/kasir') || path.startsWith('/parcel-manager');

  if (isAdminPath) {
    const number = import.meta.env.VITE_SUPPORT_WHATSAPP_NUMBER || '6282118996827';
    const message = encodeURIComponent(`Halo, saya perlu bantuan memakai sistem Glosir di halaman ${path}.`);
    return (
      <a className="support-floating-button" href={`https://wa.me/${number}?text=${message}`} target="_blank" rel="noreferrer">
        <span>?</span>
        <strong>Butuh bantuan?</strong>
      </a>
    );
  }

  const storeNumber = String(import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '').replace(/\D/g, '');
  if (!/^\d{8,15}$/.test(storeNumber)) return null;

  const message = encodeURIComponent('Halo Glosir, saya mau tanya stok dan harga produk yang tersedia.');
  return (
    <a className="support-floating-button" href={`https://wa.me/${storeNumber}?text=${message}`} target="_blank" rel="noreferrer">
      <span>WA</span>
      <strong>Chat Glosir</strong>
    </a>
  );
}
