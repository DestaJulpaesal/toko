import { useEffect, useState } from 'react';
import AdminShell from '../layouts/AdminShell';
import { apiFetch } from '../services/api';
export default function FinanceAuditLogPage() {
  const [rows, setRows] = useState([]);
  const [entityType, setEntityType] = useState('');
  useEffect(() => {
    const query = entityType ? `?entityType=${encodeURIComponent(entityType)}` : '';
    apiFetch(`/audit-logs${query}`).then((response) => response.json()).then((result) => setRows(result.logs || []));
  }, [entityType]);
  return <AdminShell active="Audit Keuangan" className="admin-crud-shell"><header className="admin-header"><div><p className="eyebrow light">Audit trail</p><h1>Riwayat Perubahan Penting</h1></div></header><section className="crud-table-panel"><label>Filter entity <select value={entityType} onChange={(event) => setEntityType(event.target.value)}><option value="">Semua</option><option value="Product">Produk</option><option value="ProductVariant">Stok/varian</option><option value="Order">Transaksi</option><option value="Parcel">Parcel</option><option value="FinanceTransaction">Keuangan</option></select></label><table className="product-table"><thead><tr><th>Waktu</th><th>Entity</th><th>Field/Aksi</th><th>ID</th><th>Oleh</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{new Date(row.createdAt).toLocaleString('id-ID')}</td><td>{row.entityType}</td><td>{row.field}</td><td>{row.entityId}</td><td>{row.changedBy?.name || row.changedBy?.email || '-'}</td></tr>)}</tbody></table></section></AdminShell>;
}
