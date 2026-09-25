import { useEffect, useState } from 'react';
import { AlertTriangle, Calendar, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../services/api';

/**
 * FASE 5: Expiry Alert Widget untuk Admin Dashboard
 * Menampilkan barang yang mendekati kadaluarsa (H-30, H-7, Sudah Kadaluarsa)
 */
export default function ExpiryAlertWidget() {
  const [expiringProducts, setExpiringProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadExpiring() {
      try {
        const res = await apiFetch('/analytics/expiring-products?days=30');
        if (res?.success && Array.isArray(res.products)) {
          setExpiringProducts(res.products);
        }
      } catch (err) {
        console.error('Failed to load expiring products:', err);
      } finally {
        setLoading(false);
      }
    }
    loadExpiring();
  }, []);

  if (loading) return null;
  if (expiringProducts.length === 0) return null;

  const expiredCount = expiringProducts.filter((p) => p.urgency === 'EXPIRED').length;
  const criticalCount = expiringProducts.filter((p) => p.urgency === 'CRITICAL').length;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-amber-900 dark:text-amber-100 text-sm md:text-base">
              Peringatan Barang Kadaluarsa ({expiringProducts.length} barang)
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {expiredCount > 0 && <span className="font-bold text-red-600 dark:text-red-400">{expiredCount} sudah kadaluarsa! </span>}
              {criticalCount > 0 && <span>{criticalCount} kadaluarsa dalam 7 hari. </span>}
              Periksa dan keluarkan stok jika diperlukan.
            </p>
          </div>
        </div>
        <Link
          to="/admin/stock-opname"
          className="flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:underline shrink-0 bg-amber-100 dark:bg-amber-900/40 px-3 py-1.5 rounded-lg"
        >
          <span>Kelola Stok</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Preview list max 3 items */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
        {expiringProducts.slice(0, 3).map((item) => (
          <div
            key={item.unitId}
            className={`p-2.5 rounded-lg text-xs flex items-center justify-between ${
              item.isExpired
                ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-900'
                : item.urgency === 'CRITICAL'
                ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
                : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <div className="truncate pr-2">
              <p className="font-medium truncate">{item.productName}</p>
              <p className="text-[10px] opacity-75">{item.unitName}</p>
            </div>
            <div className="text-right shrink-0">
              <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${item.isExpired ? 'bg-red-200 text-red-900' : 'bg-amber-200 text-amber-900'}`}>
                {item.isExpired ? 'EXPIRED' : `${item.daysLeft} hari`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
