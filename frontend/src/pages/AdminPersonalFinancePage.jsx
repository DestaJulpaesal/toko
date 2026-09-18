import { useEffect, useMemo, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { confirmAction } from '../utils/confirmService';
import CurrencyInput from '../components/CurrencyInput';
import { apiFetch } from '../services/api';

const storageKey = 'glosir_personal_savings';
const emptyForm = { name: '', targetAmount: '', dailyAmount: '' };
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const readableDate = (value) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));

export default function AdminPersonalFinancePage() {
  const [goals, setGoals] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [addingGoal, setAddingGoal] = useState(false);
  const [depositingId, setDepositingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/savings/goals');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Target tabungan gagal dimuat.');
      setGoals(data.data || data.goals || []);
    } catch (error) {
      setNotice(error.message || 'Target tabungan gagal dimuat dari backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    let legacy;
    try { legacy = JSON.parse(raw); } catch { legacy = null; }
    if (!Array.isArray(legacy) || !legacy.length) return;
    confirmAction('Ditemukan data tabungan lama di perangkat ini, mau dipindahkan ke akun kamu?').then(async (confirmed) => {
      if (!confirmed) return;
      if (importing) return;
      setImporting(true);
      try {
        const response = await apiFetch('/savings/import-local', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(legacy) });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Import data lama gagal.');
        window.localStorage.removeItem(storageKey);
        setNotice(`${data.count || 0} target tabungan lama berhasil dipindahkan.`);
        await load();
      } catch (error) { setNotice(error.message || 'Import data lama gagal.'); }
      finally { setImporting(false); }
    });
  }, []);

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const addGoal = async (event) => {
    event.preventDefault();
    if (addingGoal) return;
    if (!form.name.trim() || Number(form.targetAmount) <= 0 || Number(form.dailyAmount) <= 0) {
      setNotice('Nama target, nominal target, dan setoran harian wajib diisi.');
      return;
    }
    if (!await confirmAction(`Buat target tabungan "${form.name}"?`)) return;
    setAddingGoal(true);
    try {
      const response = await apiFetch('/savings/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name.trim(), targetAmount: Number(form.targetAmount), dailyAmount: Number(form.dailyAmount) }) });
      const data = await response.json();
      if (!response.ok || !data.success) { setNotice(data.message || 'Target gagal dibuat.'); return; }
      setForm(emptyForm); setNotice('Target pribadi berhasil dibuat.'); await load();
    } finally { setAddingGoal(false); }
  };
  const toggleToday = async (goal) => {
    const existing = (goal.deposits || []).find((deposit) => (deposit.date || deposit.depositDate || '').slice(0, 10) === today());
    if (depositingId) return;
    if (existing || !await confirmAction(`Catat setoran ${money(goal.dailyAmount)} untuk "${goal.name}"?`)) return;
    setDepositingId(goal.id);
    try {
      const response = await apiFetch(`/savings/goals/${goal.id}/deposit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today() }) });
      const data = await response.json();
      if (!response.ok || !data.success) { setNotice(data.message || 'Setoran gagal diperbarui.'); return; }
      setNotice(existing ? 'Ceklis setoran hari ini dibatalkan.' : 'Setoran hari ini berhasil dicatat.'); await load();
    } finally { setDepositingId(null); }
  };
  const removeGoal = async (goal) => {
    if (deletingId) return;
    if (!await confirmAction(`Hapus target pribadi "${goal.name}"?`)) return;
    setDeletingId(goal.id);
    try {
      const response = await apiFetch(`/savings/goals/${goal.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) { setNotice(data.message || 'Target gagal dihapus.'); return; }
      setNotice('Target pribadi berhasil dihapus.'); await load();
    } finally { setDeletingId(null); }
  };
  const totals = useMemo(() => goals.reduce((result, goal) => {
    result.saved += Number(goal.totalSaved || 0);
    result.target += Number(goal.targetAmount || goal.target || 0);
    return result;
  }, { saved: 0, target: 0 }), [goals]);
  const overallProgress = totals.target ? Math.min((totals.saved / totals.target) * 100, 100) : 0;
  const completedGoals = goals.filter((goal) => Number(goal.totalSaved || 0) >= Number(goal.targetAmount || goal.target || 0)).length;

  return <div className="admin-shell admin-crud-shell"><AdminSidebar active="Catatan Pribadi" /><main className="admin-main">
    <header className="admin-header personal-page-header"><div><p className="eyebrow light">Ruang finansial pribadi</p><h1>Catatan Pribadi & Tabungan</h1><p className="admin-subtitle">Satu tempat untuk melihat tujuan, kebiasaan, dan progres uang kamu.</p></div><span className="database-status ready"><i /> {loading ? 'Memuat data' : 'Data tersinkron'}</span></header>
    {notice && <div className="crud-notice" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}
    <section className="personal-overview"><div className="personal-overview-copy"><span className="panel-kicker">Ringkasan progres</span><strong>{money(totals.saved)}</strong><p>Sudah terkumpul dari total target {money(totals.target)}</p><div className="personal-overview-meta"><span>{goals.length} target aktif</span><span>{completedGoals} target selesai</span></div></div><div className="personal-overview-ring" style={{ '--progress': `${overallProgress}%` }}><div><strong>{Math.round(overallProgress)}%</strong><span>progres total</span></div></div></section>
    <section className="personal-layout"><form className="crud-form-panel personal-form-panel" onSubmit={addGoal}><div className="panel-heading"><div><span className="panel-kicker">Mulai dari sini</span><h2>Buat target baru</h2></div></div><p className="personal-form-intro">Tentukan tujuan kecil yang ingin kamu capai, lalu catat setoran setiap hari.</p><label>Nama target<input name="name" value={form.name} onChange={updateField} placeholder="Contoh: Dana pendidikan" /></label><label>Total target<CurrencyInput name="targetAmount" value={form.targetAmount} onValueChange={(value) => setForm((current) => ({ ...current, targetAmount: value }))} placeholder="Rp 5.000.000" /></label><label>Setoran harian<CurrencyInput name="dailyAmount" value={form.dailyAmount} onValueChange={(value) => setForm((current) => ({ ...current, dailyAmount: value }))} placeholder="Rp 100.000" /></label><button className="btn btn-primary full" disabled={addingGoal}>{addingGoal ? 'Menyimpan...' : 'Simpan target'}</button></form>
    <section className="personal-goals"><div className="personal-section-heading"><div><span className="panel-kicker">Perjalanan kamu</span><h2>Target tabungan</h2></div><span>{goals.length} target</span></div>{goals.length === 0 && <div className="personal-empty"><strong>Belum ada target pribadi.</strong><span>Buat target pertama, lalu mulai bangun kebiasaan menabung.</span></div>}{goals.map((goal) => { const saved = Number(goal.totalSaved || 0); const target = Number(goal.targetAmount || goal.target || 0); const progress = Math.min((saved / target) * 100, 100); const checked = (goal.deposits || []).some((deposit) => (deposit.date || deposit.depositDate || '').slice(0, 10) === today()); const complete = progress >= 100; const deposits = [...(goal.deposits || [])].sort((a, b) => String(b.date || b.depositDate).localeCompare(String(a.date || a.depositDate))); return <article className={`personal-goal-card ${complete ? 'is-complete' : ''}`} key={goal.id}><div className="personal-goal-head"><div><span className="personal-goal-status">{complete ? 'Target tercapai' : 'Sedang berjalan'}</span><h2>{goal.name}</h2></div><button className="text-button" type="button" onClick={() => removeGoal(goal)} disabled={deletingId === goal.id}>{deletingId === goal.id ? 'Menghapus...' : 'Hapus'}</button></div><div className="personal-goal-numbers"><strong>{money(saved)}</strong><span>dari {money(target)}</span><b>{Math.round(progress)}%</b></div><div className="personal-progress"><span style={{ width: `${progress}%` }} /></div><div className="personal-goal-details"><span>Setoran harian <b>{money(goal.dailyAmount)}</b></span><span>Sisa <b>{money(Math.max(target - saved, 0))}</b></span></div><div className="personal-goal-foot"><small>Hari ini, {readableDate(today())}</small><button type="button" disabled={checked || Boolean(depositingId)} className={`btn ${checked ? 'btn-deposit-done' : 'btn-primary'}`} onClick={() => toggleToday(goal)}>{depositingId === goal.id ? 'Menyimpan...' : checked ? '✓ Sudah dicatat hari ini' : 'Catat setoran hari ini'}</button></div><div className="personal-deposit-history"><div className="personal-history-heading"><span>Riwayat setoran</span><b>{deposits.length} hari</b></div>{deposits.length ? <div className="personal-history-list">{deposits.slice(0, 5).map((deposit) => <div className="personal-history-row" key={deposit.id}><span className="personal-history-check">✓</span><span>{readableDate((deposit.date || deposit.depositDate).slice(0, 10))}</span><strong>{money(deposit.amount)}</strong><small>Done</small></div>)}</div> : <p className="personal-history-empty">Belum ada setoran tercatat.</p>}{deposits.length > 5 && <small className="personal-history-more">+{deposits.length - 5} setoran sebelumnya</small>}</div></article>; })}</section></section>
  </main></div>;
}
