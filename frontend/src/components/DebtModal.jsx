import { useEffect, useState } from 'react';
import CurrencyInput from './CurrencyInput';
import { apiFetch } from '../services/api';
import { confirmAction } from '../utils/confirmService';

const emptyDebt = { amount: '', status: 'OPEN', dueDate: '', description: '' };

export default function DebtModal({ isOpen, customer, debt, onClose, onSaved }) {
  const [form, setForm] = useState(emptyDebt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) setForm(debt ? { amount: debt.amount, status: debt.status, dueDate: debt.dueDate ? String(debt.dueDate).slice(0, 10) : '', description: debt.description || '' } : emptyDebt);
  }, [debt, isOpen]);

  if (!isOpen || !customer) return null;

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) { setError('Nominal piutang wajib diisi.'); return; }
    if (!await confirmAction(`${debt ? 'Perbarui' : 'Tambah'} piutang ${customer.name}?`)) return;
    setSaving(true); setError('');
    try {
      const response = await apiFetch(debt ? `/debts/${debt.id}` : '/debts', {
        method: debt ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, customerId: customer.id, amount: Number(form.amount) }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Piutang gagal disimpan.');
      onSaved(debt ? 'Piutang berhasil diperbarui.' : 'Piutang berhasil ditambahkan.');
      onClose();
    } catch (saveError) { setError(saveError.message || 'Piutang gagal disimpan.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="crud-modal-backdrop" onClick={onClose}>
      <form className="crud-modal-box" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <div className="panel-heading"><div><span className="panel-kicker">{debt ? 'Edit piutang' : 'Piutang baru'}</span><h2>{customer.name}</h2></div><button type="button" className="text-button" onClick={onClose}>Tutup</button></div>
        <label>Nominal piutang<CurrencyInput name="amount" value={form.amount} onValueChange={(value) => setForm((current) => ({ ...current, amount: value }))} placeholder="Rp 420.000" /></label>
        <div className="form-two-columns"><label>Status<select name="status" value={form.status} onChange={updateField}><option value="OPEN">Belum lunas</option><option value="PAID">Lunas</option></select></label><label>Jatuh tempo<input name="dueDate" type="date" value={form.dueDate} onChange={updateField} /></label></div>
        <label>Keterangan<textarea name="description" rows="3" value={form.description} onChange={updateField} placeholder="Contoh: pembelian beras tempo" /></label>
        {error && <p className="form-error">{error}</p>}
        <div className="crud-modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan piutang'}</button></div>
      </form>
    </div>
  );
}
