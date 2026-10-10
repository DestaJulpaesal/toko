import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const compactMoney = (value) => {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1000000) return `Rp ${(amount / 1000000).toFixed(1)} jt`;
  if (Math.abs(amount) >= 1000) return `Rp ${(amount / 1000).toFixed(0)} rb`;
  return `Rp ${amount.toLocaleString('id-ID')}`;
};

function CashflowTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="finance-chart-tooltip"><strong>{label}</strong>{payload.map((item) => <span key={item.dataKey}><i style={{ background: item.color }} />{item.name}: <b>{money(item.value)}</b></span>)}</div>;
}

export default function CashflowChart({ data = [] }) {
  return <div className="finance-chart finance-cashflow-chart">
    <ResponsiveContainer>
      <AreaChart data={data} margin={{ top: 14, right: 12, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="cashflowIncomeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2f9a61" stopOpacity={0.28} /><stop offset="100%" stopColor="#2f9a61" stopOpacity={0.02} /></linearGradient>
          <linearGradient id="cashflowExpenseGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d86659" stopOpacity={0.2} /><stop offset="100%" stopColor="#d86659" stopOpacity={0.02} /></linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#e9eee9" />
        <XAxis dataKey="date" tick={{ fill: '#87918a', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={compactMoney} tick={{ fill: '#87918a', fontSize: 11 }} axisLine={false} tickLine={false} width={68} />
        <Tooltip content={<CashflowTooltip />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Area type="monotone" dataKey="income" name="Pendapatan" stroke="#2f9a61" strokeWidth={2.5} fill="url(#cashflowIncomeGradient)" activeDot={{ r: 5 }} />
        <Area type="monotone" dataKey="expense" name="Pengeluaran" stroke="#d86659" strokeWidth={2.5} fill="url(#cashflowExpenseGradient)" activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}
