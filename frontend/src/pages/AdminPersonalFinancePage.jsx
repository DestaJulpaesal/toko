import { useEffect, useMemo, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { confirmAction } from '../utils/confirmService';
import CurrencyInput from '../components/CurrencyInput';

const storageKey = 'glosir_personal_savings';
const emptyForm = { name: '', target: '', dailyAmount: '' };
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function AdminPersonalFinancePage() {
  const [goals, setGoals] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(saved)) setGoals(saved);
    } catch { setGoals([]); }
  }, []);

  const persist = (nextGoals) => {
    setGoals(nextGoals);
    localStorage.setItem(storageKey, JSON.stringify(nextGoals));
  };

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const addGoal = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || Number(form.target) <= 0 || Number(form.dailyAmount) <= 0) {
      setNotice('Nama target, nominal target, dan setoran harian wajib diisi.');
      return;
    }
    if (!await confirmAction(`Buat target tabungan "${form.name}"?`)) return;
    const next = [{ id: `personal-${Date.now()}`, name: form.name.trim(), target: Number(form.target), dailyAmount: Number(form.dailyAmount), deposits: [] }, ...goals];
    persist(next); setForm(emptyForm); setNotice('Target pribadi berhasil dibuat.');
  };

  const toggleToday = async (goal) => {
    const today = new Date().toISOString().slice(0, 10);
    const alreadySaved = goal.deposits.includes(today);
    if (!await confirmAction(alreadySaved ? `Batalkan setoran hari ini untuk "${goal.name}"?` : `Ceklis setoran ${money(goal.dailyAmount)} untuk "${goal.name}"?`)) return;
    persist(goals.map((item) => item.id === goal.id ? { ...item, deposits: alreadySaved ? item.deposits.filter((date) => date !== today) : [...item.deposits, today] } : item));
    setNotice(alreadySaved ? 'Ceklis setoran hari ini dibatalkan.' : 'Setoran hari ini berhasil dicatat.');
  };

  const removeGoal = async (goal) => {
    if (!await confirmAction(`Hapus target pribadi "${goal.name}"?`)) return;
    persist(goals.filter((item) => item.id !== goal.id));
    setNotice('Target pribadi berhasil dihapus.');
  };

  const totals = useMemo(() => goals.reduce((result, goal) => {
    result.saved += goal.deposits.length * goal.dailyAmount;
    result.target += goal.target;
    return result;
  }, { saved: 0, target: 0 }), [goals]);

  return <div className="admin-shell admin-crud-shell"><AdminSidebar active="Catatan Pribadi" /><main className="admin-main">
    <header className="admin-header"><div><p className="eyebrow light">Personal planning</p><h1>Catatan Pribadi & Tabungan</h1><p className="admin-subtitle">Atur target seperti UKT, cicilan, dana sekolah, atau kebutuhan keluarga.</p></div></header>
    {notice && <div className="crud-notice" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}
    <section className="metric-grid"><div className="metric-card green"><span>Total terkumpul</span><strong>{money(totals.saved)}</strong></div><div className="metric-card blue"><span>Total target</span><strong>{money(totals.target)}</strong></div><div className="metric-card orange"><span>Sisa target</span><strong>{money(Math.max(totals.target - totals.saved, 0))}</strong></div></section>
    <section className="personal-layout"><form className="crud-form-panel" onSubmit={addGoal}><div className="panel-heading"><div><span className="panel-kicker">Target baru</span><h2>Buat daftar tabungan</h2></div></div><label>Nama target<input name="name" value={form.name} onChange={updateField} placeholder="Bayar UKT Anak" /></label><label>Total target<CurrencyInput name="target" value={form.target} onValueChange={(value) => setForm((current) => ({ ...current, target: value }))} placeholder="Rp 5.000.000" /></label><label>Setoran harian<CurrencyInput name="dailyAmount" value={form.dailyAmount} onValueChange={(value) => setForm((current) => ({ ...current, dailyAmount: value }))} placeholder="Rp 100.000" /></label><button className="btn btn-primary full">Tambah target</button></form>
    <section className="personal-goals">{goals.length === 0 && <div className="personal-empty"><strong>Belum ada target pribadi.</strong><span>Buat target pertama, lalu setiap hari tinggal klik ceklis setor.</span></div>}{goals.map((goal) => { const saved = goal.deposits.length * goal.dailyAmount; const progress = Math.min((saved / goal.target) * 100, 100); const today = new Date().toISOString().slice(0, 10); const checked = goal.deposits.includes(today); return <article className="personal-goal-card" key={goal.id}><div className="personal-goal-head"><div><span className="panel-kicker">Target pribadi</span><h2>{goal.name}</h2></div><button className="text-button" onClick={() => removeGoal(goal)}>Hapus</button></div><div className="personal-goal-numbers"><strong>{money(saved)}</strong><span>dari {money(goal.target)}</span><b>{Math.round(progress)}%</b></div><div className="personal-progress"><span style={{ width: `${progress}%` }} /></div><div className="personal-goal-foot"><span>Setoran harian: <b>{money(goal.dailyAmount)}</b></span><button className={`btn ${checked ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleToday(goal)}>{checked ? '✓ Sudah setor hari ini' : 'Ceklis setor hari ini'}</button></div><small>{goal.deposits.length} kali setor tercatat · Sisa {money(Math.max(goal.target - saved, 0))}</small></article>; })}</section></section>
  </main></div>;
}
