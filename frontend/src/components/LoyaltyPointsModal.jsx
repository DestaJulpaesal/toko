import { useState } from 'react';
import { Award, Check, X } from 'lucide-react';

/**
 * FASE 5: Modal Tukar Poin Loyalitas di Kasir
 */
export default function LoyaltyPointsModal({ isOpen, onClose, customer, onApplyDiscount }) {
  const [pointsToUse, setPointsToUse] = useState('');
  const [error, setError] = useState('');

  if (!isOpen || !customer) return null;

  const maxPoints = customer.points || 0;
  const numPoints = Number(pointsToUse) || 0;
  // 1 poin = Rp1
  const discountAmount = numPoints;

  const handleApply = () => {
    setError('');
    if (numPoints <= 0) {
      setError('Masukkan jumlah poin yang valid.');
      return;
    }
    if (numPoints > maxPoints) {
      setError(`Poin tidak cukup. Maksimal: ${maxPoints} poin.`);
      return;
    }

    onApplyDiscount(numPoints, discountAmount);
    onClose();
  };

  const handleUseAll = () => {
    setPointsToUse(String(maxPoints));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Award className="w-6 h-6" />
            <h3 className="font-bold text-lg">Tukar Poin Loyalitas</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <p className="text-xs text-emerald-700 dark:text-emerald-300">Pelanggan:</p>
            <p className="font-bold text-emerald-900 dark:text-emerald-100 text-base">{customer.name}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-emerald-700 dark:text-emerald-300">Saldo Poin Saat Ini:</span>
              <span className="font-extrabold text-emerald-700 dark:text-emerald-300 text-lg">{maxPoints.toLocaleString('id-ID')} Poin</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Jumlah Poin Yang Ingin Ditukar:
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max={maxPoints}
                value={pointsToUse}
                onChange={(e) => setPointsToUse(e.target.value)}
                placeholder="0"
                className="flex-1 px-3 py-2 border rounded-xl dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-sm"
              />
              <button
                type="button"
                onClick={handleUseAll}
                className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-xs font-medium rounded-xl shrink-0"
              >
                Gunakan Semua
              </button>
            </div>
            {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
          </div>

          {numPoints > 0 && (
            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl text-xs space-y-1">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Diskon Yang Didapat:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Rp {discountAmount.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Sisa Poin Pelanggan:</span>
                <span>{(maxPoints - numPoints).toLocaleString('id-ID')} Poin</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={numPoints <= 0 || numPoints > maxPoints}
            className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Terapkan Diskon</span>
          </button>
        </div>
      </div>
    </div>
  );
}
