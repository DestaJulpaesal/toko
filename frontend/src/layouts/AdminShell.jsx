import AdminSidebar from '../components/AdminSidebar';

/**
 * Kerangka SATU-SATUNYA untuk semua halaman admin.
 * Menggantikan pola di tiap halaman:
 *   <div className="admin-shell ..."><AdminSidebar active="X" /><main className="admin-main">...</main></div>
 *
 * className      : class tambahan di wrapper (mis. "tool-page", "finance-workspace")
 * mainClassName  : class tambahan di <main>
 */
export default function AdminShell({ active = '', className = '', mainClassName = '', children }) {
  return (
    <div className={`admin-shell g-shell ${className}`.trim()}>
      <AdminSidebar active={active} />
      <main className={`admin-main g-main ${mainClassName}`.trim()}>{children}</main>
    </div>
  );
}
