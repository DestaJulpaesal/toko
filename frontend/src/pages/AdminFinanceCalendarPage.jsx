import { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { apiFetch } from '../services/api';
export default function AdminFinanceCalendarPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [days, setDays] = useState({});
  useEffect(() => { const [year, value] = month.split('-'); apiFetch(`/finance/calendar?month=${value}&year=${year}`).then((response) => response.json()).then((result) => setDays(result.data || {})); }, [month]);
  const [year, currentMonth] = month.split('-').map(Number); const total = new Date(year, currentMonth, 0).getDate();
  return <div className="admin-shell admin-crud-shell"><AdminSidebar active="Kalender Keuangan" /><main className="admin-main"><header className="admin-header"><div><p className="eyebrow light">Finance calendar</p><h1>Kalender Keuangan</h1></div><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></header><section className="calendar-grid">{Array.from({ length: total }, (_, index) => { const day = index + 1; const key = `${year}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`; return <article key={key} className="calendar-cell"><strong>{day}</strong>{(days[key] || []).map((item) => <small key={`${item.kind}-${item.id}`} className={`calendar-badge ${item.kind.toLowerCase()}`}>{item.description || item.title || item.kind}</small>)}</article>; })}</section></main></div>;
}
