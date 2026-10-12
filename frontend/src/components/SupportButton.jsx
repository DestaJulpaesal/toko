export default function SupportButton() {
  const path = window.location.pathname;
  if (!path.startsWith('/admin') && !path.startsWith('/kasir') && !path.startsWith('/parcel-manager')) return null;
  const number = import.meta.env.VITE_SUPPORT_WHATSAPP_NUMBER || '6282118996827';
  const message = encodeURIComponent(`Halo, saya perlu bantuan memakai sistem Glosir di halaman ${path}.`);
  return <a className="support-floating-button" href={`https://wa.me/${number}?text=${message}`} target="_blank" rel="noreferrer"><span>?</span><strong>Butuh bantuan?</strong></a>;
}
