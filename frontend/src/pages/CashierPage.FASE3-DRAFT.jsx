import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminSidebar from '../components/AdminSidebar';
import CurrencyInput from '../components/CurrencyInput';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import CashierHelpModal from '../components/CashierHelpModal';
import { playBeep } from '../utils/barcodeUtils';
import { confirmAction } from '../utils/confirmService';
import { apiFetch } from '../services/api';
import { printReceipt } from '../utils/printReceipt';

const formatMoney = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

/**
 * ProductUnitPicker Component
 * Displays available units for a product and allows selection
 */
const ProductUnitPicker = ({ product, onSelectUnit, selectedUnitId }) => {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!product?.id) return;

    const loadUnits = async () => {
      setLoading(true);
      try {
        const response = await apiFetch(`/products/${product.id}/units`);
        const data = await response.json();
        if (data.success && Array.isArray(data.units)) {
          setUnits(data.units);
          // Auto-select first unit if none selected
          if (!selectedUnitId && data.units.length > 0) {
            onSelectUnit(data.units[0]);
          }
        }
      } catch (error) {
        console.error('Failed to load units:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUnits();
  }, [product?.id, onSelectUnit, selectedUnitId]);

  if (units.length === 0) return null;

  return (
    <div className="unit-picker" style={{ marginBottom: '10px' }}>
      <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>
        Pilih Unit:
      </label>
      <select
        value={selectedUnitId || ''}
        onChange={(e) => {
          const unit = units.find((u) => u.id === e.target.value);
          if (unit) onSelectUnit(unit);
        }}
        disabled={loading}
        style={{
          width: '100%',
          padding: '8px',
          borderRadius: '4px',
          border: '1px solid #ddd',
          fontSize: '14px',
          marginTop: '5px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        <option value="">-- Pilih Unit --</option>
        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.name} - {formatMoney(unit.sellingPrice)} (Stok: {unit.baseStockQty})
          </option>
        ))}
      </select>
    </div>
  );
};

/**
 * StockAlertBadge Component
 * Shows stock urgency status
 */
const StockAlertBadge = ({ currentStock, minimumStock, maximumStock }) => {
  let status = 'NORMAL';
  let bgColor = '#4CAF50';

  if (currentStock < minimumStock) {
    status = 'URGENT';
    bgColor = '#f44336';
  } else if (currentStock < minimumStock * 1.5) {
    status = 'LOW';
    bgColor = '#ff9800';
  } else if (currentStock >= maximumStock) {
    status = 'OVERSTOCK';
    bgColor = '#2196F3';
  }

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: '20px',
        backgroundColor: bgColor,
        color: 'white',
        fontSize: '11px',
        fontWeight: 'bold',
        marginLeft: '8px',
      }}
    >
      {status}
    </span>
  );
};

// Hitung poin loyalitas:
// - Minimal 100rb dapat 10 poin (setiap kelipatan 100rb = 10 poin)
// - Minimal 50rb dapat 2 poin (sisa >= 50rb = +2 poin)
export const calculateEarnedPoints = (total) => {
  const amount = Number(total) || 0;
  if (amount < 50000) return 0;
  const ratusan = Math.floor(amount / 100000);
  const sisa = amount % 100000;
  const bonusSisa = sisa >= 50000 ? 2 : 0;
  return ratusan * 10 + bonusSisa;
};

// Daftar Promo Campaign Aktif
export const availablePromos = [
  { id: 'none', name: 'Tanpa Promo', code: '', type: 'NONE', value: 0, tag: 'NORMAL' },
  { id: 'promo-lebaran', name: 'Promo Lebaran', code: 'LEBARAN15', type: 'PERCENT', value: 15, tag: '15% OFF', desc: 'Diskon spesial momen Lebaran 15%' },
  { id: 'promo-glosir10', name: 'Glosir Hemat 10', code: 'GLOSIR10', type: 'PERCENT', value: 10, tag: '10% OFF', desc: 'Diskon 10% belanja hemat sembako' },
  { id: 'promo-hemat25', name: 'Hemat 25 Ribu', code: 'HEMAT25', type: 'FIXED', value: 25000, tag: 'POTONGAN 25RB', desc: 'Potongan langsung Rp 25.000' },
];

/**
 * CashierPage - Enhanced with Unit Management
 * FASE 3: Product unit selection during checkout
 */
export default function CashierPage() {
  // ... existing states ...
  const [selectedUnits, setSelectedUnits] = useState({}); // { productId: unit }

  // Handle unit selection for a product
  const handleUnitSelect = (productId, unit) => {
    setSelectedUnits((prev) => ({
      ...prev,
      [productId]: unit,
    }));
  };

  // Render product card dengan unit picker
  const renderProductCard = (product) => {
    const selectedUnit = selectedUnits[product.id];

    return (
      <div key={product.id} className="product-card" style={{ marginBottom: '15px' }}>
        <h4>{product.name}</h4>
        
        {/* Unit Picker */}
        <ProductUnitPicker
          product={product}
          selectedUnitId={selectedUnit?.id}
          onSelectUnit={(unit) => handleUnitSelect(product.id, unit)}
        />

        {/* Stock Status */}
        {selectedUnit && (
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
            <span>Stok: {selectedUnit.baseStockQty}</span>
            <StockAlertBadge
              currentStock={selectedUnit.baseStockQty}
              minimumStock={selectedUnit.minimumStock}
              maximumStock={selectedUnit.maximumStock || 999}
            />
          </div>
        )}

        {/* Add to Cart Button */}
        <button
          onClick={() => {
            if (!selectedUnit) {
              alert('Pilih unit terlebih dahulu');
              return;
            }
            // Add to cart dengan unit info
            addToCart(product, selectedUnit);
          }}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          + Keranjang
        </button>
      </div>
    );
  };

  // Enhanced addToCart to include unit info
  const addToCart = (product, unit) => {
    const item = {
      productId: product.id,
      productName: product.name,
      unitId: unit.id,
      unitName: unit.name,
      price: unit.sellingPrice,
      quantity: 1,
      subtotal: unit.sellingPrice,
      // Stock info untuk validation
      availableStock: unit.baseStockQty,
      minimumStock: unit.minimumStock,
    };

    // Add to items array
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.productId === product.id && i.unitId === unit.id
      );

      if (existing) {
        // Validate stock before increasing quantity
        if (existing.quantity >= existing.availableStock) {
          alert(`Stok ${unit.name} tidak cukup`);
          return prev;
        }
        return prev.map((i) =>
          i === existing
            ? {
                ...i,
                quantity: i.quantity + 1,
                subtotal: i.price * (i.quantity + 1),
              }
            : i
        );
      }

      return [...prev, item];
    });

    playBeep();
  };

  return (
    <div className="cashier-page">
      {/* ... existing JSX ... */}
      {/* Product list dengan unit picker */}
      <div className="product-list">
        {products.map((product) => renderProductCard(product))}
      </div>
    </div>
  );
}
