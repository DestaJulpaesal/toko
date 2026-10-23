import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

function formatDate(value, compact = false) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return value || '';
  return new Date(year, month - 1, day).toLocaleDateString('id-ID', compact
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'long', year: 'numeric' });
}

function CashflowTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const income = Number(payload.find((item) => item.dataKey === 'income')?.value || 0);
  const expense = Number(payload.find((item) => item.dataKey === 'expense')?.value || 0);

  return (
    <div className="cashflow-chart-tooltip">
      <strong>{formatDate(label)}</strong>
      <span className="is-income"><i /> Uang masuk <b>{money(income)}</b></span>
      <span className="is-expense"><i /> Uang keluar <b>{money(expense)}</b></span>
    </div>
  );
}

function compactAmount(value) {
  if (value >= 1000000) return `Rp ${(value / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (value >= 1000) return `Rp ${(value / 1000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
  return `Rp ${value}`;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function CashflowChart({ data = [] }) {
  if (!data.length) {
    return <div className="cashflow-chart-empty">Belum ada data pergerakan uang untuk ditampilkan.</div>;
  }

  const valuesByDate = new Map(data.map((item) => [item.date, item]));
  const today = new Date();
  const chartData = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29 + index);
    const key = dateKey(date);
    const value = valuesByDate.get(key);
    return { date: key, income: Number(value?.income || 0), expense: Number(value?.expense || 0) };
  });

  return (
    <div className="cashflow-chart">
      <div className="cashflow-chart-legend"><span className="is-income"><i /> Uang masuk</span><span className="is-expense"><i /> Uang keluar</span></div>
      <div className="cashflow-chart-plot">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="cashflowIncomeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#23814c" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#23814c" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="cashflowExpenseFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#df9b3e" stopOpacity={0.16} />
                <stop offset="95%" stopColor="#df9b3e" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#edf1eb" strokeDasharray="4 5" />
            <XAxis dataKey="date" tickFormatter={(value) => formatDate(value, true)} tickLine={false} axisLine={false} tick={{ fill: '#89948b', fontSize: 11 }} minTickGap={30} />
            <YAxis tickFormatter={compactAmount} tickLine={false} axisLine={false} width={74} tick={{ fill: '#89948b', fontSize: 10 }} />
            <Tooltip content={<CashflowTooltip />} cursor={{ stroke: '#cbd8ca', strokeDasharray: '4 4' }} />
            <Area type="monotone" dataKey="income" name="Uang masuk" stroke="#27834d" strokeWidth={2.5} fill="url(#cashflowIncomeFill)" activeDot={{ r: 5, strokeWidth: 0 }} />
            <Area type="monotone" dataKey="expense" name="Uang keluar" stroke="#d9983d" strokeWidth={2.5} fill="url(#cashflowExpenseFill)" activeDot={{ r: 5, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="cashflow-chart-caption">Hari tanpa transaksi ditampilkan sebagai Rp 0 agar pergerakan kas tetap mudah dibandingkan.</p>
    </div>
  );
}
