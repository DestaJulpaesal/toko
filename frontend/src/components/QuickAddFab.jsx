import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function QuickAddFab() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [yesterday, setYesterday] = useState([]);
  const [notice, setNotice] = useState('');
  const [lastId, setLastId] = useState(null);

  useEffect(() => {
    if (!open) return;
    apiFetch('/finance/quick-templates').then((response) => response.json()).then((data) => { if (data.success) setTemplates((data.data || []).slice(0, 5)); });
    const now = new Date(); const start = new Date(now); start.setDate(now.getDate() - 1); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(start.getDate() + 1);
    apiFetch(`/finance/transactions?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`).then((response) => response.json()).then((data) => { if (data.success) setYesterday(data.data || data.transactions || []); });
  }, [open]);

  useEffect(() => {
    if (!open || description.trim().length < 2) { setSuggestions([]); return undefined; }
    const timer = window.setTimeout(() => apiFetch(`/finance/suggest?description=${encodeURIComponent(description)}&type=${type}`).then((response) => response.json()).then((data) => { if (data.success) setSuggestions(data.data || []); }), 300);
    return () => window.clearTimeout(timer);
  }, [description, type, open]);

  const submit = async (event) => {
    event.preventDefault();
    if (Number(amount) <= 0 || !description.trim()) { setNotice('Nominal dan keterangan wajib diisi.'); return; }
    const response = await apiFetch('/finance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, amount: Number(amount), description: description.trim(), categoryId: categoryId || undefined, accountId: accountId || undefined }) });
    const data = await response.json();
    if (!response.ok || !data.success) { setNotice(data.message || 'Transaksi gagal dicatat.'); return; }
    setLastId(data.data?.id); setNotice('Transaksi tersimpan. Bisa diurungkan selama 5 detik.'); setAmount(''); setDescription(''); setCategoryId(''); setAccountId('');
    window.setTimeout(() => setLastId(null), 5000);
  };

  const useTemplate = async (template) => {
    const value = template.amount == null ? window.prompt(`Nominal untuk ${template.label}`) : template.amount;
    if (value == null) return;
    const response = await apiFetch(`/finance/quick-templates/${template.id}/use`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(value) }) });
    const data = await response.json(); setNotice(response.ok && data.success ? `${template.label} berhasil dicatat.` : (data.message || 'Template gagal dipakai.'));
  };

  const duplicate = async (transaction) => {
    const response = await apiFetch('/finance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: transaction.type, amount: transaction.amount, description: transaction.description, categoryId: transaction.categoryId, accountId: transaction.accountId, paymentMethod: transaction.paymentMethod }) });
    const data = await response.json(); setNotice(response.ok && data.success ? `Duplikat "${transaction.description}" berhasil dicatat.` : (data.message || 'Duplikat gagal dicatat.'));
  };

  const undo = async () => { if (!lastId) return; const response = await apiFetch(`/finance/${lastId}`, { method: 'DELETE' }); setNotice(response.ok ? 'Transaksi diurungkan.' : 'Transaksi tidak dapat diurungkan.'); setLastId(null); };
  if (!localStorage.getItem('glosir_token') || !window.location.pathname.startsWith('/admin')) return null;
  return <div className="quick-add-fab-wrap">
    {open && <section className="quick-add-sheet" aria-label="Tambah transaksi cepat">
      <div className="quick-add-sheet-head"><div><span className="panel-kicker">Input cepat</span><h2>Catat transaksi</h2></div><button type="button" className="text-button" onClick={() => setOpen(false)}>Tutup</button></div>
      {templates.length > 0 && <div className="quick-template-row">{templates.map((template) => <button type="button" className="quick-template-chip" key={template.id} onClick={() => useTemplate(template)}>{template.icon || '＋'} {template.label}</button>)}</div>}
      <div className="quick-duplicate"><strong>Duplikat transaksi kemarin</strong>{yesterday.length ? yesterday.slice(0, 4).map((item) => <button type="button" key={item.id} onClick={() => duplicate(item)}>{item.description} · {money(item.amount)}</button>) : <small>Tidak ada transaksi kemarin.</small>}</div>
      <form onSubmit={submit}><div className="quick-type-toggle"><button type="button" className={type === 'EXPENSE' ? 'active' : ''} onClick={() => setType('EXPENSE')}>Keluar</button><button type="button" className={type === 'INCOME' ? 'active' : ''} onClick={() => setType('INCOME')}>Masuk</button></div><input className="quick-amount-input" inputMode="decimal" type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Nominal" /><div className="quick-description-field"><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Keterangan, misalnya bensin motor" />{suggestions.length > 0 && <div className="quick-suggestions">{suggestions.map((item) => <button type="button" key={`${item.categoryId}-${item.accountId}`} onClick={() => { setDescription(item.matchedDescription); setCategoryId(item.categoryId || ''); setAccountId(item.accountId || ''); setSuggestions([]); }}>{item.matchedDescription} · {item.category?.name}</button>)}</div>}</div><button className="btn btn-primary full">Simpan cepat</button></form>
      {notice && <div className="quick-add-notice">{notice}{lastId && <button type="button" onClick={undo}>Urungkan</button>}</div>}
    </section>}
    <button type="button" className="quick-add-fab" aria-label="Catat transaksi cepat" onClick={() => setOpen((value) => !value)}>＋</button>
  </div>;
}
