import { useState } from 'react';
import { apiFetch } from '../services/api';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function BulkPasteModal({ isOpen, onClose, categories = [], accounts = [], onDone }) {
  const [text, setText] = useState('');
  const [rows, setRows] = useState([]);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [availableCategories, setAvailableCategories] = useState(categories);
  const [availableAccounts, setAvailableAccounts] = useState(accounts);

  if (!isOpen) return null;

  const preview = async () => {
    if (!text.trim()) return;
    setPreviewing(true); setError('');
    try {
      const response = await apiFetch('/finance/bulk-paste-preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Preview gagal dibuat.');
      if (data.categories) setAvailableCategories(data.categories);
      if (data.accounts) setAvailableAccounts(data.accounts);
      setRows(data.drafts || data.data || []);
    } catch (err) { setError(err.message); } finally { setPreviewing(false); }
  };

  const updateRow = (index, changes) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...changes, error: null } : row));
  const confirm = async () => {
    const valid = rows.filter((row) => Number(row.amount) > 0 && row.description?.trim());
    if (!valid.length) { setError('Minimal satu baris transaksi yang valid diperlukan.'); return; }
    setSaving(true); setError('');
    try {
      const response = await apiFetch('/finance/bulk-paste-confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: valid.map(({ amount, description, type, categoryId, accountId }) => ({ amount: Number(amount), description: description.trim(), type, categoryId: categoryId || null, accountId: accountId || null })) }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Transaksi bulk gagal disimpan.');
      onDone?.(); onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return (
    <div className="scanner-modal-backdrop" onClick={() => !saving && onClose()}>
      <div className="bulk-modal-box" onClick={(event) => event.stopPropagation()}>
        <div className="scanner-modal-header">
          <div><h3>Tempel transaksi sekaligus</h3><p>Contoh: <code>20rb bensin</code> atau <code>150000 penjualan</code></p></div>
          <button className="scanner-close-btn" onClick={onClose} disabled={saving} aria-label="Tutup">×</button>
        </div>
        {!rows.length && <><textarea value={text} onChange={(event) => setText(event.target.value)} rows={8} placeholder={'20rb bensin\n15rb parkir\n100rb setor bank'} style={{ width: '100%', margin: '16px 0' }} /><button className="btn btn-primary" onClick={preview} disabled={previewing || !text.trim()}>{previewing ? 'Memproses…' : 'Preview transaksi'}</button></>}
        {!!rows.length && <><div className="product-table-wrap"><table className="product-table"><thead><tr><th>Nominal</th><th>Keterangan</th><th>Jenis</th><th>Kategori</th><th>Akun</th><th /></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.row}-${index}`}><td><input type="number" value={row.amount ?? ''} onChange={(event) => updateRow(index, { amount: event.target.value })} /></td><td><input value={row.description || ''} onChange={(event) => updateRow(index, { description: event.target.value })} /><small>{row.error}</small></td><td><select value={row.type || 'EXPENSE'} onChange={(event) => updateRow(index, { type: event.target.value })}><option value="EXPENSE">Keluar</option><option value="INCOME">Masuk</option></select></td><td><select value={row.categoryId || ''} onChange={(event) => updateRow(index, { categoryId: event.target.value })}><option value="">Otomatis</option>{availableCategories.filter((item) => item.type === row.type).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></td><td><select value={row.accountId || ''} onChange={(event) => updateRow(index, { accountId: event.target.value })}><option value="">Default</option>{availableAccounts.map((item) => <option key={item.id} value={item.id}>{item.name} ({money(item.balance)})</option>)}</select></td><td><button type="button" className="text-button" onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Hapus</button></td></tr>)}</tbody></table></div><div className="crud-notice" style={{ marginTop: 12 }}>Baris tanpa nominal valid akan dilewati saat simpan.</div><div style={{ display: 'flex', gap: 8, marginTop: 16 }}><button className="btn btn-secondary" onClick={() => setRows([])} disabled={saving}>Kembali edit teks</button><button className="btn btn-primary" onClick={confirm} disabled={saving}>{saving ? 'Menyimpan…' : `Simpan ${rows.length} transaksi`}</button></div></>}
        {error && <p role="alert" style={{ color: '#b42318', marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
}
