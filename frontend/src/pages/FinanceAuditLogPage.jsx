import { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { apiFetch } from '../services/api';
export default function FinanceAuditLogPage() {
  const [rows, setRows] = useState([]);
  useEffect(() => { apiFetch('/finance/audit-log').then((response) => response.json()).then((result) => setRows(result.data || [])); }, []);
  return <div className="admin-shell admin-crud-shell"><AdminSidebar active="Audit Keuangan" /><main className="admin-main"><header className="admin-header"><div><p className="eyebrow light">Finance audit</p><h1>Riwayat Perubahan Keuangan</h1></div></header><section className="crud-table-panel"><table className="product-table"><thead><tr><th>Waktu</th><th>Entity</th><th>Aksi</th><th>ID</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{new Date(row.createdAt).toLocaleString('id-ID')}</td><td>{row.entityType}</td><td>{row.action}</td><td>{row.entityId}</td></tr>)}</tbody></table></section></main></div>;
}
