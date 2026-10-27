import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, RefreshCw, Target, TrendingUp } from 'lucide-react';
import AdminShell from '../layouts/AdminShell';
import { confirmAction } from '../utils/confirmService';
import CurrencyInput from '../components/CurrencyInput';
import ModalForm from '../components/ModalForm';
import { apiFetch } from '../services/api';
import { getExpectedSavingsAmount, getSavingsDepositsInRange, getSavingsPeriodRange } from '../utils/savingsPeriod';

const storageKey = 'glosir_personal_savings';
const emptyForm = { name: '', targetAmount: '', dailyAmount: '', contributionFrequency: 'DAILY' };
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const frequencyLabels = { DAILY: 'Harian', WEEKLY: 'Mingguan', MONTHLY: 'Bulanan', YEARLY: 'Tahunan' };
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const readableDate = (value) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
const periodLabel = (period, date = new Date()) => {
  if (period === 'week') return '7 hari terakhir';
  if (period === 'year') return `Tahun ${date.getFullYear()}`;
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
};

export default function AdminPersonalFinancePage() {
  const [goals, setGoals] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [addingGoal, setAddingGoal] = useState(false);
  const [depositingId, setDepositingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/savings/goals');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Target tabungan gagal dimuat.');
      setGoals(data.data || data.goals || []);
      setLoadFailed(false);
    } catch (error) {
      setLoadFailed(true);
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
      setNotice('Nama target, total target, dan nominal setoran wajib diisi.');
      return;
    }
    if (!await confirmAction(`Buat target tabungan "${form.name}"?`)) return;
    setAddingGoal(true);
    try {
      const response = await apiFetch('/savings/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name.trim(), targetAmount: Number(form.targetAmount), contributionAmount: Number(form.dailyAmount), contributionFrequency: form.contributionFrequency }) });
      const data = await response.json();
      if (!response.ok || !data.success) { setNotice(data.message || 'Target gagal dibuat.'); return; }
      setForm(emptyForm); setGoalModalOpen(false); setNotice('Target pribadi berhasil dibuat.'); await load();
    } catch (error) {
      setNotice(error.message || 'Target gagal dibuat. Periksa koneksi lalu coba lagi.');
    } finally { setAddingGoal(false); }
  };
  const toggleToday = async (goal) => {
    const existing = (goal.deposits || []).find((deposit) => (deposit.date || deposit.depositDate || '').slice(0, 10) === today());
    if (depositingId) return;
    if (existing || !await confirmAction(`Catat setoran ${money(goal.contributionAmount ?? goal.dailyAmount)} (${frequencyLabels[goal.contributionFrequency] || 'Harian'}) untuk "${goal.name}"?`)) return;
    setDepositingId(goal.id);
    try {
      const response = await apiFetch(`/savings/goals/${goal.id}/deposit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today(), amount: Number(goal.contributionAmount ?? goal.dailyAmount) }) });
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
  const selectedRange = getSavingsPeriodRange(selectedPeriod);
  const selectedPeriodName = periodLabel(selectedPeriod);
  const periodTotals = goals.reduce((result, goal) => {
    const frequency = goal.contributionFrequency || 'DAILY';
    result.target += getExpectedSavingsAmount(goal.contributionAmount ?? goal.dailyAmount, frequency, selectedRange.elapsedDays);
    result.saved += getSavingsDepositsInRange(goal.deposits || [], selectedRange).reduce((sum, deposit) => sum + Number(deposit.amount || 0), 0);
    return result;
  }, { target: 0, saved: 0 });
  const periodProgress = periodTotals.target ? Math.min(periodTotals.saved / periodTotals.target * 100, 100) : 0;

  return <AdminShell active="Catatan Pribadi" className="admin-crud-shell personal-finance-shell">
    <header className="admin-header personal-page-header">
      <div><p className="eyebrow light">Ruang finansial pribadi</p><h1>Catatan Pribadi & Tabungan</h1><p className="admin-subtitle">Satu tempat untuk melihat tujuan, kebiasaan, dan progres uang kamu.</p></div>
      <div className="personal-header-actions"><span className={`database-status ${loading ? 'loading' : loadFailed ? 'error' : 'ready'}`}><i /> {loading ? 'Memuat data' : loadFailed ? 'Gagal tersinkron' : 'Data tersinkron'}</span><button className="personal-refresh-button" type="button" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? 'is-spinning' : ''} />{loading ? 'Memuat...' : 'Muat ulang'}</button></div>
    </header>
    {notice && <div className="crud-notice" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}
    <section className="personal-overview">
      <div className="personal-overview-copy"><span className="panel-kicker">Ringkasan progres</span><strong>{money(totals.saved)}</strong><p>Sudah terkumpul dari total target {money(totals.target)}</p><div className="personal-overview-meta"><span>{goals.length} target aktif</span><span>{completedGoals} target selesai</span></div></div>
      <div className="personal-overview-ring" style={{ '--progress': `${overallProgress}%` }}><div><strong>{Math.round(overallProgress)}%</strong><span>progres total</span></div></div>
    </section>
    <section className="personal-monthly-plan" aria-label={`Rencana setoran ${selectedPeriodName}`}>
      <div className="personal-monthly-icon"><CalendarDays size={20} /></div>
      <div className="personal-monthly-content">
        <div className="personal-monthly-heading">
          <div><span className="panel-kicker">Rencana setoran</span><h2>{selectedPeriodName}</h2></div>
          <label className="personal-period-select">Rentang
            <select value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value)} aria-label="Pilih rentang progres">
              <option value="week">7 hari terakhir</option>
              <option value="month">Bulan ini</option>
              <option value="year">Tahun ini</option>
            </select>
          </label>
          <span className="personal-monthly-count">{goals.length} target</span>
        </div>
        <div className="personal-monthly-values"><span>Terkumpul <strong>{money(periodTotals.saved)}</strong></span><span>Rencana periode <strong>{money(periodTotals.target)}</strong></span><b>{Math.round(periodProgress)}%</b></div>
        <div className="personal-monthly-progress" role="progressbar" aria-valuenow={Math.round(periodProgress)} aria-valuemin="0" aria-valuemax="100" aria-label={`Progres rencana setoran ${selectedPeriodName}`}><span style={{ width: `${periodProgress}%` }} /></div>
        <small>Rencana mengikuti frekuensi tiap target dan dihitung proporsional sampai hari ini; setoran bisa dicatat kapan saja.</small>
      </div>
      <div className="personal-monthly-total"><span>Sisa rencana periode</span><strong>{money(Math.max(periodTotals.target - periodTotals.saved, 0))}</strong></div>
    </section>
    <section className="personal-goals">
      <div className="personal-section-heading">
        <div><span className="panel-kicker">Perjalanan kamu</span><h2>Target tabungan</h2></div>
        <div className="personal-goals-heading-actions"><span>{goals.length} target</span><button type="button" className="btn btn-primary" onClick={() => { setForm(emptyForm); setNotice(''); setGoalModalOpen(true); }}><Plus size={16} /> Buat target</button></div>
      </div>
      {loading && goals.length === 0 && <div className="personal-empty" role="status"><span className="personal-loading-indicator" /><strong>Memuat target tabungan...</strong><span>Data kamu sedang disiapkan.</span></div>}
      {!loading && loadFailed && goals.length === 0 && <div className="personal-empty"><strong>Target belum bisa ditampilkan.</strong><span>Periksa koneksi, lalu coba muat ulang data.</span><button className="personal-empty-retry" type="button" onClick={load}>Coba lagi</button></div>}
      {!loading && !loadFailed && goals.length === 0 && <div className="personal-empty"><Target size={24} /><strong>Belum ada target pribadi.</strong><span>Buat target pertama, lalu mulai bangun kebiasaan menabung.</span><button type="button" className="btn btn-primary" onClick={() => setGoalModalOpen(true)}><Plus size={15} /> Buat target pertama</button></div>}
      {goals.map((goal) => {
        const saved = Number(goal.totalSaved || 0);
        const target = Number(goal.targetAmount || goal.target || 0);
        const progress = target ? Math.min((saved / target) * 100, 100) : 0;
        const deposits = [...(goal.deposits || [])].sort((a, b) => String(b.date || b.depositDate).localeCompare(String(a.date || a.depositDate)));
        const contributionAmount = Number(goal.contributionAmount ?? goal.dailyAmount ?? 0);
        const frequency = goal.contributionFrequency || 'DAILY';
        const periodDeposits = getSavingsDepositsInRange(deposits, selectedRange);
        const periodSaved = periodDeposits.reduce((sum, deposit) => sum + Number(deposit.amount || 0), 0);
        const periodTarget = getExpectedSavingsAmount(contributionAmount, frequency, selectedRange.elapsedDays);
        const goalPeriodProgress = periodTarget ? Math.min(periodSaved / periodTarget * 100, 100) : 0;
        const checked = deposits.some((deposit) => (deposit.date || deposit.depositDate || '').slice(0, 10) === today());
        const complete = progress >= 100;
        return <article className={`personal-goal-card ${complete ? 'is-complete' : ''}`} key={goal.id}>
          <div className="personal-goal-head"><div><span className="personal-goal-status">{complete ? 'Target tercapai' : 'Sedang berjalan'}</span><h2>{goal.name}</h2></div><button className="text-button" type="button" onClick={() => removeGoal(goal)} disabled={deletingId === goal.id}>{deletingId === goal.id ? 'Menghapus...' : 'Hapus'}</button></div>
          <div className="personal-goal-numbers"><strong>{money(saved)}</strong><span>dari {money(target)}</span><b>{Math.round(progress)}%</b></div>
          <div className="personal-progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin="0" aria-valuemax="100" aria-label={`Progres ${goal.name}`}><span style={{ width: `${progress}%` }} /></div>
          <div className="personal-goal-details"><span>Setoran {frequencyLabels[frequency] || 'Harian'} <b>{money(contributionAmount)}</b></span><span>Sisa target <b>{money(Math.max(target - saved, 0))}</b></span></div>
          <div className="personal-goal-monthly">
            <div className="personal-goal-monthly-heading"><span><TrendingUp size={14} /> Progres {selectedPeriodName}</span><b>{Math.round(goalPeriodProgress)}%</b></div>
            <div className="personal-goal-monthly-progress" role="progressbar" aria-valuenow={Math.round(goalPeriodProgress)} aria-valuemin="0" aria-valuemax="100" aria-label={`Progres ${selectedPeriodName} ${goal.name}`}><span style={{ width: `${goalPeriodProgress}%` }} /></div>
            <div className="personal-goal-monthly-values"><span>{money(periodSaved)} terkumpul</span><span>dari rencana {money(periodTarget)}</span></div>
          </div>
          <div className="personal-goal-foot"><small>Hari ini, {readableDate(today())}</small><button type="button" disabled={checked || Boolean(depositingId)} className={`btn ${checked ? 'btn-deposit-done' : 'btn-primary'}`} onClick={() => toggleToday(goal)}>{depositingId === goal.id ? 'Menyimpan...' : checked ? '✓ Sudah dicatat hari ini' : 'Catat setoran hari ini'}</button></div>
          <div className="personal-deposit-history"><div className="personal-history-heading"><span>Riwayat setoran</span><b>{deposits.length} hari</b></div>{deposits.length ? <div className="personal-history-list">{deposits.slice(0, 5).map((deposit) => <div className="personal-history-row" key={deposit.id}><span className="personal-history-check">✓</span><span>{readableDate((deposit.date || deposit.depositDate).slice(0, 10))}</span><strong>{money(deposit.amount)}</strong><small>Dicatat</small></div>)}</div> : <p className="personal-history-empty">Belum ada setoran tercatat.</p>}{deposits.length > 5 && <small className="personal-history-more">+{deposits.length - 5} setoran sebelumnya</small>}</div>
        </article>;
      })}
    </section>
    <ModalForm
      isOpen={goalModalOpen}
      onClose={() => { if (!addingGoal) setGoalModalOpen(false); }}
      title="Buat target tabungan"
      subtitle="Tentukan tujuan dan rencana setoran yang nyaman untuk kamu."
      kicker="Target baru"
      maxWidth="560px"
      cardClassName="personal-goal-modal"
    >
      <form className="personal-goal-form" onSubmit={addGoal}>
        {notice && <div className="personal-goal-form-error" role="alert">{notice}</div>}
        <div className="personal-goal-form-tip"><CalendarDays size={17} /><span>Pilih frekuensi rencana setoran yang cocok. Kamu tetap bisa mencatat setoran kapan saja, terlepas dari jadwal yang dipilih.</span></div>
        <label>Nama target<input name="name" required maxLength="100" autoFocus value={form.name} onChange={updateField} placeholder="Contoh: Dana pendidikan" /></label>
        <label>Total target<CurrencyInput name="targetAmount" required value={form.targetAmount} onValueChange={(value) => setForm((current) => ({ ...current, targetAmount: value }))} placeholder="Rp 5.000.000" /></label>
        <label>Frekuensi setoran<select name="contributionFrequency" value={form.contributionFrequency} onChange={updateField}><option value="DAILY">Harian</option><option value="WEEKLY">Mingguan</option><option value="MONTHLY">Bulanan</option><option value="YEARLY">Tahunan</option></select></label>
        <label>Nominal per setoran<CurrencyInput name="dailyAmount" required value={form.dailyAmount} onValueChange={(value) => setForm((current) => ({ ...current, dailyAmount: value }))} placeholder="Rp 100.000" /><small>Nominal ini menjadi saran saat kamu mencatat setoran.</small></label>
        <div className="personal-goal-form-actions"><button type="button" className="btn btn-secondary" onClick={() => setGoalModalOpen(false)} disabled={addingGoal}>Batal</button><button className="btn btn-primary" disabled={addingGoal}>{addingGoal ? 'Menyimpan...' : 'Simpan target'}</button></div>
      </form>
    </ModalForm>
  </AdminShell>;
}
