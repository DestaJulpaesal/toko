import { useEffect, useState } from 'react';
import CurrencyInput from './CurrencyInput';
import { apiFetch } from '../services/api';
import { confirmAction } from '../utils/confirmService';

const emptyDebt = { amount: '', dueDate: '', description: '' };

export default function DebtModal({ isOpen, customer, debt, onClose, onSaved }) {
  const [form, setForm] = useState(emptyDebt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) setForm(debt ? { amount: debt.amount, dueDate: debt.dueDate ? String(debt.dueDate).slice(0, 10) : '', description: debt.description || '' } : emptyDebt);
  }, [debt, isOpen]);

  if (!isOpen || !customer) return null;

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) { setError('Jumlah utang wajib diisi.'); return; }
    if (!await confirmAction(`${debt ? 'Perbarui' : 'Tambah'} catatan utang ${customer.name}?`)) return;
    setSaving(true); setError('');
    try {
      const response = await apiFetch(debt ? `/debts/${debt.id}` : '/debts', {
        method: debt ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, customerId: customer.id, amount: Number(form.amount) }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Catatan utang gagal disimpan.');
      onSaved(debt ? 'Catatan utang berhasil diperbarui.' : 'Catatan utang berhasil ditambahkan.');
      onClose();
    } catch (saveError) { setError(saveError.message || 'Catatan utang gagal disimpan.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="crud-modal-backdrop debt-action-modal" onClick={onClose}>
      <form className="crud-modal-box" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <div className="panel-heading"><div><span className="panel-kicker">{debt ? 'Edit catatan utang' : 'Tambah catatan utang'}</span><h2>{customer.name}</h2><p>{debt ? 'Perubahan hanya memengaruhi catatan utang ini. Status lunas berubah setelah pembayaran dicatat.' : 'Utang baru otomatis berstatus Belum lunas. Catat pembayaran saat pelanggan membayar.'}</p></div><button type="button" className="text-button" onClick={onClose}>Tutup</button></div>
        <label>Jumlah utang<CurrencyInput name="amount" value={form.amount} onValueChange={(value) => setForm((current) => ({ ...current, amount: value }))} placeholder="Rp 420.000" /></label>
        <div className="debt-recorded-date"><span>Tanggal dicatat</span><strong>{debt?.createdAt ? new Date(debt.createdAt).toLocaleDateString('id-ID') : new Date().toLocaleDateString('id-ID')}</strong></div>
        <label>Jatuh tempo (opsional)<input name="dueDate" type="date" value={form.dueDate} onChange={updateField} /></label>
        <label>Keterangan<textarea name="description" rows="3" value={form.description} onChange={updateField} placeholder="Contoh: pembelian beras tempo" /></label>
        {error && <p className="form-error">{error}</p>}
        <div className="crud-modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : debt ? 'Simpan perubahan utang' : 'Simpan catatan utang'}</button></div>
      </form>
    </div>
  );
}
