import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AdminSidebar from '../components/AdminSidebar';
import { apiFetch } from '../services/api';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const compactMoney = (value) => {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1000000) return `Rp ${(amount / 1000000).toFixed(1)} jt`;
  if (Math.abs(amount) >= 1000) return `Rp ${(amount / 1000).toFixed(0)} rb`;
  return `Rp ${amount.toLocaleString('id-ID')}`;
};
export default function AdminFinanceReportsPage() {
  const [tab, setTab] = useState('profit-loss');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    apiFetch(`/finance/reports/${tab === 'forecast' ? 'forecast?months=3' : tab === 'compare' ? 'compare?count=6' : tab === 'cashflow' ? 'cashflow-statement' : 'profit-loss'}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Laporan gagal dimuat.');
        if (active) setData(result.data || []);
      })
      .catch((reason) => {
        if (active) {
          setData(null);
          setError(reason.message);
        }
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [tab]);
  const rows = tab === 'profit-loss' && data && !Array.isArray(data)
    ? [
        ...(data.income || []).map((row) => ({ ...row, label: `Pendapatan - ${row.category}`, income: row.amount, expense: 0, net: row.amount })),
        ...(data.expenses || []).map((row) => ({ ...row, label: `Pengeluaran - ${row.category}`, income: 0, expense: row.amount, net: -row.amount })),
        { label: 'Laba bersih', income: data.totalIncome || 0, expense: data.totalExpense || 0, net: data.netProfit || 0 },
      ]
    : Array.isArray(data) ? data : [];
  const chartRows = rows.map((row, index) => ({ ...row, chartLabel: row.period || row.label || row.category || `Periode ${index + 1}`, chartValue: Number(row.net ?? row.income ?? row.amount ?? 0) }));
  const chartTick = (value) => String(value).length > 18 ? `${String(value).slice(0, 16)}...` : value;
  return <div className="admin-shell admin-crud-shell"><AdminSidebar active="Laporan Keuangan" /><main className="admin-main"><header className="admin-header"><div><p className="eyebrow light">Finance intelligence</p><h1>Laporan Keuangan</h1><p className="admin-subtitle">Laba rugi, arus kas, perbandingan, dan proyeksi.</p></div></header><div className="tab-strip">{[['profit-loss', 'Laba Rugi'], ['cashflow', 'Arus Kas'], ['compare', 'Perbandingan'], ['forecast', 'Proyeksi']].map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</div>{error && <div className="crud-notice" role="alert">{error}</div>}<section className="crud-table-panel">{loading ? <p>Memuat laporan dari database...</p> : <><div className="product-table-wrap"><table className="product-table"><thead><tr><th>Periode/Kategori</th><th>Pendapatan</th><th>Pengeluaran</th><th>Net</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.period || row.category || row.accountId || row.label || index}><td>{row.label || row.period || row.category || row.accountName || `Bulan ${row.month}`}</td><td>{money(row.income || row.amount)}</td><td>{money(row.expense || row.operatingExpense)}</td><td>{money(row.net ?? (row.income || 0) - (row.expense || row.operatingExpense || 0))}</td></tr>)}</tbody></table></div>{rows.length === 0 && <p>Belum ada data untuk periode ini.</p>}<div className="finance-investment-chart"><ResponsiveContainer><AreaChart data={chartRows} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}><defs><linearGradient id="financeAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#168c5c" stopOpacity={0.35} /><stop offset="100%" stopColor="#168c5c" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e8eee9" /><XAxis dataKey="chartLabel" tickFormatter={chartTick} tick={{ fill: '#87918a', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={compactMoney} tick={{ fill: '#87918a', fontSize: 11 }} axisLine={false} tickLine={false} width={72} /><Tooltip formatter={(value) => money(value)} labelFormatter={(label) => `Periode: ${label}`} contentStyle={{ border: '1px solid #dce9df', borderRadius: 12, boxShadow: '0 8px 22px rgba(36,45,40,.1)' }} /><Area type="monotone" dataKey="chartValue" name="Nilai bersih" stroke="#168c5c" strokeWidth={3} fill="url(#financeAreaGradient)" dot={{ r: 4, fill: '#fff', stroke: '#168c5c', strokeWidth: 2 }} activeDot={{ r: 6 }} /></AreaChart></ResponsiveContainer></div></>}</section></main></div>;
}
