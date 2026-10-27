import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
export default function ReconciliationModal({ accounts = [], onDone }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [physicalCount, setPhysicalCount] = useState('');
  const [note, setNote] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accountId && accounts.length) setAccountId(accounts[0].id);
  }, [accountId, accounts]);

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const errors = {};
    if (!accountId) errors.accountId = 'Pilih akun kas yang akan dihitung.';
    if (!physicalCount.trim()) errors.physicalCount = 'Jumlah uang yang dihitung wajib diisi.';
    else if (!Number.isFinite(Number(physicalCount)) || Number(physicalCount) < 0) {
      errors.physicalCount = 'Masukkan jumlah uang yang valid. Nilainya tidak boleh kurang dari nol.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError('');
      document.getElementById(`cash-reconciliation-${Object.keys(errors)[0]}`)?.focus();
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch('/finance/reconciliation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId, physicalCount: Number(physicalCount), note }) });
      const data = await response.json();
      if (!response.ok || !data.success) {
        const serverErrors = {};
        data.errors?.forEach(({ field }) => {
          if (field === 'accountId') serverErrors.accountId = 'Pilih akun kas yang masih tersedia.';
          if (field === 'physicalCount') serverErrors.physicalCount = 'Masukkan jumlah uang yang valid. Nilainya tidak boleh kurang dari nol.';
        });
        if (Object.keys(serverErrors).length) {
          setFieldErrors(serverErrors);
          document.getElementById(`cash-reconciliation-${Object.keys(serverErrors)[0]}`)?.focus();
          return;
        }
        throw new Error(data.message || 'Hasil hitung kas belum berhasil disimpan. Coba lagi.');
      }
      setResult(data.data);
      setPhysicalCount('');
      setNote('');
      setFieldErrors({});
      await onDone?.();
    } catch (submitError) {
      setError(submitError instanceof TypeError
        ? 'Koneksi ke server bermasalah. Periksa internet lalu coba lagi.'
        : submitError instanceof SyntaxError
          ? 'Respons server tidak dapat dibaca. Coba lagi sebentar.'
          : submitError.message || 'Hasil hitung kas belum berhasil disimpan. Coba lagi.');
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
    <form className="finance-action-form reconciliation-form cash-reconciliation-form" onSubmit={submit} noValidate>
      <div className="finance-action-form-heading">
        <span className="finance-action-icon">✓</span>
        <div><strong>Hitung kas fisik</strong><small>Hitung uang tunai yang ada, lalu bandingkan dengan catatan.</small></div>
      </div>
      <div className="finance-action-fields">
        {accounts.length === 1
          ? <div className="cash-reconciliation-account"><span>Jenis kas</span><strong>{accounts[0].name}</strong></div>
          : <label htmlFor="cash-reconciliation-accountId">Akun kas<select id="cash-reconciliation-accountId" value={accountId} onChange={(event) => { setAccountId(event.target.value); setFieldErrors((current) => ({ ...current, accountId: '' })); }} aria-invalid={Boolean(fieldErrors.accountId)} aria-describedby={fieldErrors.accountId ? 'cash-reconciliation-accountId-error' : undefined}><option value="">Pilih akun kas</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>{fieldErrors.accountId && <small className="cash-reconciliation-error" id="cash-reconciliation-accountId-error" role="alert">{fieldErrors.accountId}</small>}</label>}
        <label htmlFor="cash-reconciliation-physicalCount">Jumlah uang yang dihitung<input id="cash-reconciliation-physicalCount" type="number" min="0" inputMode="decimal" value={physicalCount} onChange={(event) => { setPhysicalCount(event.target.value); setFieldErrors((current) => ({ ...current, physicalCount: '' })); }} placeholder="Contoh: 500000" aria-invalid={Boolean(fieldErrors.physicalCount)} aria-describedby={fieldErrors.physicalCount ? 'cash-reconciliation-physicalCount-error' : undefined} />{fieldErrors.physicalCount && <small className="cash-reconciliation-error" id="cash-reconciliation-physicalCount-error" role="alert">{fieldErrors.physicalCount}</small>}</label>
        <label htmlFor="cash-reconciliation-note">Catatan <span className="account-optional-label">(opsional)</span><input id="cash-reconciliation-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Contoh: tutup kas hari ini" /></label>
      </div>
      <button className="btn btn-primary" disabled={saving || !accounts.length}>{saving ? 'Menyimpan...' : 'Simpan hasil hitung kas'}</button>
      {!accounts.length && <p className="cash-reconciliation-error" role="alert">Akun kas belum tersedia. Muat ulang halaman atau hubungi admin.</p>}
      {error && <p className="cash-reconciliation-error" role="alert">{error}</p>}
      {result && <output className={`cash-reconciliation-result${difference < 0 ? ' negative' : difference > 0 ? ' is-over' : ''}`}><strong>{resultLabel}</strong><span>Catatan sistem {money(result.systemBalance)} · Uang dihitung {money(result.physicalCount)}</span></output>}
    </form>
  );
}

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
