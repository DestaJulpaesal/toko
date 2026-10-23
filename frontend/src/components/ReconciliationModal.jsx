import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
export default function ReconciliationModal({ accounts = [], onDone }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [physicalCount, setPhysicalCount] = useState('');
  const [note, setNote] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accountId && accounts.length) setAccountId(accounts[0].id);
  }, [accountId, accounts]);

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch('/finance/reconciliation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId, physicalCount: Number(physicalCount), note }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Pencocokan kas gagal disimpan.');
      setResult(data.data);
      setPhysicalCount('');
      setNote('');
      await onDone?.();
    } catch (submitError) {
      setError(submitError.message || 'Pencocokan kas gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const difference = Number(result?.difference || 0);
  const resultLabel = difference === 0
    ? 'Uang fisik cocok dengan catatan kas.'
    : difference > 0
      ? `Uang fisik lebih ${money(difference)} dari catatan kas.`
      : `Uang fisik kurang ${money(Math.abs(difference))} dari catatan kas.`;

  return (
    <form className="finance-action-form reconciliation-form cash-reconciliation-form" onSubmit={submit}>
      <div className="finance-action-form-heading">
        <span className="finance-action-icon">✓</span>
        <div><strong>Hitung kas fisik</strong><small>Hitung uang tunai yang ada, lalu bandingkan dengan catatan.</small></div>
      </div>
      <div className="finance-action-fields">
        {accounts.length === 1
          ? <div className="cash-reconciliation-account"><span>Jenis kas</span><strong>{accounts[0].name}</strong></div>
          : <label>Akun kas<select value={accountId} onChange={(event) => setAccountId(event.target.value)} required><option value="">Pilih akun kas</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>}
        <label>Uang yang dihitung<input type="number" min="0" value={physicalCount} onChange={(event) => setPhysicalCount(event.target.value)} placeholder="Masukkan jumlah uang cash" required /></label>
        <label>Catatan (opsional)<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Contoh: tutup kas hari ini" /></label>
      </div>
      <button className="btn btn-primary" disabled={saving || !accounts.length}>{saving ? 'Menyimpan...' : 'Simpan hasil hitung kas'}</button>
      {!accounts.length && <p className="cash-reconciliation-error" role="alert">Akun kas belum tersedia. Muat ulang halaman atau hubungi admin.</p>}
      {error && <p className="cash-reconciliation-error" role="alert">{error}</p>}
      {result && <output className={`cash-reconciliation-result${difference < 0 ? ' negative' : difference > 0 ? ' is-over' : ''}`}><strong>{resultLabel}</strong><span>Catatan sistem {money(result.systemBalance)} · Uang dihitung {money(result.physicalCount)}</span></output>}
    </form>
  );
}

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
