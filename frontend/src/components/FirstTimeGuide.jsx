import { useEffect, useState } from 'react';

const slides = [
  { title: 'Cek omzet hari ini', text: 'Mulai dari ringkasan besar di halaman awal untuk melihat pemasukan toko hari ini.', mark: 'Rp' },
  { title: 'Pantau stok menipis', text: 'Ketuk kotak stok untuk melihat barang yang perlu dibeli sebelum habis.', mark: 'ST' },
  { title: 'Lihat piutang dan pesanan', text: 'Gunakan kotak piutang atau pesanan baru supaya tidak ada yang terlewat.', mark: '!' },
];

export default function FirstTimeGuide() {
  const isAdminArea = window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/kasir');
  const [open, setOpen] = useState(() => isAdminArea && localStorage.getItem('glosir_first_guide_seen') !== 'true');
  const [slide, setSlide] = useState(0);
  useEffect(() => { if (open) document.body.classList.add('guide-open'); else document.body.classList.remove('guide-open'); return () => document.body.classList.remove('guide-open'); }, [open]);
  if (!isAdminArea) return null;
  const current = slides[slide];
  const close = () => { localStorage.setItem('glosir_first_guide_seen', 'true'); setOpen(false); };
  return <><button type="button" className="guide-help-button" onClick={() => { setSlide(0); setOpen(true); }} aria-label="Buka panduan">?</button>{open && <div className="guide-backdrop"><section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title"><button type="button" className="guide-close" onClick={close} aria-label="Tutup panduan">×</button><div className="guide-visual">{current.mark}</div><span className="panel-kicker">Panduan singkat {slide + 1}/3</span><h2 id="guide-title">{current.title}</h2><p>{current.text}</p><div className="guide-dots">{slides.map((_, index) => <button type="button" key={index} className={index === slide ? 'active' : ''} onClick={() => setSlide(index)} aria-label={`Slide ${index + 1}`} />)}</div><div className="guide-actions">{slide > 0 && <button type="button" className="btn btn-secondary" onClick={() => setSlide((value) => value - 1)}>Kembali</button>}{slide < slides.length - 1 ? <button type="button" className="btn btn-primary" onClick={() => setSlide((value) => value + 1)}>Lanjut</button> : <button type="button" className="btn btn-primary" onClick={close}>Mulai</button>}</div></section></div>}</>;
}
