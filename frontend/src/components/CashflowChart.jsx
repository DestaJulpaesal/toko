import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function CashflowChart({ data = [] }) {
  return <div style={{ width: '100%', height: 280 }}><ResponsiveContainer><LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="income" stroke="#198754" name="Pendapatan" /><Line type="monotone" dataKey="expense" stroke="#dc3545" name="Pengeluaran" /></LineChart></ResponsiveContainer></div>;
}
